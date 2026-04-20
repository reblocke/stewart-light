export function createWorkerClient({ onReady, onStatus, onError }) {
  let worker = null;
  let requestId = 0;
  const pendingRequests = new Map();

  function rejectPending(message) {
    for (const pending of pendingRequests.values()) {
      pending.reject(new Error(message));
    }
    pendingRequests.clear();
  }

  function requestWorker(type, payload = {}) {
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      worker.postMessage({ id, type, ...payload });
    });
  }

  function handleInitializationError(error) {
    onReady(false);
    onError(error instanceof Error ? error : new Error(String(error)));
    onStatus("Error: Python engine did not initialize.", "error");
  }

  function start() {
    if (worker) {
      worker.terminate();
      rejectPending("Python engine restarted.");
    }

    onReady(false);
    onStatus("Loading Python engine.", "loading");

    worker = new Worker("./pyodide_worker.js", { type: "classic" });
    worker.addEventListener("message", (event) => {
      const { id, type, payload, error } = event.data || {};
      const pending = pendingRequests.get(id);

      if (type === "ready") {
        onReady(true);
        onStatus("Ready: Python calculator loaded.", "ready");
      }

      if (pending) {
        pendingRequests.delete(id);
        if (type === "error") {
          pending.reject(new Error(error || "Worker request failed."));
        } else {
          pending.resolve(payload);
        }
      }
    });

    worker.addEventListener("error", (event) => {
      handleInitializationError(new Error(event.message));
    });

    requestWorker("initialize").catch(handleInitializationError);
  }

  function calculate(input) {
    return requestWorker("calculate", { input });
  }

  return { start, calculate };
}

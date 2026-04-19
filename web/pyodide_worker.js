const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/";
const PACKAGE_ROOT = "/stewartlight_app";
const PACKAGE_FILES = [
  "__init__.py",
  "calculator.py",
  "enhancements.py",
  "interpret.py",
  "models.py",
  "units.py",
];

let pyodidePromise = null;

async function fetchText(path) {
  const url = new URL(path, self.location.href);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url.pathname}: ${response.status}`);
  }
  return response.text();
}

async function mountPackage(pyodide) {
  pyodide.FS.mkdirTree(`${PACKAGE_ROOT}/stewartlight`);

  await Promise.all(
    PACKAGE_FILES.map(async (fileName) => {
      const source = await fetchText(`./assets/py/stewartlight/${fileName}`);
      pyodide.FS.writeFile(`${PACKAGE_ROOT}/stewartlight/${fileName}`, source);
    }),
  );

  pyodide.runPython(`
import sys

package_root = "${PACKAGE_ROOT}"
if package_root not in sys.path:
    sys.path.insert(0, package_root)
`);
}

async function initializeRuntime() {
  importScripts(`${PYODIDE_INDEX_URL}pyodide.js`);
  const pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX_URL });
  await mountPackage(pyodide);
  return pyodide;
}

function getRuntime() {
  pyodidePromise ||= initializeRuntime();
  return pyodidePromise;
}

function sanitizeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const lines = message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const validationLine = [...lines]
    .reverse()
    .find((line) => line.includes("StewartLightInputError:"));

  if (validationLine) {
    return validationLine.replace(/^.*StewartLightInputError:\s*/, "");
  }

  const lastLine = lines.at(-1) || "Calculation failed.";
  return lastLine.replace(/^.*(?:ValueError|TypeError):\s*/, "");
}

async function calculate(input) {
  const pyodide = await getRuntime();
  pyodide.globals.set("input_json", JSON.stringify(input));

  const payloadJson = pyodide.runPython(`
import json
from stewartlight import calculate_stewart_light
from stewartlight.units import normalize_input_units

payload = json.loads(input_json)
canonical_input = normalize_input_units(
    ph=payload["ph"],
    pco2=payload["pco2"],
    hco3_mmol_l=payload["hco3_mmol_l"],
    sbe_mmol_l=payload["sbe_mmol_l"],
    na_mmol_l=payload["na_mmol_l"],
    cl_mmol_l=payload["cl_mmol_l"],
    albumin=payload["albumin"],
    lactate_mmol_l=payload.get("lactate_mmol_l"),
    phosphate_mmol_l=payload.get("phosphate_mmol_l"),
    pco2_unit=payload.get("pco2_unit", "mmHg"),
    albumin_unit=payload.get("albumin_unit", "g/L"),
    suspect_chronic_hypercapnia=payload.get("suspect_chronic_hypercapnia", False),
)
result = calculate_stewart_light(canonical_input)
json.dumps({
    "normalizedInputs": canonical_input.to_dict(),
    "result": result.to_dict(),
})
`);

  pyodide.globals.delete("input_json");
  return JSON.parse(payloadJson);
}

self.addEventListener("message", async (event) => {
  const { id, type, input } = event.data || {};

  try {
    if (type === "initialize") {
      await getRuntime();
      self.postMessage({ id, type: "ready" });
      return;
    }

    if (type === "calculate") {
      const payload = await calculate(input);
      self.postMessage({ id, type: "calculation", payload });
      return;
    }

    self.postMessage({ id, type: "error", error: "Unknown worker request." });
  } catch (error) {
    self.postMessage({ id, type: "error", error: sanitizeError(error) });
  }
});

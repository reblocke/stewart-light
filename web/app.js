import { collectFormInputs, populateExample } from "./js/input.js";
import { applyViewToggles, clearResults, renderResult } from "./js/result-rendering.js";
import { renderMessages, setRuntimeStatus } from "./js/ui-utils.js";
import { renderCompensationMap, renderVisuals } from "./js/visuals.js";
import { createWorkerClient } from "./js/worker-client.js";

const state = {
  inputs: {},
  normalizedInputs: null,
  result: null,
  warnings: [],
  loading: true,
  error: null,
  engineReady: false,
};

const refs = {
  form: document.querySelector("#calculator-form"),
  buttons: {
    calculate: document.querySelector("#calculate-button"),
    reset: document.querySelector("#reset-button"),
    loadExample: document.querySelector("#load-example-button"),
    retry: document.querySelector("#retry-engine"),
  },
  exampleSelect: document.querySelector("#example-select"),
  toggles: {
    primary: document.querySelector("#toggle-primary"),
    advanced: document.querySelector("#toggle-advanced"),
    compensationMap: document.querySelector("#toggle-compensation-map"),
  },
  fields: {
    ph: document.querySelector("#ph"),
    pco2: document.querySelector("#pco2"),
    hco3: document.querySelector("#hco3"),
    sbe: document.querySelector("#sbe"),
    sodium: document.querySelector("#sodium"),
    chloride: document.querySelector("#chloride"),
    albumin: document.querySelector("#albumin"),
    lactate: document.querySelector("#lactate"),
    phosphate: document.querySelector("#phosphate"),
    "pco2-unit": document.querySelector("#pco2-unit"),
    "albumin-unit": document.querySelector("#albumin-unit"),
    "chronic-hypercapnia": document.querySelector("#chronic-hypercapnia"),
  },
  runtimeStatus: document.querySelector("#runtime-status"),
  formErrors: document.querySelector("#form-errors"),
  formWarnings: document.querySelector("#form-warnings"),
  headlineCard: document.querySelector("#headline-card"),
  bostonDetails: document.querySelector("#boston-details"),
  stewartDetails: document.querySelector("#stewart-details"),
  whatAdds: document.querySelector("#what-adds"),
  comparisonCaution: document.querySelector("#comparison-caution"),
  comparisonExtra: document.querySelector("#comparison-extra"),
  primaryViewCards: document.querySelectorAll(".primary-view-card"),
  anionGapDetails: document.querySelector("#anion-gap-details"),
  anionGapNotes: document.querySelector("#anion-gap-notes"),
  hydrogenChip: document.querySelector("#hydrogen-chip"),
  hydrogenNote: document.querySelector("#hydrogen-note"),
  followUpCard: document.querySelector("#follow-up-card"),
  followUpTriggers: document.querySelector("#follow-up-triggers"),
  followUpPrompts: document.querySelector("#follow-up-prompts"),
  toxicologyCaveat: document.querySelector("#toxicology-caveat"),
  partitionChart: document.querySelector("#partition-chart"),
  partitionSummary: document.querySelector("#partition-summary"),
  partitionAnnotations: document.querySelector("#partition-annotations"),
  teachingDiagram: document.querySelector("#teaching-diagram"),
  teachingSummary: document.querySelector("#teaching-summary"),
  advancedBedsideCard: document.querySelector("#advanced-bedside-card"),
  advancedBedsideNote: document.querySelector("#advanced-bedside-note"),
  advancedBedsideDetails: document.querySelector("#advanced-bedside-details"),
  compensationMapCard: document.querySelector("#compensation-map-card"),
  compensationMap: document.querySelector("#compensation-map"),
  compensationMapNote: document.querySelector("#compensation-map-note"),
  limitationsList: document.querySelector("#limitations-list"),
  cautionsList: document.querySelector("#cautions-list"),
  normalizedDetails: document.querySelector("#normalized-details"),
};

function updateRuntimeStatus(message, stateName) {
  setRuntimeStatus(refs.runtimeStatus, message, stateName);
}

const workerClient = createWorkerClient({
  onReady(isReady) {
    state.loading = !isReady;
    state.engineReady = isReady;
    refs.buttons.calculate.disabled = !isReady;
    refs.buttons.retry.hidden = isReady;
  },
  onStatus: updateRuntimeStatus,
  onError(error) {
    state.loading = false;
    state.engineReady = false;
    state.error = error.message;
    refs.buttons.calculate.disabled = true;
    refs.buttons.retry.hidden = false;
  },
});

async function calculateFromForm() {
  renderMessages(refs.formErrors, []);
  renderMessages(refs.formWarnings, []);

  if (!state.engineReady) {
    renderMessages(refs.formErrors, [{ id: null, message: "Python engine is still loading." }]);
    return;
  }

  const { errors, input } = collectFormInputs(refs);
  if (errors.length > 0) {
    renderMessages(refs.formErrors, errors);
    const firstError = errors[0];
    if (firstError.id) {
      refs.fields[firstError.id].focus();
    }
    return;
  }

  state.inputs = input;
  refs.buttons.calculate.disabled = true;
  refs.buttons.calculate.textContent = "Calculating";
  updateRuntimeStatus("Calculating with Python.", "loading");

  try {
    const payload = await workerClient.calculate(input);
    renderResult(payload, refs, state);
    updateRuntimeStatus("Ready: calculation complete.", "ready");
  } catch (error) {
    renderMessages(refs.formErrors, [{ id: null, message: error.message }]);
    updateRuntimeStatus("Ready: calculation error shown below.", "error");
  } finally {
    refs.buttons.calculate.disabled = !state.engineReady;
    refs.buttons.calculate.textContent = "Calculate";
  }
}

function selectedExampleKey() {
  return refs.exampleSelect.value;
}

function updateExampleButtonState() {
  refs.buttons.loadExample.disabled = selectedExampleKey() === "";
}

function loadSelectedExample() {
  const exampleKey = selectedExampleKey();
  if (!exampleKey) {
    updateExampleButtonState();
    return;
  }

  populateExample(refs, exampleKey);
  renderMessages(refs.formErrors, []);
  renderMessages(refs.formWarnings, []);
  updateExampleButtonState();

  if (state.engineReady) {
    calculateFromForm();
  }
}

refs.form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculateFromForm();
});

refs.buttons.reset.addEventListener("click", () => {
  refs.form.reset();
  renderMessages(refs.formErrors, []);
  renderMessages(refs.formWarnings, []);
  clearResults(refs, state);
  updateExampleButtonState();
});

refs.buttons.loadExample.addEventListener("click", () => {
  loadSelectedExample();
});

refs.exampleSelect.addEventListener("change", () => {
  loadSelectedExample();
});

refs.buttons.retry.addEventListener("click", () => {
  workerClient.start();
});

for (const toggle of [
  refs.toggles.primary,
  refs.toggles.advanced,
  refs.toggles.compensationMap,
]) {
  toggle.addEventListener("change", () => applyViewToggles(refs, state));
}

window.addEventListener("resize", () => {
  if (state.result) {
    renderVisuals(state.result, refs);
    renderCompensationMap(state.result, refs);
  }
});

clearResults(refs, state);
updateExampleButtonState();
workerClient.start();

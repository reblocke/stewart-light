const EXAMPLES = {
  "unmeasured-ion": {
    ph: "7.22",
    pco2: "25",
    hco3: "10",
    sbe: "-18",
    sodium: "140",
    chloride: "104",
    albumin: "40",
    lactate: "6",
    phosphate: "",
    pco2Unit: "mmHg",
    albuminUnit: "g/L",
    chronicHypercapnia: false,
  },
  hyperchloremic: {
    ph: "7.28",
    pco2: "30",
    hco3: "14",
    sbe: "-12",
    sodium: "140",
    chloride: "118",
    albumin: "40",
    lactate: "",
    phosphate: "",
    pco2Unit: "mmHg",
    albuminUnit: "g/L",
    chronicHypercapnia: false,
  },
  hypoalbuminemic: {
    ph: "7.46",
    pco2: "44",
    hco3: "30",
    sbe: "6",
    sodium: "140",
    chloride: "105",
    albumin: "20",
    lactate: "",
    phosphate: "",
    pco2Unit: "mmHg",
    albuminUnit: "g/L",
    chronicHypercapnia: false,
  },
  masked: {
    ph: "7.40",
    pco2: "40",
    hco3: "24",
    sbe: "0",
    sodium: "140",
    chloride: "111",
    albumin: "20",
    lactate: "",
    phosphate: "",
    pco2Unit: "mmHg",
    albuminUnit: "g/L",
    chronicHypercapnia: false,
  },
  "chronic-hypercapnia": {
    ph: "7.37",
    pco2: "60",
    hco3: "32",
    sbe: "8",
    sodium: "145",
    chloride: "103",
    albumin: "40",
    lactate: "",
    phosphate: "",
    pco2Unit: "mmHg",
    albuminUnit: "g/L",
    chronicHypercapnia: true,
  },
};

const REQUIRED_FIELDS = [
  ["ph", "pH"],
  ["pco2", "PaCO2"],
  ["hco3", "HCO3"],
  ["sbe", "SBE"],
  ["sodium", "Na"],
  ["chloride", "Cl"],
  ["albumin", "Albumin"],
];

const PLAUSIBLE_RANGES = {
  ph: [6.8, 7.8, "pH"],
  pco2_mmhg: [10, 120, "PaCO2"],
  hco3_mmol_l: [2, 60, "HCO3"],
  sbe_mmol_l: [-40, 40, "SBE"],
  na_mmol_l: [100, 180, "Na"],
  cl_mmol_l: [70, 140, "Cl"],
  albumin_g_l: [5, 60, "Albumin"],
  lactate_mmol_l: [0, 30, "Lactate"],
};

const state = {
  inputs: {},
  normalizedInputs: null,
  result: null,
  warnings: [],
  loading: true,
  error: null,
  engineReady: false,
};

const form = document.querySelector("#calculator-form");
const calculateButton = document.querySelector("#calculate-button");
const resetButton = document.querySelector("#reset-button");
const loadExampleButton = document.querySelector("#load-example-button");
const exampleSelect = document.querySelector("#example-select");
const togglePrimary = document.querySelector("#toggle-primary");
const toggleAdvanced = document.querySelector("#toggle-advanced");
const toggleCompensationMap = document.querySelector("#toggle-compensation-map");
const retryButton = document.querySelector("#retry-engine");
const runtimeStatus = document.querySelector("#runtime-status");
const formErrors = document.querySelector("#form-errors");
const formWarnings = document.querySelector("#form-warnings");

const headlineCard = document.querySelector("#headline-card");
const bostonDetails = document.querySelector("#boston-details");
const stewartDetails = document.querySelector("#stewart-details");
const whatAdds = document.querySelector("#what-adds");
const comparisonCaution = document.querySelector("#comparison-caution");
const comparisonExtra = document.querySelector("#comparison-extra");
const primaryViewCards = document.querySelectorAll(".primary-view-card");
const anionGapDetails = document.querySelector("#anion-gap-details");
const anionGapNotes = document.querySelector("#anion-gap-notes");
const hydrogenChip = document.querySelector("#hydrogen-chip");
const hydrogenNote = document.querySelector("#hydrogen-note");
const followUpCard = document.querySelector("#follow-up-card");
const followUpTriggers = document.querySelector("#follow-up-triggers");
const followUpPrompts = document.querySelector("#follow-up-prompts");
const toxicologyCaveat = document.querySelector("#toxicology-caveat");
const partitionChart = document.querySelector("#partition-chart");
const partitionSummary = document.querySelector("#partition-summary");
const partitionAnnotations = document.querySelector("#partition-annotations");
const teachingDiagram = document.querySelector("#teaching-diagram");
const teachingSummary = document.querySelector("#teaching-summary");
const advancedBedsideCard = document.querySelector("#advanced-bedside-card");
const advancedBedsideNote = document.querySelector("#advanced-bedside-note");
const advancedBedsideDetails = document.querySelector("#advanced-bedside-details");
const compensationMapCard = document.querySelector("#compensation-map-card");
const compensationMap = document.querySelector("#compensation-map");
const compensationMapNote = document.querySelector("#compensation-map-note");
const limitationsList = document.querySelector("#limitations-list");
const cautionsList = document.querySelector("#cautions-list");
const normalizedDetails = document.querySelector("#normalized-details");

let worker = null;
let requestId = 0;
const pendingRequests = new Map();

function field(id) {
  return document.querySelector(`#${id}`);
}

function setRuntimeStatus(message, stateName) {
  runtimeStatus.textContent = message;
  runtimeStatus.dataset.state = stateName;
}

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Not provided";
  }
  return Number(value).toFixed(digits);
}

function requestWorker(type, payload = {}) {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    worker.postMessage({ id, type, ...payload });
  });
}

function startWorker() {
  if (worker) {
    worker.terminate();
  }

  state.loading = true;
  state.engineReady = false;
  state.error = null;
  retryButton.hidden = true;
  calculateButton.disabled = true;
  setRuntimeStatus("Loading Python engine.", "loading");

  worker = new Worker("./pyodide_worker.js", { type: "classic" });
  worker.addEventListener("message", (event) => {
    const { id, type, payload, error } = event.data || {};
    const pending = pendingRequests.get(id);

    if (type === "ready") {
      state.loading = false;
      state.engineReady = true;
      calculateButton.disabled = false;
      setRuntimeStatus("Ready: Python calculator loaded.", "ready");
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
    state.loading = false;
    state.engineReady = false;
    state.error = event.message;
    calculateButton.disabled = true;
    retryButton.hidden = false;
    setRuntimeStatus("Error: Python engine did not initialize.", "error");
  });

  requestWorker("initialize").catch((error) => {
    state.loading = false;
    state.engineReady = false;
    state.error = error.message;
    calculateButton.disabled = true;
    retryButton.hidden = false;
    setRuntimeStatus("Error: Python engine did not initialize.", "error");
  });
}

function parseNumber(id, label, errors) {
  const input = field(id);
  const value = input.value.trim();
  if (!value) {
    errors.push({ id, message: `${label} is required.` });
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    errors.push({ id, message: `${label} must be a valid number.` });
    return null;
  }
  return parsed;
}

function collectFormInputs() {
  const errors = [];
  const required = Object.fromEntries(
    REQUIRED_FIELDS.map(([id, label]) => [id, parseNumber(id, label, errors)]),
  );

  const lactateRaw = field("lactate").value.trim();
  let lactate = null;
  if (lactateRaw) {
    lactate = Number(lactateRaw);
    if (!Number.isFinite(lactate)) {
      errors.push({ id: "lactate", message: "Lactate must be a valid number." });
    }
  }
  const phosphateRaw = field("phosphate").value.trim();
  let phosphate = null;
  if (phosphateRaw) {
    phosphate = Number(phosphateRaw);
    if (!Number.isFinite(phosphate)) {
      errors.push({ id: "phosphate", message: "Phosphate must be a valid number." });
    }
  }

  if (required.ph !== null && required.ph <= 0) {
    errors.push({ id: "ph", message: "pH must be greater than zero." });
  }
  for (const id of ["pco2", "hco3", "sodium", "chloride"]) {
    if (required[id] !== null && required[id] <= 0) {
      errors.push({ id, message: `${field(id).closest("label").innerText.trim()} must be > 0.` });
    }
  }
  if (required.albumin !== null && required.albumin < 0) {
    errors.push({ id: "albumin", message: "Albumin must be greater than or equal to zero." });
  }
  if (lactate !== null && lactate < 0) {
    errors.push({ id: "lactate", message: "Lactate must be greater than or equal to zero." });
  }
  if (phosphate !== null && phosphate < 0) {
    errors.push({
      id: "phosphate",
      message: "Phosphate must be greater than or equal to zero.",
    });
  }

  if (errors.length > 0) {
    return { errors, input: null };
  }

  return {
    errors,
    input: {
      ph: required.ph,
      pco2: required.pco2,
      hco3_mmol_l: required.hco3,
      sbe_mmol_l: required.sbe,
      na_mmol_l: required.sodium,
      cl_mmol_l: required.chloride,
      albumin: required.albumin,
      lactate_mmol_l: lactate,
      phosphate_mmol_l: phosphate,
      pco2_unit: field("pco2-unit").value,
      albumin_unit: field("albumin-unit").value,
      suspect_chronic_hypercapnia: field("chronic-hypercapnia").checked,
    },
  };
}

function plausibleWarnings(normalizedInputs) {
  const warnings = [];
  for (const [key, [min, max, label]] of Object.entries(PLAUSIBLE_RANGES)) {
    const value = normalizedInputs[key];
    if (value === null || value === undefined) {
      continue;
    }
    if (value < min || value > max) {
      warnings.push(`${label} is outside the suggested plausible range (${min}-${max}).`);
    }
  }
  return warnings;
}

function renderMessages(container, messages) {
  container.replaceChildren();
  if (messages.length === 0) {
    container.hidden = true;
    return;
  }

  const list = document.createElement("ul");
  for (const message of messages) {
    const item = document.createElement("li");
    item.textContent = typeof message === "string" ? message : message.message;
    list.append(item);
  }
  container.append(list);
  container.hidden = false;
}

function renderDefinitionList(container, rows) {
  container.replaceChildren();
  for (const [label, value] of rows) {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    container.append(term, description);
  }
}

function renderList(container, items) {
  container.replaceChildren();
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    container.append(li);
  }
}

function expectedCompensationText(boston) {
  const expected = boston.expected_compensation;
  if (expected.lower_mmhg !== undefined) {
    return `${formatNumber(expected.lower_mmhg)}-${formatNumber(expected.upper_mmhg)} mmHg`;
  }
  if (expected.acute_hco3_mmol_l !== undefined) {
    return `acute ${formatNumber(expected.acute_hco3_mmol_l)} / chronic ${formatNumber(
      expected.chronic_hco3_mmol_l,
    )} mmol/L HCO3`;
  }
  return expected.not_applied || "Not applied";
}

function measuredValueText(result) {
  const expected = result.boston.expected_compensation;
  if (expected.lower_mmhg !== undefined) {
    return `${formatNumber(result.input.pco2_mmhg)} mmHg PaCO2`;
  }
  if (expected.acute_hco3_mmol_l !== undefined) {
    return `${formatNumber(result.input.hco3_mmol_l)} mmol/L HCO3`;
  }
  return "Not applicable";
}

function anionGapFlagText(flag) {
  const labels = {
    low_negative: "low/negative",
    not_elevated: "not elevated",
    elevated: "elevated",
    clearly_elevated: "clearly elevated",
  };
  return labels[flag] || flag;
}

function renderComparisonExtras(result) {
  const rows = [];
  const ag = result.anion_gap;
  const hypoalbuminMasking = ag.notes.some((note) => note.includes("Hypoalbuminemia may mask"));
  if (ag.anion_gap_flag !== "not_elevated" || hypoalbuminMasking) {
    rows.push([
      "Anion gap context",
      `Corrected AG ${formatNumber(ag.anion_gap_corrected)} mmol/L (${anionGapFlagText(
        ag.anion_gap_flag,
      )}).`,
    ]);
  }

  const overlay = result.chronic_hypercapnia_overlay;
  if (overlay.message || overlay.soft_note) {
    rows.push(["Chronic hypercapnia caution", overlay.message || overlay.soft_note]);
  }

  if (result.follow_up.enabled) {
    rows.push(["Lab caveat", "Use same-timepoint values and local laboratory ranges."]);
  }

  renderDefinitionList(comparisonExtra, rows);
  comparisonExtra.hidden = rows.length === 0;
}

function renderAnionGapContext(result) {
  const ag = result.anion_gap;
  anionGapDetails.dataset.flag = ag.anion_gap_flag;
  renderDefinitionList(anionGapDetails, [
    ["Raw AG", `${formatNumber(ag.anion_gap_raw)} mmol/L`],
    ["Albumin-corrected AG", `${formatNumber(ag.anion_gap_corrected)} mmol/L`],
    ["Interpretation", anionGapFlagText(ag.anion_gap_flag)],
  ]);
  renderList(anionGapNotes, ag.notes);
}

function renderHydrogenContext(result) {
  hydrogenChip.textContent = `pH ${formatNumber(result.input.ph, 2)} ≈ ${formatNumber(
    result.hydrogen.hydrogen_nmol_l,
    0,
  )} nmol/L H+`;
  hydrogenNote.textContent = result.hydrogen.note;
}

function renderFollowUp(result) {
  if (!result.follow_up.enabled) {
    followUpCard.hidden = true;
    followUpTriggers.replaceChildren();
    followUpPrompts.replaceChildren();
    toxicologyCaveat.textContent = "";
    return;
  }

  followUpCard.hidden = false;
  renderList(followUpTriggers, result.follow_up.trigger_reasons);
  renderList(followUpPrompts, result.follow_up.prompts);
  toxicologyCaveat.textContent = result.follow_up.toxicology_caveat || "";
  toxicologyCaveat.hidden = !result.follow_up.toxicology_caveat;
}

function renderAdvancedBedside(result) {
  const advanced = result.advanced_bedside;
  advancedBedsideNote.textContent = advanced.note;
  renderDefinitionList(advancedBedsideDetails, [
    ["Water effect", `${formatSigned(advanced.water_effect)} mmol/L`],
    ["Corrected chloride", `${formatNumber(advanced.chloride_corrected)} mmol/L`],
    ["Chloride effect", `${formatSigned(advanced.chloride_effect)} mmol/L`],
    ["Albumin effect", `${formatSigned(advanced.albumin_effect_bedside)} mmol/L`],
    [
      "Phosphate effect",
      advanced.phosphate_effect === null
        ? "Not provided"
        : `${formatSigned(advanced.phosphate_effect)} mmol/L`,
    ],
    ["Other effect", `${formatSigned(advanced.other_effect)} mmol/L`],
  ]);
}

function renderCompensationMap(result) {
  const map = result.compensation_map;
  const compact = compactVisualLayout();
  const width = compact ? 360 : 720;
  const height = compact ? 300 : 360;
  const left = compact ? 42 : 70;
  const right = compact ? 338 : 670;
  const top = compact ? 36 : 34;
  const bottom = compact ? 238 : 292;
  const minX = 15;
  const maxX = 90;
  const minY = -25;
  const maxY = 25;
  const scaleX = (value) => left + ((value - minX) / (maxX - minX)) * (right - left);
  const scaleY = (value) => bottom - ((value - minY) / (maxY - minY)) * (bottom - top);
  const chronicLine = [
    [15, 0.4 * (15 - 40)],
    [90, 0.4 * (90 - 40)],
  ];
  const metabolicAcidosisLine = [
    [40 + minY, minY],
    [40, 0],
  ];
  const metabolicAlkalosisLine = [
    [40, 0],
    [40 + 0.6 * maxY, maxY],
  ];
  const linePath = (points) =>
    points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${scaleX(x)} ${scaleY(y)}`).join(" ");
  const patientX = scaleX(map.patient_pco2_mmhg);
  const patientY = scaleY(map.patient_sbe_mmol_l);
  const acuteLabel = compact ? "acute" : "acute respiratory SBE 0";
  const chronicLabel = compact ? "chronic" : "chronic respiratory guide";
  const acidosisLabel = compact ? "met acid" : "metabolic acidosis guide";
  const alkalosisLabel = compact ? "met alk" : "metabolic alkalosis guide";
  const sbeAxisLabel = compact
    ? `<text class="axis-unit" x="${left}" y="18">SBE (mmol/L)</text>`
    : `<text class="axis-unit" x="26" y="${top + 4}" transform="rotate(-90 26 ${top + 4})">SBE (mmol/L)</text>`;

  compensationMap.innerHTML = `
    <svg
      class="visual-svg compensation-map-svg"
      viewBox="0 0 ${width} ${height}"
      role="img"
      aria-labelledby="compensation-map-svg-title compensation-map-svg-desc"
    >
      <title id="compensation-map-svg-title">SBE vs PaCO2 compensation map</title>
      <desc id="compensation-map-svg-desc">
        Patient point plotted against educational acute respiratory, chronic respiratory, and metabolic compensation guides.
      </desc>
      <line class="axis-line" x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" />
      <line class="axis-line" x1="${left}" x2="${left}" y1="${top}" y2="${bottom}" />
      <line class="grid-line" x1="${left}" x2="${right}" y1="${scaleY(0)}" y2="${scaleY(0)}" />
      <line class="grid-line" x1="${scaleX(40)}" x2="${scaleX(40)}" y1="${top}" y2="${bottom}" />
      <path class="map-guide acute-guide" data-guide="acute-respiratory" d="M ${left} ${scaleY(0)} L ${right} ${scaleY(0)}" />
      <path class="map-guide chronic-guide" data-guide="chronic-respiratory" d="${linePath(chronicLine)}" />
      <path class="map-guide metabolic-acidosis-guide" data-guide="metabolic-acidosis" d="${linePath(metabolicAcidosisLine)}" />
      <path class="map-guide metabolic-alkalosis-guide" data-guide="metabolic-alkalosis" d="${linePath(metabolicAlkalosisLine)}" />
      <circle class="normal-point" cx="${scaleX(40)}" cy="${scaleY(0)}" r="5" />
      <circle
        id="compensation-patient-point"
        class="patient-point"
        data-pco2="${dataNumber(map.patient_pco2_mmhg)}"
        data-sbe="${dataNumber(map.patient_sbe_mmol_l)}"
        cx="${patientX}"
        cy="${patientY}"
        r="7"
      />
      <text class="map-label" x="${scaleX(40) + 10}" y="${scaleY(0) - 8}">normal (40, 0)</text>
      <text class="map-label" x="${patientX + 10}" y="${patientY - 10}">patient</text>
      <text class="map-label" x="${right}" y="${scaleY(0) - 8}" text-anchor="end">${acuteLabel}</text>
      <text class="map-label" x="${scaleX(compact ? 70 : 75)}" y="${scaleY(compact ? 12 : 14)}">${chronicLabel}</text>
      <text class="map-label" x="${scaleX(compact ? 23 : 25)}" y="${scaleY(compact ? -14 : -17)}">${acidosisLabel}</text>
      <text class="map-label" x="${scaleX(compact ? 47 : 50)}" y="${scaleY(compact ? 16 : 18)}">${alkalosisLabel}</text>
      <text class="axis-unit" x="${right}" y="${height - 14}" text-anchor="end">PaCO2 (mmHg)</text>
      ${sbeAxisLabel}
    </svg>
  `;
  compensationMapNote.textContent = `${map.note} Patient point is closest to the ${map.closest_region}.`;
}

function applyViewToggles() {
  for (const card of primaryViewCards) {
    card.hidden = !togglePrimary.checked;
  }
  advancedBedsideCard.hidden = !(state.result && toggleAdvanced.checked);
  compensationMapCard.hidden = !(state.result && toggleCompensationMap.checked);
}

function formatSigned(value) {
  const numericValue = Number(value);
  if (Math.abs(numericValue) < 0.05) {
    return "0.0";
  }
  return `${numericValue > 0 ? "+" : ""}${numericValue.toFixed(1)}`;
}

function dataNumber(value) {
  return Number(value).toFixed(1);
}

function signName(value) {
  if (value > 0) {
    return "positive";
  }
  if (value < 0) {
    return "negative";
  }
  return "zero";
}

function componentClass(componentKey) {
  return componentKey.toLowerCase().replaceAll("_", "-");
}

function rowKeyLabel(componentKey) {
  const labels = {
    SBE_SID: "SBE_SID",
    SBE_Alb: "SBE_Alb",
    SBE_UI: "SBE_UI",
    SBE_lactate: "SBE_lac",
    SBE_UI_non_lactate: "UI_non-lac",
  };
  return labels[componentKey] || componentKey;
}

function mobileComponentLabel(componentKey) {
  const labels = {
    SBE_SID: "Chloride / SID",
    SBE_Alb: "Albumin",
    SBE_UI: "Residual UI",
    SBE_lactate: "Lactate UI",
    SBE_UI_non_lactate: "Non-lactate UI",
  };
  return labels[componentKey] || componentKey;
}

function compactVisualLayout() {
  return window.matchMedia("(max-width: 560px)").matches;
}

function partitionVisualComponents(partition) {
  const components = [
    {
      key: "SBE_SID",
      label: "Chloride / SID",
      value: partition.sbe_sid,
    },
    {
      key: "SBE_Alb",
      label: "Albumin / weak acids",
      value: partition.sbe_alb,
    },
  ];

  if (partition.lactate) {
    components.push(
      {
        key: "SBE_lactate",
        label: "Lactate-attributable UI",
        value: partition.lactate.sbe_lactate,
      },
      {
        key: "SBE_UI_non_lactate",
        label: "Residual UI, non-lactate",
        value: partition.lactate.sbe_ui_non_lactate,
      },
    );
  } else {
    components.push({
      key: "SBE_UI",
      label: "Residual unmeasured ions",
      value: partition.sbe_ui,
    });
  }

  let cumulative = 0;
  return components.map((component, index) => {
    const start = cumulative;
    const end = start + component.value;
    cumulative = end;
    return {
      ...component,
      order: index + 1,
      start,
      end,
      sign: signName(component.value),
    };
  });
}

function niceDomainMax(values) {
  const maxAbs = Math.max(...values.map((value) => Math.abs(value)), 1);
  return Math.max(10, Math.ceil(maxAbs / 5) * 5);
}

function renderAnnotationList(annotations) {
  partitionAnnotations.replaceChildren();
  for (const annotation of annotations) {
    const item = document.createElement("li");
    item.dataset.annotation = annotation.key;
    item.textContent = annotation.text;
    partitionAnnotations.append(item);
  }
}

function visualAnnotations(partition, result) {
  const annotations = [];
  if (partition.offsetting_components_present) {
    annotations.push({
      key: "offset",
      text:
        "Total SBE is near zero, but the components do not cancel to normal; they cancel each other.",
    });
  }
  if (partition.sid_reference_adjusted) {
    annotations.push({
      key: "sid-reference-adjusted",
      text: "SID reference was adjusted because pH was outside the paper's 7.30-7.50 range.",
    });
  }
  if (partition.lactate) {
    annotations.push({
      key: "lactate-split",
      text:
        "Lactate is split from residual UI so the non-lactate unmeasured-ion effect remains visible.",
    });
  }
  if (result.narrative.cautions.some((note) => note.includes("chronic hypercapnia"))) {
    annotations.push({
      key: "chronic-hypercapnia",
      text:
        "Chronic hypercapnia can create a positive SID contribution via renal chloride loss.",
    });
  }
  return annotations;
}

function renderPartitionChart(result) {
  const partition = result.partition;
  const components = partitionVisualComponents(partition);
  const compact = compactVisualLayout();
  const domainMax = niceDomainMax([
    partition.sbe_total,
    ...components.flatMap((component) => [component.start, component.end, component.value]),
  ]);

  const width = compact ? 360 : 860;
  const plotLeft = compact ? 56 : 124;
  const plotRight = compact ? 340 : 812;
  const zeroX = (plotLeft + plotRight) / 2;
  const top = compact ? 84 : 74;
  const rowHeight = compact ? 60 : 52;
  const chartBottom = top + rowHeight * components.length - 18;
  const height = chartBottom + 72;
  const scaleX = (value) => zeroX + (value / domainMax) * ((plotRight - plotLeft) / 2);
  const ticks = [-domainMax, -domainMax / 2, 0, domainMax / 2, domainMax];

  const axisLines = ticks
    .map((tick) => {
      const x = scaleX(tick);
      const isZero = tick === 0;
      return `
        <line class="${isZero ? "zero-line" : "grid-line"}" x1="${x}" x2="${x}" y1="42" y2="${chartBottom}" />
        <text class="axis-label" x="${x}" y="${height - 24}" text-anchor="middle">${formatSigned(tick)}</text>
      `;
    })
    .join("");

  const rows = components
    .map((component) => {
      const y = top + (component.order - 1) * rowHeight;
      const startX = scaleX(component.start);
      const endX = scaleX(component.end);
      const x = Math.min(startX, endX);
      const segmentWidth = Math.max(Math.abs(endX - startX), 2);
      const midX = (startX + endX) / 2;
      const labelFits = segmentWidth >= 210;
      const fallbackX = component.value < 0 ? startX - 10 : startX + 10;
      const labelX = compact ? plotRight : labelFits ? midX : fallbackX;
      const anchor = compact ? "end" : labelFits ? "middle" : component.value < 0 ? "end" : "start";
      const labelText = compact
        ? `${formatSigned(component.value)} mmol/L`
        : `${component.label}: ${formatSigned(component.value)}`;
      const rowLabelText = compact ? mobileComponentLabel(component.key) : rowKeyLabel(component.key);
      const rowLabelY = compact ? y - 20 : y + 5;
      const segmentLabelY = compact ? y - 20 : y + 5;
      const nextY = y + rowHeight;
      const connector =
        component.order < components.length
          ? `<line class="step-connector" x1="${endX}" x2="${endX}" y1="${y + 14}" y2="${nextY - 14}" />`
          : "";

      return `
        <g class="partition-row" data-row="${component.order}">
          <text class="row-label" x="18" y="${rowLabelY}">${rowLabelText}</text>
          <line class="row-baseline" x1="${plotLeft}" x2="${plotRight}" y1="${y}" y2="${y}" />
          <rect
            class="partition-segment segment-${componentClass(component.key)}"
            data-component="${component.key}"
            data-order="${component.order}"
            data-sign="${component.sign}"
            data-value="${dataNumber(component.value)}"
            data-start="${dataNumber(component.start)}"
            data-end="${dataNumber(component.end)}"
            x="${x}"
            y="${y - 13}"
            width="${segmentWidth}"
            height="26"
            rx="4"
          />
          <text
            class="partition-segment-label"
            data-label-for="${component.key}"
            x="${labelX}"
            y="${segmentLabelY}"
            text-anchor="${anchor}"
          >${labelText}</text>
          ${connector}
        </g>
      `;
    })
    .join("");

  const totalX = scaleX(partition.sbe_total);
  const svg = `
    <svg
      class="visual-svg partition-svg"
      viewBox="0 0 ${width} ${height}"
      role="img"
      aria-labelledby="partition-svg-title partition-svg-desc"
      data-domain-max="${dataNumber(domainMax)}"
    >
      <title id="partition-svg-title">Base excess partition bar</title>
      <desc id="partition-svg-desc">
        Sequential Stewart Light components sum to measured SBE of ${formatSigned(
          partition.sbe_total,
        )} mmol/L.
      </desc>
      <text class="direction-label" x="${plotLeft}" y="24" text-anchor="start">Acidifying direction</text>
      <text class="direction-label" x="${plotRight}" y="24" text-anchor="end">Alkalinizing direction</text>
      <line class="axis-line" x1="${plotLeft}" x2="${plotRight}" y1="${height - 42}" y2="${height - 42}" />
      ${axisLines}
      ${rows}
      <line
        id="sbe-total-marker"
        class="total-marker"
        data-value="${dataNumber(partition.sbe_total)}"
        x1="${totalX}"
        x2="${totalX}"
        y1="38"
        y2="${chartBottom + 14}"
      />
      <text class="total-label" x="${totalX}" y="${chartBottom + 38}" text-anchor="middle">
        measured SBE ${formatSigned(partition.sbe_total)} mmol/L
      </text>
      <text class="axis-unit" x="${plotRight}" y="${height - 4}" text-anchor="end">mmol/L</text>
    </svg>
  `;

  partitionChart.innerHTML = svg;
  partitionChart.setAttribute(
    "aria-label",
    `Base excess partition. Components sum to measured SBE ${formatSigned(
      partition.sbe_total,
    )} mmol/L.`,
  );
  partitionSummary.className = "visual-summary";
  partitionSummary.textContent = `The visual steps reconstruct measured SBE ${formatSigned(
    partition.sbe_total,
  )} mmol/L from ${components.length} component${components.length === 1 ? "" : "s"}.`;
  renderAnnotationList(visualAnnotations(partition, result));
}

function renderTeachingDiagram(result) {
  const input = result.input;
  const partition = result.partition;
  const compact = compactVisualLayout();
  const sidGap = input.na_mmol_l - input.cl_mmol_l;
  const maxGap = Math.max(45, Math.abs(sidGap), Math.abs(partition.sid_reference));
  const width = compact ? 360 : 760;
  const height = compact ? 370 : 300;
  const xStart = compact ? 42 : 92;
  const xMax = compact ? 304 : 568;
  const gapWidth = Math.max(64, (Math.abs(sidGap) / maxGap) * (xMax - xStart));
  const refWidth = Math.max(64, (Math.abs(partition.sid_reference) / maxGap) * (xMax - xStart));
  const xCl = xStart + gapWidth;
  const xRef = xStart + refWidth;
  const residualLabel = partition.lactate
    ? `UI ${formatSigned(partition.sbe_ui)} total`
    : `UI ${formatSigned(partition.sbe_ui)}`;
  const sidAdjustment = partition.sid_reference_adjusted
    ? `<line class="reference-tick" x1="${xRef}" x2="${xRef}" y1="60" y2="142" />
       <text class="teaching-note" x="${xRef}" y="154" text-anchor="middle">${
         compact ? "pH SID ref" : "pH-adjusted SID ref"
       } ${formatNumber(
         partition.sid_reference,
       )}</text>`
    : "";
  const slots = compact
    ? [
        ["sid", 18, 204, 154, "SID effect", `SBE_SID ${formatSigned(partition.sbe_sid)}`],
        ["albumin", 188, 204, 154, "Weak acids", `SBE_Alb ${formatSigned(partition.sbe_alb)}`],
        ["bicarbonate", 18, 270, 154, "HCO3 space", `${formatNumber(input.hco3_mmol_l)} mmol/L`],
        ["ui", 188, 270, 154, "Residual UI", residualLabel],
      ]
    : [
        ["sid", 82, 198, 142, "SID effect", `SBE_SID ${formatSigned(partition.sbe_sid)}`],
        ["albumin", 234, 198, 154, "Weak acids", `SBE_Alb ${formatSigned(partition.sbe_alb)}`],
        ["bicarbonate", 398, 198, 132, "HCO3 space", `${formatNumber(input.hco3_mmol_l)} mmol/L`],
        ["ui", 540, 198, 138, "Residual UI", residualLabel],
      ];
  const conceptSlots = slots
    .map(
      ([key, x, y, slotWidth, title, value]) => `
        <g class="concept-slot" data-concept="${key}" transform="translate(${x} ${y})">
          <rect width="${slotWidth}" height="58" rx="6" />
          <text x="12" y="22">${title}</text>
          <text x="12" y="43">${value}</text>
        </g>
      `,
    )
    .join("");
  const footnote = compact
    ? "Educational simplification: minor ions omitted."
    : "Educational simplification: minor ions and full electroneutrality terms are intentionally omitted.";

  const svg = `
    <svg
      class="visual-svg teaching-svg"
      viewBox="0 0 ${width} ${height}"
      role="img"
      aria-labelledby="teaching-svg-title teaching-svg-desc"
    >
      <title id="teaching-svg-title">Simplified Stewart Light calliper diagram</title>
      <desc id="teaching-svg-desc">
        Sodium and chloride anchors define the SID gap; albumin and residual unmeasured ions are shown separately.
      </desc>
      <line class="anchor-line" x1="${xStart}" x2="${xStart}" y1="48" y2="168" />
      <line class="anchor-line" x1="${xCl}" x2="${xCl}" y1="48" y2="168" />
      <circle class="anchor-dot sodium-dot" cx="${xStart}" cy="62" r="8" />
      <circle class="anchor-dot chloride-dot" cx="${xCl}" cy="62" r="8" />
      <text class="anchor-label" x="${xStart}" y="34" text-anchor="middle">Na ${formatNumber(
        input.na_mmol_l,
      )}</text>
      <text class="anchor-label" x="${xCl}" y="34" text-anchor="middle">Cl ${formatNumber(
        input.cl_mmol_l,
      )}</text>
      <path class="sid-bracket" d="M ${xStart} 106 L ${xStart} 92 L ${xCl} 92 L ${xCl} 106" />
      <text class="sid-label" x="${(xStart + xCl) / 2}" y="126" text-anchor="middle">
        Na - Cl gap / SID ${formatNumber(sidGap)} mmol/L
      </text>
      ${sidAdjustment}
      ${conceptSlots}
      <text class="teaching-footnote" x="${compact ? 18 : 82}" y="${compact ? 348 : 282}">
        ${footnote}
      </text>
    </svg>
  `;

  teachingDiagram.innerHTML = svg;
  teachingDiagram.setAttribute(
    "aria-label",
    `Simplified calliper diagram. Sodium minus chloride is ${formatNumber(
      sidGap,
    )} mmol/L and SID reference is ${formatNumber(partition.sid_reference)} mmol/L.`,
  );
  teachingSummary.className = "visual-summary";
  teachingSummary.textContent = `Na - Cl is ${formatNumber(sidGap)} mmol/L. The Stewart Light model compares that strong-ion gap with the SID reference, then separates albumin and residual UI effects.`;
}

function renderVisuals(result) {
  renderPartitionChart(result);
  renderTeachingDiagram(result);
}

function renderResult(payload) {
  const { result, normalizedInputs } = payload;
  state.result = result;
  state.normalizedInputs = normalizedInputs;
  state.warnings = plausibleWarnings(normalizedInputs);

  headlineCard.replaceChildren();
  const heading = document.createElement("h3");
  heading.textContent = result.narrative.headline;
  const summary = document.createElement("p");
  summary.textContent = result.narrative.boston_summary;
  headlineCard.append(heading, summary);

  renderDefinitionList(bostonDetails, [
    ["pH state", result.boston.acid_base_state],
    ["Likely primary process", result.boston.primary_process_guess],
    ["Expected compensation", expectedCompensationText(result.boston)],
    ["Measured value", measuredValueText(result)],
    ["Interpretation", result.boston.measured_vs_expected],
    ["Mixed disorder suspected", result.boston.mixed_disorder_flag ? "Yes" : "No"],
  ]);

  const partition = result.partition;
  const stewartRows = [
    ["SID reference adjusted", partition.sid_reference_adjusted ? "Yes" : "No"],
    ["SID reference used", `${formatNumber(partition.sid_reference)} mmol/L`],
    ["SBE total", `${formatNumber(partition.sbe_total)} mmol/L`],
    ["SBE_SID", `${formatNumber(partition.sbe_sid)} mmol/L`],
    ["SBE_Alb", `${formatNumber(partition.sbe_alb)} mmol/L`],
    ["SBE_UI", `${formatNumber(partition.sbe_ui)} mmol/L`],
    ["Reconstructed SBE", `${formatNumber(partition.reconstructed_sbe)} mmol/L`],
    ["Closure error", `${formatNumber(partition.closure_error, 2)} mmol/L`],
    ["Offsetting components", partition.offsetting_components_present ? "Present" : "Not flagged"],
  ];
  if (partition.lactate) {
    stewartRows.splice(6, 0, [
      "SBE_lactate",
      `${formatNumber(partition.lactate.sbe_lactate)} mmol/L`,
    ]);
    stewartRows.splice(7, 0, [
      "SBE_UI non-lactate",
      `${formatNumber(partition.lactate.sbe_ui_non_lactate)} mmol/L`,
    ]);
  }
  renderDefinitionList(stewartDetails, stewartRows);

  whatAdds.textContent = result.narrative.what_it_adds;
  if (partition.offsetting_components_present) {
    whatAdds.textContent +=
      " In this case, total SBE is near zero, but the component breakdown shows offsetting abnormalities rather than true metabolic normality.";
  }
  const chronicCaution = result.narrative.cautions.find((note) =>
    note.includes("chronic hypercapnia"),
  );
  const overlay = result.chronic_hypercapnia_overlay;
  const comparisonCautionText = overlay.message || chronicCaution || overlay.soft_note;
  if (comparisonCautionText) {
    comparisonCaution.textContent = comparisonCautionText;
    comparisonCaution.hidden = false;
  } else {
    comparisonCaution.textContent = "";
    comparisonCaution.hidden = true;
  }
  renderComparisonExtras(result);

  renderList(limitationsList, result.narrative.limitations);
  renderList(cautionsList, result.narrative.cautions);

  renderDefinitionList(normalizedDetails, [
    [
      "PaCO2",
      `${formatNumber(normalizedInputs.pco2_mmhg)} mmHg (entered as ${state.inputs.pco2} ${state.inputs.pco2_unit})`,
    ],
    [
      "Albumin",
      `${formatNumber(normalizedInputs.albumin_g_l)} g/L (entered as ${state.inputs.albumin} ${state.inputs.albumin_unit})`,
    ],
    ["pH", formatNumber(normalizedInputs.ph, 2)],
    ["HCO3", `${formatNumber(normalizedInputs.hco3_mmol_l)} mmol/L`],
    ["SBE", `${formatNumber(normalizedInputs.sbe_mmol_l)} mmol/L`],
    [
      "Phosphate",
      normalizedInputs.phosphate_mmol_l === null
        ? "Not provided"
        : `${formatNumber(normalizedInputs.phosphate_mmol_l)} mmol/L`,
    ],
  ]);

  renderAnionGapContext(result);
  renderHydrogenContext(result);
  renderFollowUp(result);
  renderAdvancedBedside(result);
  renderCompensationMap(result);
  renderVisuals(result);
  applyViewToggles();
  renderMessages(formWarnings, state.warnings);
}

function clearResults() {
  state.result = null;
  state.normalizedInputs = null;
  headlineCard.replaceChildren();
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent =
    "Enter values and calculate to review the Boston view and Stewart Light partition.";
  headlineCard.append(empty);
  for (const container of [
    bostonDetails,
    stewartDetails,
    comparisonExtra,
    anionGapDetails,
    anionGapNotes,
    followUpTriggers,
    followUpPrompts,
    limitationsList,
    cautionsList,
    normalizedDetails,
    advancedBedsideDetails,
    compensationMap,
    partitionChart,
    partitionAnnotations,
    teachingDiagram,
  ]) {
    container.replaceChildren();
  }
  whatAdds.textContent = "";
  comparisonCaution.textContent = "";
  comparisonCaution.hidden = true;
  comparisonExtra.hidden = true;
  hydrogenChip.textContent = "";
  hydrogenNote.textContent = "";
  followUpCard.hidden = true;
  toxicologyCaveat.textContent = "";
  advancedBedsideNote.textContent = "";
  compensationMapNote.textContent = "";
  applyViewToggles();
  partitionSummary.className = "visual-summary empty-state";
  partitionSummary.textContent = "Calculate a case to see component direction and magnitude.";
  teachingSummary.className = "visual-summary empty-state";
  teachingSummary.textContent =
    "Calculate a case to see the conceptual SID, albumin, bicarbonate, and UI spaces.";
}

function populateExample(exampleKey) {
  const example = EXAMPLES[exampleKey];
  field("ph").value = example.ph;
  field("pco2").value = example.pco2;
  field("hco3").value = example.hco3;
  field("sbe").value = example.sbe;
  field("sodium").value = example.sodium;
  field("chloride").value = example.chloride;
  field("albumin").value = example.albumin;
  field("lactate").value = example.lactate;
  field("phosphate").value = example.phosphate;
  field("pco2-unit").value = example.pco2Unit;
  field("albumin-unit").value = example.albuminUnit;
  field("chronic-hypercapnia").checked = example.chronicHypercapnia;
}

async function calculateFromForm() {
  renderMessages(formErrors, []);
  renderMessages(formWarnings, []);

  if (!state.engineReady) {
    renderMessages(formErrors, [{ id: null, message: "Python engine is still loading." }]);
    return;
  }

  const { errors, input } = collectFormInputs();
  if (errors.length > 0) {
    renderMessages(formErrors, errors);
    const firstError = errors[0];
    if (firstError.id) {
      field(firstError.id).focus();
    }
    return;
  }

  state.inputs = input;
  calculateButton.disabled = true;
  calculateButton.textContent = "Calculating";
  setRuntimeStatus("Calculating with Python.", "loading");

  try {
    const payload = await requestWorker("calculate", { input });
    renderResult(payload);
    setRuntimeStatus("Ready: calculation complete.", "ready");
  } catch (error) {
    renderMessages(formErrors, [{ id: null, message: error.message }]);
    setRuntimeStatus("Ready: calculation error shown below.", "error");
  } finally {
    calculateButton.disabled = !state.engineReady;
    calculateButton.textContent = "Calculate";
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculateFromForm();
});

resetButton.addEventListener("click", () => {
  form.reset();
  renderMessages(formErrors, []);
  renderMessages(formWarnings, []);
  clearResults();
});

loadExampleButton.addEventListener("click", () => {
  populateExample(exampleSelect.value);
  calculateFromForm();
});

retryButton.addEventListener("click", () => {
  startWorker();
});

for (const toggle of [togglePrimary, toggleAdvanced, toggleCompensationMap]) {
  toggle.addEventListener("change", applyViewToggles);
}

window.addEventListener("resize", () => {
  if (state.result) {
    renderVisuals(state.result);
    renderCompensationMap(state.result);
  }
});

clearResults();
startWorker();

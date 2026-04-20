import { EXAMPLES } from "./examples.js";

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

function field(refs, id) {
  return refs.fields[id];
}

function parseNumber(refs, id, label, errors) {
  const input = field(refs, id);
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

export function collectFormInputs(refs) {
  const errors = [];
  const required = Object.fromEntries(
    REQUIRED_FIELDS.map(([id, label]) => [id, parseNumber(refs, id, label, errors)]),
  );

  const lactateRaw = field(refs, "lactate").value.trim();
  let lactate = null;
  if (lactateRaw) {
    lactate = Number(lactateRaw);
    if (!Number.isFinite(lactate)) {
      errors.push({ id: "lactate", message: "Lactate must be a valid number." });
    }
  }
  const phosphateRaw = field(refs, "phosphate").value.trim();
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
      errors.push({
        id,
        message: `${field(refs, id).closest("label").innerText.trim()} must be > 0.`,
      });
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
      pco2_unit: field(refs, "pco2-unit").value,
      albumin_unit: field(refs, "albumin-unit").value,
      suspect_chronic_hypercapnia: field(refs, "chronic-hypercapnia").checked,
    },
  };
}

export function plausibleWarnings(normalizedInputs) {
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

export function populateExample(refs, exampleKey) {
  const example = EXAMPLES[exampleKey];
  field(refs, "ph").value = example.ph;
  field(refs, "pco2").value = example.pco2;
  field(refs, "hco3").value = example.hco3;
  field(refs, "sbe").value = example.sbe;
  field(refs, "sodium").value = example.sodium;
  field(refs, "chloride").value = example.chloride;
  field(refs, "albumin").value = example.albumin;
  field(refs, "lactate").value = example.lactate;
  field(refs, "phosphate").value = example.phosphate;
  field(refs, "pco2-unit").value = example.pco2Unit;
  field(refs, "albumin-unit").value = example.albuminUnit;
  field(refs, "chronic-hypercapnia").checked = example.chronicHypercapnia;
}

import { plausibleWarnings } from "./input.js";
import { formatNumber, formatSigned, renderDefinitionList, renderList, renderMessages } from "./ui-utils.js";
import { renderCompensationMap, renderVisuals } from "./visuals.js";

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

function renderComparisonExtras(result, refs) {
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

  renderDefinitionList(refs.comparisonExtra, rows);
  refs.comparisonExtra.hidden = rows.length === 0;
}

function renderAnionGapContext(result, refs) {
  const ag = result.anion_gap;
  refs.anionGapDetails.dataset.flag = ag.anion_gap_flag;
  renderDefinitionList(refs.anionGapDetails, [
    ["Raw AG", `${formatNumber(ag.anion_gap_raw)} mmol/L`],
    ["Albumin-corrected AG", `${formatNumber(ag.anion_gap_corrected)} mmol/L`],
    ["Interpretation", anionGapFlagText(ag.anion_gap_flag)],
  ]);
  renderList(refs.anionGapNotes, ag.notes);
}

function renderHydrogenContext(result, refs) {
  refs.hydrogenChip.textContent = `pH ${formatNumber(result.input.ph, 2)} ≈ ${formatNumber(
    result.hydrogen.hydrogen_nmol_l,
    0,
  )} nmol/L H+`;
  refs.hydrogenNote.textContent = result.hydrogen.note;
}

function renderFollowUp(result, refs) {
  if (!result.follow_up.enabled) {
    refs.followUpCard.hidden = true;
    refs.followUpTriggers.replaceChildren();
    refs.followUpPrompts.replaceChildren();
    refs.toxicologyCaveat.textContent = "";
    return;
  }

  refs.followUpCard.hidden = false;
  renderList(refs.followUpTriggers, result.follow_up.trigger_reasons);
  renderList(refs.followUpPrompts, result.follow_up.prompts);
  refs.toxicologyCaveat.textContent = result.follow_up.toxicology_caveat || "";
  refs.toxicologyCaveat.hidden = !result.follow_up.toxicology_caveat;
}

function renderAdvancedBedside(result, refs) {
  const advanced = result.advanced_bedside;
  refs.advancedBedsideNote.textContent = advanced.note;
  renderDefinitionList(refs.advancedBedsideDetails, [
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

export function applyViewToggles(refs, state) {
  for (const card of refs.primaryViewCards) {
    card.hidden = !refs.toggles.primary.checked;
  }
  refs.advancedBedsideCard.hidden = !(state.result && refs.toggles.advanced.checked);
  refs.compensationMapCard.hidden = !(state.result && refs.toggles.compensationMap.checked);
}

export function renderResult(payload, refs, state) {
  const { result, normalizedInputs } = payload;
  state.result = result;
  state.normalizedInputs = normalizedInputs;
  state.warnings = plausibleWarnings(normalizedInputs);

  refs.headlineCard.replaceChildren();
  const heading = document.createElement("h3");
  heading.textContent = result.narrative.headline;
  const summary = document.createElement("p");
  summary.textContent = result.narrative.boston_summary;
  refs.headlineCard.append(heading, summary);

  renderDefinitionList(refs.bostonDetails, [
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
  renderDefinitionList(refs.stewartDetails, stewartRows);

  refs.whatAdds.textContent = result.narrative.what_it_adds;
  if (partition.offsetting_components_present) {
    refs.whatAdds.textContent +=
      " In this case, total SBE is near zero, but the component breakdown shows offsetting abnormalities rather than true metabolic normality.";
  }
  const chronicCaution = result.narrative.cautions.find((note) =>
    note.includes("chronic hypercapnia"),
  );
  const overlay = result.chronic_hypercapnia_overlay;
  const comparisonCautionText = overlay.message || chronicCaution || overlay.soft_note;
  if (comparisonCautionText) {
    refs.comparisonCaution.textContent = comparisonCautionText;
    refs.comparisonCaution.hidden = false;
  } else {
    refs.comparisonCaution.textContent = "";
    refs.comparisonCaution.hidden = true;
  }
  renderComparisonExtras(result, refs);

  renderList(refs.limitationsList, result.narrative.limitations);
  renderList(refs.cautionsList, result.narrative.cautions);

  renderDefinitionList(refs.normalizedDetails, [
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

  renderAnionGapContext(result, refs);
  renderHydrogenContext(result, refs);
  renderFollowUp(result, refs);
  renderAdvancedBedside(result, refs);
  renderCompensationMap(result, refs);
  renderVisuals(result, refs);
  applyViewToggles(refs, state);
  renderMessages(refs.formWarnings, state.warnings);
}

export function clearResults(refs, state) {
  state.result = null;
  state.normalizedInputs = null;
  refs.headlineCard.replaceChildren();
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent =
    "Enter values and calculate to review the Boston view and Stewart Light partition.";
  refs.headlineCard.append(empty);
  for (const container of [
    refs.bostonDetails,
    refs.stewartDetails,
    refs.comparisonExtra,
    refs.anionGapDetails,
    refs.anionGapNotes,
    refs.followUpTriggers,
    refs.followUpPrompts,
    refs.limitationsList,
    refs.cautionsList,
    refs.normalizedDetails,
    refs.advancedBedsideDetails,
    refs.compensationMap,
    refs.partitionChart,
    refs.partitionAnnotations,
    refs.teachingDiagram,
  ]) {
    container.replaceChildren();
  }
  refs.whatAdds.textContent = "";
  refs.comparisonCaution.textContent = "";
  refs.comparisonCaution.hidden = true;
  refs.comparisonExtra.hidden = true;
  refs.hydrogenChip.textContent = "";
  refs.hydrogenNote.textContent = "";
  refs.followUpCard.hidden = true;
  refs.toxicologyCaveat.textContent = "";
  refs.advancedBedsideNote.textContent = "";
  refs.compensationMapNote.textContent = "";
  applyViewToggles(refs, state);
  refs.partitionSummary.className = "visual-summary empty-state";
  refs.partitionSummary.textContent = "Calculate a case to see component direction and magnitude.";
  refs.teachingSummary.className = "visual-summary empty-state";
  refs.teachingSummary.textContent =
    "Calculate a case to see the conceptual SID, albumin, bicarbonate, and UI spaces.";
}

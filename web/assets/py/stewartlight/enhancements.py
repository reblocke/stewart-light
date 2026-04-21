"""Reference-informed educational enhancements for Stewart Light results."""

from __future__ import annotations

import math

from stewartlight.models import (
    AcidBaseInput,
    AdvancedBedsideDecomposition,
    AnionGapContext,
    ChronicHypercapniaOverlay,
    CompensationMap,
    FollowUpConsiderations,
    HydrogenContext,
    StewartPartition,
)

AG_LOW_NEGATIVE_THRESHOLD = 3.0
AG_ELEVATED_THRESHOLD = 12.0
AG_CLEARLY_ELEVATED_THRESHOLD = 16.0
MATERIAL_NEGATIVE_UI_THRESHOLD = -3.0
SEVERE_ACIDOSIS_SBE_THRESHOLD = -10.0
CHRONIC_SID_TOLERANCE = 1.0


def calculate_anion_gap_context(
    input_data: AcidBaseInput, partition: StewartPartition
) -> AnionGapContext:
    """Return no-potassium and albumin-corrected anion-gap context."""

    raw_ag = input_data.na_mmol_l - (input_data.cl_mmol_l + input_data.hco3_mmol_l)
    corrected_ag = raw_ag + 0.25 * (40.0 - input_data.albumin_g_l)

    if corrected_ag < AG_LOW_NEGATIVE_THRESHOLD:
        flag = "low_negative"
    elif corrected_ag >= AG_CLEARLY_ELEVATED_THRESHOLD:
        flag = "clearly_elevated"
    elif corrected_ag > AG_ELEVATED_THRESHOLD:
        flag = "elevated"
    else:
        flag = "not_elevated"

    notes = ["Normal anion-gap ranges vary by laboratory method; interpret with local ranges."]
    if flag in {"elevated", "clearly_elevated"} and partition.sbe_ui < 0:
        notes.append(
            "Corrected anion gap and Stewart Light residual UI are aligned toward unmeasured "
            "anions."
        )
    if (
        flag == "not_elevated"
        and partition.sbe_ui <= MATERIAL_NEGATIVE_UI_THRESHOLD
        and input_data.albumin_g_l < 35.0
    ):
        notes.append(
            "Hypoalbuminemia may mask a gap-based signal even when the corrected anion gap is "
            "not elevated."
        )
    if flag == "low_negative":
        notes.append(
            "Low or negative anion gaps can reflect low albumin, unmeasured cations, or "
            "laboratory context."
        )

    return AnionGapContext(
        anion_gap_raw=raw_ag,
        anion_gap_corrected=corrected_ag,
        anion_gap_flag=flag,
        notes=notes,
    )


def calculate_hydrogen_context(input_data: AcidBaseInput) -> HydrogenContext:
    """Return pH as hydrogen ion concentration in nmol/L."""

    return HydrogenContext(
        hydrogen_nmol_l=10 ** (9.0 - input_data.ph),
        note=(
            "Rough bedside rule: a 0.3-unit pH change is about a doubling or halving of "
            "hydrogen concentration."
        ),
    )


def calculate_advanced_bedside_decomposition(
    input_data: AcidBaseInput,
) -> AdvancedBedsideDecomposition:
    """Return the advanced water/chloride/albumin/other bedside decomposition."""

    water_effect = 0.3 * (input_data.na_mmol_l - 140.0)
    chloride_corrected = input_data.cl_mmol_l * (140.0 / input_data.na_mmol_l)
    chloride_effect = 102.0 - chloride_corrected
    albumin_effect_bedside = (0.148 * input_data.ph - 0.818) * (42.0 - input_data.albumin_g_l)
    phosphate_effect = None
    if input_data.phosphate_mmol_l is not None:
        phosphate_effect = (0.309 * (input_data.ph - 0.469)) * (0.8 - input_data.phosphate_mmol_l)

    phosphate_for_sum = 0.0 if phosphate_effect is None else phosphate_effect
    other_effect = input_data.sbe_mmol_l - (
        water_effect + chloride_effect + albumin_effect_bedside + phosphate_for_sum
    )

    return AdvancedBedsideDecomposition(
        water_effect=water_effect,
        chloride_corrected=chloride_corrected,
        chloride_effect=chloride_effect,
        albumin_effect_bedside=albumin_effect_bedside,
        phosphate_effect=phosphate_effect,
        other_effect=other_effect,
        note=(
            "Bedside physicochemical decomposition: a different partition of the same metabolic "
            "problem, not a competing diagnosis engine."
        ),
    )


def calculate_compensation_map(input_data: AcidBaseInput) -> CompensationMap:
    """Return educational SBE-vs-PaCO2 compensation-map values."""

    chronic_respiratory_sbe = 0.4 * (input_data.pco2_mmhg - 40.0)
    expected_acidosis = None
    expected_alkalosis = None
    if input_data.sbe_mmol_l < 0:
        expected_acidosis = 40.0 + input_data.sbe_mmol_l
    elif input_data.sbe_mmol_l > 0:
        expected_alkalosis = 40.0 + 0.6 * input_data.sbe_mmol_l

    closest_region = _closest_compensation_region(
        pco2_mmhg=input_data.pco2_mmhg,
        sbe_mmol_l=input_data.sbe_mmol_l,
        chronic_respiratory_sbe=chronic_respiratory_sbe,
        expected_pco2_from_sbe_acidosis=expected_acidosis,
        expected_pco2_from_sbe_alkalosis=expected_alkalosis,
    )

    return CompensationMap(
        patient_pco2_mmhg=input_data.pco2_mmhg,
        patient_sbe_mmol_l=input_data.sbe_mmol_l,
        normal_pco2_mmhg=40.0,
        normal_sbe_mmol_l=0.0,
        acute_respiratory_sbe=0.0,
        chronic_respiratory_sbe=chronic_respiratory_sbe,
        expected_pco2_from_sbe_acidosis=expected_acidosis,
        expected_pco2_from_sbe_alkalosis=expected_alkalosis,
        closest_region=closest_region,
        note=(
            "Educational cross-check only; Boston-rule compensation remains the primary "
            "respiratory assessment."
        ),
    )


def _closest_compensation_region(
    *,
    pco2_mmhg: float,
    sbe_mmol_l: float,
    chronic_respiratory_sbe: float,
    expected_pco2_from_sbe_acidosis: float | None,
    expected_pco2_from_sbe_alkalosis: float | None,
) -> str:
    if abs(pco2_mmhg - 40.0) <= 5.0 and abs(sbe_mmol_l) <= 2.0:
        return "near normal reference"

    distances: list[tuple[float, str]] = [
        (abs(sbe_mmol_l), "acute respiratory guide"),
        (abs(sbe_mmol_l - chronic_respiratory_sbe), "chronic respiratory guide"),
    ]
    if expected_pco2_from_sbe_acidosis is not None:
        distances.append(
            (abs(pco2_mmhg - expected_pco2_from_sbe_acidosis), "metabolic acidosis guide")
        )
    if expected_pco2_from_sbe_alkalosis is not None:
        distances.append(
            (abs(pco2_mmhg - expected_pco2_from_sbe_alkalosis), "metabolic alkalosis guide")
        )
    return min(distances, key=lambda item: item[0])[1]


def calculate_chronic_hypercapnia_overlay(
    input_data: AcidBaseInput, partition: StewartPartition
) -> ChronicHypercapniaOverlay:
    """Return SID compensation context for suspected chronic hypercapnia."""

    soft_note = None
    if input_data.pco2_mmhg > 40.0 and not input_data.suspect_chronic_hypercapnia:
        soft_note = (
            "PaCO2 is elevated; chronic compensation is one possible explanation only if the "
            "clinical context supports chronicity."
        )

    if not (input_data.suspect_chronic_hypercapnia and input_data.pco2_mmhg > 40.0):
        return ChronicHypercapniaOverlay(
            enabled=False,
            measured_sbe_sid=partition.sbe_sid,
            expected_sbe_sid_comp_min=None,
            expected_sbe_sid_comp_max=None,
            status=None,
            message=None,
            soft_note=soft_note,
        )

    pco2_delta = input_data.pco2_mmhg - 40.0
    expected_min = 0.3 * pco2_delta
    expected_max = 0.4 * pco2_delta
    if partition.sbe_sid < expected_min - CHRONIC_SID_TOLERANCE:
        status = "below_expected"
        message = "SID effect is less than expected for chronic compensation."
    elif partition.sbe_sid > expected_max + CHRONIC_SID_TOLERANCE:
        status = "above_expected"
        message = "SID effect exceeds what chronic hypercapnia alone would usually explain."
    else:
        status = "compatible"
        message = "SID effect appears broadly compatible with chronic hypercapnia compensation."

    return ChronicHypercapniaOverlay(
        enabled=True,
        measured_sbe_sid=partition.sbe_sid,
        expected_sbe_sid_comp_min=expected_min,
        expected_sbe_sid_comp_max=expected_max,
        status=status,
        message=message,
        soft_note=soft_note,
    )


def calculate_follow_up_considerations(
    input_data: AcidBaseInput,
    partition: StewartPartition,
    anion_gap: AnionGapContext,
) -> FollowUpConsiderations:
    """Return non-diagnostic prompts when unmeasured-anion patterns are present."""

    residual_ui = partition.sbe_ui
    if partition.lactate is not None:
        residual_ui = partition.lactate.sbe_ui_non_lactate

    trigger_reasons: list[str] = []
    if anion_gap.anion_gap_corrected >= AG_CLEARLY_ELEVATED_THRESHOLD:
        trigger_reasons.append("Corrected anion gap is clearly elevated.")
    if partition.sbe_ui <= MATERIAL_NEGATIVE_UI_THRESHOLD:
        trigger_reasons.append("Stewart Light residual UI is materially negative.")
    if (
        input_data.sbe_mmol_l <= SEVERE_ACIDOSIS_SBE_THRESHOLD
        and residual_ui <= MATERIAL_NEGATIVE_UI_THRESHOLD
    ):
        trigger_reasons.append("Severe acidosis remains partly unexplained by provided lactate.")

    if not trigger_reasons:
        return FollowUpConsiderations(
            enabled=False,
            trigger_reasons=[],
            prompts=[],
            toxicology_caveat=None,
        )

    return FollowUpConsiderations(
        enabled=True,
        trigger_reasons=trigger_reasons,
        prompts=[
            "Consider lactate.",
            "Consider ketones / beta-hydroxybutyrate.",
            "Consider renal failure / uremic anions.",
            "Consider salicylates / oxoproline / toxic alcohols if clinical context fits.",
        ],
        toxicology_caveat=(
            "The osmolal gap can be a clue, but a normal or modest osmolal gap does not "
            "reliably exclude toxic alcohol exposure."
        ),
    )


def isclose_zero(value: float, *, abs_tol: float = 1e-9) -> bool:
    """Return whether a value is close to zero."""

    return math.isclose(value, 0.0, abs_tol=abs_tol)

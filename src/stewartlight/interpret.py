"""Cautious interpretation helpers for Stewart Light results."""

from __future__ import annotations

from stewartlight.models import AcidBaseInput, BostonAssessment, NarrativeSummary, StewartPartition

NORMAL_PCO2_MMHG = 40.0
NORMAL_HCO3_MMOL_L = 24.0
LOW_PCO2_MMHG = 38.0
HIGH_PCO2_MMHG = 42.0
LOW_HCO3_MMOL_L = 22.0
HIGH_HCO3_MMOL_L = 26.0


def assess_boston(input_data: AcidBaseInput) -> BostonAssessment:
    """Return a pragmatic Boston-style compensation assessment.

    The primary-process guess intentionally uses transparent bedside heuristics rather than an
    expert system: pH state first, then PaCO2 and HCO3 direction relative to common normals.
    """

    acid_base_state = _acid_base_state(input_data.ph)
    primary_process_guess = _primary_process_guess(input_data, acid_base_state)
    notes: list[str] = []

    if "metabolic acidosis" in primary_process_guess:
        expected = _winters_expected_pco2(input_data.hco3_mmol_l)
        measured_vs_expected, mixed_flag = _compare_measured_pco2(
            input_data.pco2_mmhg,
            expected,
            high_text=(
                "measured PaCO2 is above the Winter's formula range, suggesting superimposed "
                "respiratory acidosis"
            ),
            low_text=(
                "measured PaCO2 is below the Winter's formula range, suggesting superimposed "
                "respiratory alkalosis"
            ),
        )
    elif "metabolic alkalosis" in primary_process_guess:
        expected = _metabolic_alkalosis_expected_pco2(input_data.hco3_mmol_l)
        measured_vs_expected, mixed_flag = _compare_measured_pco2(
            input_data.pco2_mmhg,
            expected,
            high_text=(
                "measured PaCO2 is above the expected range, which may reflect superimposed "
                "respiratory acidosis or limited ventilatory reserve"
            ),
            low_text=(
                "measured PaCO2 is below the expected range, suggesting superimposed "
                "respiratory alkalosis"
            ),
        )
        notes.append(
            "Compensation in metabolic alkalosis is variable; PaCO2 rarely rises far above 50 mmHg."
        )
    elif "respiratory acidosis" in primary_process_guess:
        expected = _respiratory_acidosis_expected_hco3(input_data.pco2_mmhg)
        measured_vs_expected, mixed_flag = _compare_respiratory_hco3(
            measured_hco3=input_data.hco3_mmol_l,
            expected=expected,
            low_text=(
                "measured HCO3 is lower than expected for acute/chronic respiratory acidosis, "
                "suggesting an additional metabolic acidosis"
            ),
            high_text=(
                "measured HCO3 is higher than expected for acute/chronic respiratory acidosis, "
                "suggesting an additional metabolic alkalosis"
            ),
            suspect_chronic=input_data.suspect_chronic_hypercapnia,
        )
        if input_data.suspect_chronic_hypercapnia:
            notes.append(
                "Chronic hypercapnia was flagged; the chronic HCO3 comparison is emphasized."
            )
        else:
            notes.append(
                "A single blood gas may not distinguish acute from chronic respiratory acidosis."
            )
    elif "respiratory alkalosis" in primary_process_guess:
        expected = _respiratory_alkalosis_expected_hco3(input_data.pco2_mmhg)
        measured_vs_expected, mixed_flag = _compare_respiratory_hco3(
            measured_hco3=input_data.hco3_mmol_l,
            expected=expected,
            low_text=(
                "measured HCO3 is lower than expected for acute/chronic respiratory alkalosis, "
                "suggesting an additional metabolic acidosis"
            ),
            high_text=(
                "measured HCO3 is higher than expected for acute/chronic respiratory alkalosis, "
                "suggesting an additional metabolic alkalosis"
            ),
            suspect_chronic=False,
        )
        notes.append(
            "A single blood gas may not distinguish acute from chronic respiratory alkalosis."
        )
    else:
        expected = {
            "not_applied": (
                "No single dominant Boston process was selected because pH is near-normal or "
                "the directions of PaCO2 and HCO3 are ambiguous."
            )
        }
        measured_vs_expected = (
            "Near-normal pH does not exclude compensated or mixed acid-base processes."
        )
        mixed_flag = acid_base_state == "near-normal pH" and (
            input_data.pco2_mmhg < LOW_PCO2_MMHG
            or input_data.pco2_mmhg > HIGH_PCO2_MMHG
            or input_data.hco3_mmol_l < LOW_HCO3_MMOL_L
            or input_data.hco3_mmol_l > HIGH_HCO3_MMOL_L
        )
        notes.append(
            "Boston compensation rules are most useful after choosing a likely primary process."
        )

    return BostonAssessment(
        acid_base_state=acid_base_state,
        primary_process_guess=primary_process_guess,
        expected_compensation=expected,
        measured_vs_expected=measured_vs_expected,
        mixed_disorder_flag=mixed_flag,
        notes=notes,
    )


def build_narrative(
    input_data: AcidBaseInput,
    partition: StewartPartition,
    boston: BostonAssessment,
) -> NarrativeSummary:
    """Build a cautious narrative summary from structured calculation results."""

    dominant_component = _dominant_stewart_component(partition)
    cautions: list[str] = []

    if partition.offsetting_components_present:
        cautions.append(
            "Near-normal total SBE may be masking offsetting metabolic components; this does not "
            "exclude clinically important mixed physiology."
        )

    if (
        input_data.suspect_chronic_hypercapnia
        and input_data.pco2_mmhg > NORMAL_PCO2_MMHG
        and partition.sbe_sid > 0
    ):
        cautions.append(
            "Positive SID contribution may partly reflect renal compensation to chronic "
            "hypercapnia rather than a separate metabolic alkalosis."
        )

    if partition.lactate is None:
        cautions.append(
            "Lactate was not provided, so residual unmeasured ions are not subpartitioned into "
            "lactate-attributable and non-lactate components."
        )

    headline = (
        f"{boston.primary_process_guess.capitalize()}; Stewart Light suggests "
        f"{dominant_component} is the largest metabolic component."
    )
    boston_summary = (
        f"Traditional/Boston assessment is consistent with {boston.acid_base_state}. "
        f"{boston.measured_vs_expected}."
    )
    stewart_light_summary = (
        f"Measured SBE {partition.sbe_total:.1f} mmol/L partitions into chloride/SID "
        f"{partition.sbe_sid:.1f}, albumin {partition.sbe_alb:.1f}, and residual "
        f"unmeasured ions {partition.sbe_ui:.1f} mmol/L."
    )
    if partition.lactate is not None:
        stewart_light_summary += (
            f" Lactate accounts for {partition.lactate.sbe_lactate:.1f} mmol/L, leaving "
            f"{partition.lactate.sbe_ui_non_lactate:.1f} mmol/L residual non-lactate UI."
        )

    return NarrativeSummary(
        headline=headline,
        boston_summary=boston_summary,
        stewart_light_summary=stewart_light_summary,
        what_it_adds=(
            "Stewart Light keeps the traditional compensation assessment, then partitions the "
            "metabolic component into strong-ion/chloride effects, albumin effects, and residual "
            "unmeasured ions. This does not exclude other interpretations or clinical context."
        ),
        limitations=[
            (
                "This is a pragmatic bedside decomposition of the metabolic component, not a "
                "full physicochemical model. It omits minor cations and depends on the measured "
                "blood-gas SBE."
            ),
            (
                "The output is an educational clinical reasoning aid and does not diagnose, "
                "confirm, or exclude a disorder by itself."
            ),
        ],
        cautions=cautions,
    )


def _acid_base_state(ph: float) -> str:
    if ph < 7.35:
        return "acidemia"
    if ph > 7.45:
        return "alkalemia"
    return "near-normal pH"


def _primary_process_guess(input_data: AcidBaseInput, acid_base_state: str) -> str:
    pco2_high = input_data.pco2_mmhg > HIGH_PCO2_MMHG
    pco2_low = input_data.pco2_mmhg < LOW_PCO2_MMHG
    hco3_high = input_data.hco3_mmol_l > HIGH_HCO3_MMOL_L
    hco3_low = input_data.hco3_mmol_l < LOW_HCO3_MMOL_L

    if acid_base_state == "acidemia":
        if hco3_low:
            return "metabolic acidosis likely"
        if pco2_high:
            return "respiratory acidosis likely"
        return "acidemia with unclear dominant process"

    if acid_base_state == "alkalemia":
        if hco3_high:
            return "metabolic alkalosis likely"
        if pco2_low:
            return "respiratory alkalosis likely"
        return "alkalemia with unclear dominant process"

    if pco2_high and hco3_high:
        return "near-normal pH with compensated respiratory acidosis or mixed process possible"
    if pco2_low and hco3_low:
        return "near-normal pH with compensated respiratory alkalosis or mixed process possible"
    if pco2_high or pco2_low or hco3_high or hco3_low:
        return "near-normal pH with compensated or mixed process possible"
    return "no clear primary process by simple Boston heuristics"


def _winters_expected_pco2(hco3_mmol_l: float) -> dict[str, object]:
    center = 1.5 * hco3_mmol_l + 8.0
    return {
        "process": "metabolic acidosis",
        "formula": "1.5 * HCO3 + 8 +/- 2",
        "center_mmhg": center,
        "lower_mmhg": center - 2.0,
        "upper_mmhg": center + 2.0,
    }


def _metabolic_alkalosis_expected_pco2(hco3_mmol_l: float) -> dict[str, object]:
    center = 0.7 * (hco3_mmol_l - 24.0) + 40.0
    return {
        "process": "metabolic alkalosis",
        "formula": "0.7 * (HCO3 - 24) + 40 +/- 5",
        "center_mmhg": center,
        "lower_mmhg": center - 5.0,
        "upper_mmhg": center + 5.0,
    }


def _respiratory_acidosis_expected_hco3(pco2_mmhg: float) -> dict[str, object]:
    delta = max(pco2_mmhg - 40.0, 0.0)
    return {
        "process": "respiratory acidosis",
        "acute_hco3_mmol_l": NORMAL_HCO3_MMOL_L + (delta / 10.0),
        "chronic_hco3_mmol_l": NORMAL_HCO3_MMOL_L + 4.0 * (delta / 10.0),
    }


def _respiratory_alkalosis_expected_hco3(pco2_mmhg: float) -> dict[str, object]:
    delta = max(40.0 - pco2_mmhg, 0.0)
    return {
        "process": "respiratory alkalosis",
        "acute_hco3_mmol_l": NORMAL_HCO3_MMOL_L - 2.0 * (delta / 10.0),
        "chronic_hco3_mmol_l": NORMAL_HCO3_MMOL_L - 5.0 * (delta / 10.0),
    }


def _compare_measured_pco2(
    measured_pco2: float,
    expected: dict[str, object],
    *,
    high_text: str,
    low_text: str,
) -> tuple[str, bool]:
    lower = float(expected["lower_mmhg"])
    upper = float(expected["upper_mmhg"])
    if measured_pco2 > upper:
        return f"{high_text} ({measured_pco2:.1f} vs expected {lower:.1f}-{upper:.1f})", True
    if measured_pco2 < lower:
        return f"{low_text} ({measured_pco2:.1f} vs expected {lower:.1f}-{upper:.1f})", True
    return (
        f"measured PaCO2 is within the expected range ({measured_pco2:.1f} vs "
        f"expected {lower:.1f}-{upper:.1f})",
        False,
    )


def _compare_respiratory_hco3(
    measured_hco3: float,
    expected: dict[str, object],
    *,
    low_text: str,
    high_text: str,
    suspect_chronic: bool,
) -> tuple[str, bool]:
    acute = float(expected["acute_hco3_mmol_l"])
    chronic = float(expected["chronic_hco3_mmol_l"])
    if suspect_chronic:
        lower = chronic - 3.0
        upper = chronic + 3.0
        if measured_hco3 < lower:
            return (
                f"{low_text} ({measured_hco3:.1f} vs chronic expected near {chronic:.1f})",
                True,
            )
        if measured_hco3 > upper:
            return (
                f"{high_text} ({measured_hco3:.1f} vs chronic expected near {chronic:.1f})",
                True,
            )
        return (
            f"measured HCO3 is near the chronic expected value ({measured_hco3:.1f} vs "
            f"{chronic:.1f})",
            False,
        )

    lower = min(acute, chronic) - 2.0
    upper = max(acute, chronic) + 2.0
    if measured_hco3 < lower:
        return f"{low_text} ({measured_hco3:.1f} vs expected {acute:.1f}/{chronic:.1f})", True
    if measured_hco3 > upper:
        return f"{high_text} ({measured_hco3:.1f} vs expected {acute:.1f}/{chronic:.1f})", True
    return (
        f"measured HCO3 is within the broad acute/chronic expected range "
        f"({measured_hco3:.1f} vs {acute:.1f}/{chronic:.1f})",
        False,
    )


def _dominant_stewart_component(partition: StewartPartition) -> str:
    components = {
        "chloride/SID effect": abs(partition.sbe_sid),
        "albumin/weak-acid effect": abs(partition.sbe_alb),
        "residual unmeasured ions": abs(partition.sbe_ui),
    }
    return max(components, key=components.get)

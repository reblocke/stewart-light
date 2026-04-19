"""Public calculator entrypoints for Stewart Light calculations."""

from __future__ import annotations

from stewartlight.enhancements import (
    calculate_advanced_bedside_decomposition,
    calculate_anion_gap_context,
    calculate_chronic_hypercapnia_overlay,
    calculate_compensation_map,
    calculate_follow_up_considerations,
    calculate_hydrogen_context,
)
from stewartlight.interpret import assess_boston, build_narrative
from stewartlight.models import (
    AcidBaseInput,
    DemoPayload,
    LactatePartition,
    StewartLightResult,
    StewartPartition,
)

OFFSETTING_TOTAL_SBE_THRESHOLD = 2.0
OFFSETTING_COMPONENT_THRESHOLD = 3.0


def healthcheck() -> dict[str, str]:
    """Return a small import/runtime status payload."""

    return {
        "status": "ok",
        "package": "stewartlight",
        "message": "Python package imported successfully.",
    }


def demo_payload() -> dict[str, object]:
    """Return a JSON-serializable synthetic payload for the web smoke test."""

    synthetic_input = AcidBaseInput(
        ph=7.22,
        pco2_mmhg=25.0,
        hco3_mmol_l=10.0,
        sbe_mmol_l=-18.0,
        na_mmol_l=140.0,
        cl_mmol_l=104.0,
        albumin_g_l=40.0,
        lactate_mmol_l=6.0,
        phosphate_mmol_l=None,
    )
    calculation = calculate_stewart_light(synthetic_input)

    payload = DemoPayload(
        status="ok",
        package="stewartlight",
        message="Pyodide loaded the staged Stewart Light Python package.",
        clinical_use="Synthetic educational demo only. This is not patient-specific advice.",
        units=list_supported_units(),
        calculation=calculation.to_dict(),
    )
    return payload.__dict__.copy()


def calculate_stewart_light(input_data: AcidBaseInput) -> StewartLightResult:
    """Calculate Stewart Light partitioning and Boston-style compensation.

    The function is pure and deterministic. It expects canonical units: PaCO2 in mmHg and albumin
    in g/L. Missing SBE is rejected by ``AcidBaseInput`` before calculation.
    """

    if not isinstance(input_data, AcidBaseInput):
        raise TypeError("calculate_stewart_light expects an AcidBaseInput instance.")

    sid_reference, sid_reference_adjusted = sid_reference_for_ph(input_data.ph)
    sbe_sid = input_data.na_mmol_l - input_data.cl_mmol_l - sid_reference
    sbe_alb = 0.3 * (40.0 - input_data.albumin_g_l)
    sbe_ui = input_data.sbe_mmol_l - sbe_sid - sbe_alb

    lactate_partition = None
    if input_data.lactate_mmol_l is not None:
        sbe_lactate = -input_data.lactate_mmol_l
        lactate_partition = LactatePartition(
            sbe_lactate=sbe_lactate,
            sbe_ui_non_lactate=sbe_ui - sbe_lactate,
        )

    reconstructed_sbe = sbe_sid + sbe_alb + sbe_ui
    closure_error = reconstructed_sbe - input_data.sbe_mmol_l
    offsetting_components_present = (
        abs(input_data.sbe_mmol_l) <= OFFSETTING_TOTAL_SBE_THRESHOLD
        and max(abs(sbe_sid), abs(sbe_alb), abs(sbe_ui)) >= OFFSETTING_COMPONENT_THRESHOLD
    )

    partition = StewartPartition(
        sbe_total=input_data.sbe_mmol_l,
        sid_reference=sid_reference,
        sid_reference_adjusted=sid_reference_adjusted,
        sbe_sid=sbe_sid,
        sbe_alb=sbe_alb,
        sbe_ui=sbe_ui,
        lactate=lactate_partition,
        reconstructed_sbe=reconstructed_sbe,
        closure_error=closure_error,
        offsetting_components_present=offsetting_components_present,
    )
    boston = assess_boston(input_data)
    narrative = build_narrative(input_data=input_data, partition=partition, boston=boston)
    anion_gap = calculate_anion_gap_context(input_data=input_data, partition=partition)
    hydrogen = calculate_hydrogen_context(input_data=input_data)
    advanced_bedside = calculate_advanced_bedside_decomposition(input_data=input_data)
    compensation_map = calculate_compensation_map(input_data=input_data)
    chronic_hypercapnia_overlay = calculate_chronic_hypercapnia_overlay(
        input_data=input_data,
        partition=partition,
    )
    follow_up = calculate_follow_up_considerations(
        input_data=input_data,
        partition=partition,
        anion_gap=anion_gap,
    )
    return StewartLightResult(
        input=input_data,
        partition=partition,
        boston=boston,
        narrative=narrative,
        anion_gap=anion_gap,
        hydrogen=hydrogen,
        advanced_bedside=advanced_bedside,
        compensation_map=compensation_map,
        chronic_hypercapnia_overlay=chronic_hypercapnia_overlay,
        follow_up=follow_up,
    )


def sid_reference_for_ph(ph: float) -> tuple[float, bool]:
    """Return the Stewart Light SID reference and whether pH adjustment was applied."""

    if 7.30 <= ph <= 7.50:
        return 35.0, False
    return 35.0 + 15.0 * (7.40 - ph), True


def list_supported_units() -> dict[str, str]:
    """Expose the current unit labels for the browser smoke payload."""

    from stewartlight.units import FOUNDATION_UNITS

    return dict(FOUNDATION_UNITS)

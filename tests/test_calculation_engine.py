from __future__ import annotations

import json

import pytest

from stewartlight import AcidBaseInput, StewartLightInputError, calculate_stewart_light
from stewartlight.units import albumin_g_dl_to_g_l, normalize_input_units, pco2_kpa_to_mmhg


def acid_base_input(**overrides: float | bool | None) -> AcidBaseInput:
    values: dict[str, float | bool | None] = {
        "ph": 7.40,
        "pco2_mmhg": 40.0,
        "hco3_mmol_l": 24.0,
        "sbe_mmol_l": 0.0,
        "na_mmol_l": 140.0,
        "cl_mmol_l": 105.0,
        "albumin_g_l": 40.0,
        "lactate_mmol_l": None,
        "phosphate_mmol_l": None,
        "suspect_chronic_hypercapnia": False,
    }
    values.update(overrides)
    return AcidBaseInput(**values)  # type: ignore[arg-type]


def test_sid_reference_inside_and_outside_adjustment_band() -> None:
    inside = calculate_stewart_light(acid_base_input(ph=7.40))
    low_boundary = calculate_stewart_light(acid_base_input(ph=7.30))
    high_boundary = calculate_stewart_light(acid_base_input(ph=7.50))
    low_ph = calculate_stewart_light(acid_base_input(ph=7.20, sbe_mmol_l=-8.0))
    high_ph = calculate_stewart_light(acid_base_input(ph=7.60, sbe_mmol_l=8.0))

    assert inside.partition.sid_reference == 35.0
    assert inside.partition.sid_reference_adjusted is False
    assert low_boundary.partition.sid_reference == 35.0
    assert low_boundary.partition.sid_reference_adjusted is False
    assert high_boundary.partition.sid_reference == 35.0
    assert high_boundary.partition.sid_reference_adjusted is False
    assert low_ph.partition.sid_reference == pytest.approx(38.0)
    assert low_ph.partition.sid_reference_adjusted is True
    assert high_ph.partition.sid_reference == pytest.approx(32.0)
    assert high_ph.partition.sid_reference_adjusted is True


def test_stewart_partition_sign_conventions_and_algebra() -> None:
    result = calculate_stewart_light(
        acid_base_input(na_mmol_l=140.0, cl_mmol_l=110.0, albumin_g_l=30.0, sbe_mmol_l=-10.0)
    )

    assert result.partition.sbe_sid == pytest.approx(-5.0)
    assert result.partition.sbe_alb == pytest.approx(3.0)
    assert result.partition.sbe_ui == pytest.approx(-8.0)
    assert result.partition.reconstructed_sbe == pytest.approx(-10.0)
    assert result.partition.closure_error == pytest.approx(0.0)


def test_albumin_can_contribute_acidosis_when_above_reference() -> None:
    result = calculate_stewart_light(acid_base_input(albumin_g_l=50.0, sbe_mmol_l=-3.0))

    assert result.partition.sbe_alb == pytest.approx(-3.0)


def test_lactate_subpartition_algebra() -> None:
    result = calculate_stewart_light(
        acid_base_input(
            na_mmol_l=140.0,
            cl_mmol_l=110.0,
            albumin_g_l=30.0,
            sbe_mmol_l=-10.0,
            lactate_mmol_l=6.0,
        )
    )

    assert result.partition.lactate is not None
    assert result.partition.lactate.sbe_lactate == pytest.approx(-6.0)
    assert result.partition.lactate.sbe_ui_non_lactate == pytest.approx(-2.0)


def test_result_payload_is_json_serializable() -> None:
    result = calculate_stewart_light(acid_base_input(lactate_mmol_l=2.0))

    encoded = json.dumps(result.to_dict())

    assert "Stewart Light" in encoded
    assert result.partition.closure_error == pytest.approx(0.0)


def test_missing_sbe_validation_is_clear() -> None:
    values = {
        "ph": 7.40,
        "pco2_mmhg": 40.0,
        "hco3_mmol_l": 24.0,
        "na_mmol_l": 140.0,
        "cl_mmol_l": 105.0,
        "albumin_g_l": 40.0,
    }

    with pytest.raises(StewartLightInputError, match="sbe_mmol_l is required"):
        AcidBaseInput.from_mapping(values)


def test_unit_normalization_helpers() -> None:
    assert pco2_kpa_to_mmhg(5.0) == pytest.approx(37.5030841352)
    assert albumin_g_dl_to_g_l(4.2) == pytest.approx(42.0)

    normalized = normalize_input_units(
        ph=7.40,
        pco2=5.0,
        hco3_mmol_l=24.0,
        sbe_mmol_l=0.0,
        na_mmol_l=140.0,
        cl_mmol_l=105.0,
        albumin=4.2,
        pco2_unit="kPa",
        albumin_unit="g/dL",
    )

    assert normalized.pco2_mmhg == pytest.approx(37.5030841352)
    assert normalized.albumin_g_l == pytest.approx(42.0)


def test_winters_formula_range() -> None:
    result = calculate_stewart_light(
        acid_base_input(ph=7.20, pco2_mmhg=26.0, hco3_mmol_l=12.0, sbe_mmol_l=-14.0)
    )
    expected = result.boston.expected_compensation

    assert result.boston.primary_process_guess == "metabolic acidosis likely"
    assert expected["center_mmhg"] == pytest.approx(26.0)
    assert expected["lower_mmhg"] == pytest.approx(24.0)
    assert expected["upper_mmhg"] == pytest.approx(28.0)
    assert result.boston.mixed_disorder_flag is False


def test_metabolic_alkalosis_expected_pco2() -> None:
    result = calculate_stewart_light(
        acid_base_input(ph=7.55, pco2_mmhg=48.4, hco3_mmol_l=36.0, sbe_mmol_l=12.0)
    )
    expected = result.boston.expected_compensation

    assert result.boston.primary_process_guess == "metabolic alkalosis likely"
    assert expected["center_mmhg"] == pytest.approx(48.4)
    assert expected["lower_mmhg"] == pytest.approx(43.4)
    assert expected["upper_mmhg"] == pytest.approx(53.4)
    assert any("rarely rises far above 50" in note for note in result.boston.notes)


def test_respiratory_acidosis_expected_hco3() -> None:
    result = calculate_stewart_light(
        acid_base_input(ph=7.25, pco2_mmhg=60.0, hco3_mmol_l=26.0, sbe_mmol_l=0.0)
    )
    expected = result.boston.expected_compensation

    assert result.boston.primary_process_guess == "respiratory acidosis likely"
    assert expected["acute_hco3_mmol_l"] == pytest.approx(26.0)
    assert expected["chronic_hco3_mmol_l"] == pytest.approx(32.0)


def test_respiratory_alkalosis_expected_hco3() -> None:
    result = calculate_stewart_light(
        acid_base_input(ph=7.55, pco2_mmhg=20.0, hco3_mmol_l=20.0, sbe_mmol_l=0.0)
    )
    expected = result.boston.expected_compensation

    assert result.boston.primary_process_guess == "respiratory alkalosis likely"
    assert expected["acute_hco3_mmol_l"] == pytest.approx(20.0)
    assert expected["chronic_hco3_mmol_l"] == pytest.approx(14.0)


def test_golden_unmeasured_ion_metabolic_acidosis() -> None:
    result = calculate_stewart_light(
        AcidBaseInput(
            ph=7.22,
            pco2_mmhg=25.0,
            hco3_mmol_l=10.0,
            sbe_mmol_l=-18.0,
            na_mmol_l=140.0,
            cl_mmol_l=104.0,
            albumin_g_l=40.0,
            lactate_mmol_l=6.0,
        )
    )

    assert result.partition.sbe_ui < -10.0
    assert result.partition.lactate is not None
    assert result.partition.lactate.sbe_ui_non_lactate < -5.0


def test_golden_hyperchloremic_sid_acidosis() -> None:
    result = calculate_stewart_light(
        AcidBaseInput(
            ph=7.28,
            pco2_mmhg=30.0,
            hco3_mmol_l=14.0,
            sbe_mmol_l=-12.0,
            na_mmol_l=140.0,
            cl_mmol_l=118.0,
            albumin_g_l=40.0,
        )
    )

    assert result.partition.sbe_sid < -10.0
    assert "chloride/SID" in result.narrative.stewart_light_summary


def test_golden_masked_near_normal_sbe() -> None:
    result = calculate_stewart_light(
        AcidBaseInput(
            ph=7.40,
            pco2_mmhg=40.0,
            hco3_mmol_l=24.0,
            sbe_mmol_l=0.0,
            na_mmol_l=140.0,
            cl_mmol_l=111.0,
            albumin_g_l=20.0,
        )
    )

    assert result.partition.sbe_sid == pytest.approx(-6.0)
    assert result.partition.sbe_alb == pytest.approx(6.0)
    assert result.partition.offsetting_components_present is True
    assert any("offsetting metabolic components" in note for note in result.narrative.cautions)


def test_golden_chronic_hypercapnia_caution() -> None:
    result = calculate_stewart_light(
        AcidBaseInput(
            ph=7.37,
            pco2_mmhg=60.0,
            hco3_mmol_l=32.0,
            sbe_mmol_l=8.0,
            na_mmol_l=145.0,
            cl_mmol_l=103.0,
            albumin_g_l=40.0,
            suspect_chronic_hypercapnia=True,
        )
    )

    assert result.partition.sbe_sid > 0
    assert any("chronic hypercapnia" in note for note in result.narrative.cautions)


def test_corrected_anion_gap_flags_and_notes() -> None:
    elevated = calculate_stewart_light(
        acid_base_input(
            ph=7.20,
            hco3_mmol_l=10.0,
            sbe_mmol_l=-18.0,
            na_mmol_l=140.0,
            cl_mmol_l=100.0,
            albumin_g_l=20.0,
        )
    )
    low = calculate_stewart_light(
        acid_base_input(
            hco3_mmol_l=20.0,
            sbe_mmol_l=-4.0,
            na_mmol_l=130.0,
            cl_mmol_l=120.0,
        )
    )

    assert elevated.anion_gap.anion_gap_raw == pytest.approx(30.0)
    assert elevated.anion_gap.anion_gap_corrected == pytest.approx(35.0)
    assert elevated.anion_gap.anion_gap_flag == "clearly_elevated"
    assert any("unmeasured anions" in note for note in elevated.anion_gap.notes)
    assert low.anion_gap.anion_gap_corrected == pytest.approx(-10.0)
    assert low.anion_gap.anion_gap_flag == "low_negative"
    assert any("Low or negative" in note for note in low.anion_gap.notes)


def test_hypoalbuminemia_can_mask_gap_based_signal() -> None:
    result = calculate_stewart_light(
        acid_base_input(
            hco3_mmol_l=24.0,
            sbe_mmol_l=-8.0,
            na_mmol_l=140.0,
            cl_mmol_l=112.0,
            albumin_g_l=20.0,
        )
    )

    assert result.anion_gap.anion_gap_raw == pytest.approx(4.0)
    assert result.anion_gap.anion_gap_corrected == pytest.approx(9.0)
    assert result.anion_gap.anion_gap_flag == "not_elevated"
    assert result.partition.sbe_ui < -3.0
    assert any("Hypoalbuminemia may mask" in note for note in result.anion_gap.notes)


def test_advanced_bedside_decomposition_formulas_with_phosphate() -> None:
    result = calculate_stewart_light(
        acid_base_input(
            ph=7.40,
            sbe_mmol_l=5.0,
            na_mmol_l=150.0,
            cl_mmol_l=100.0,
            albumin_g_l=30.0,
            phosphate_mmol_l=1.2,
        )
    )
    advanced = result.advanced_bedside

    assert advanced.water_effect == pytest.approx(3.0)
    assert advanced.chloride_corrected == pytest.approx(93.3333333333)
    assert advanced.chloride_effect == pytest.approx(8.6666666667)
    assert advanced.albumin_effect_bedside == pytest.approx((0.148 * 7.40 - 0.818) * 12.0)
    assert advanced.phosphate_effect == pytest.approx((0.309 * (7.40 - 0.469)) * (0.8 - 1.2))
    assert advanced.other_effect == pytest.approx(
        5.0
        - (
            advanced.water_effect
            + advanced.chloride_effect
            + advanced.albumin_effect_bedside
            + advanced.phosphate_effect
        )
    )


def test_advanced_bedside_decomposition_omits_optional_phosphate() -> None:
    result = calculate_stewart_light(acid_base_input())

    assert result.input.phosphate_mmol_l is None
    assert result.advanced_bedside.phosphate_effect is None


def test_hydrogen_concentration_conversion() -> None:
    result = calculate_stewart_light(acid_base_input(ph=7.40))

    assert result.hydrogen.hydrogen_nmol_l == pytest.approx(39.81071706)
    assert "doubling or halving" in result.hydrogen.note


def test_compensation_map_values() -> None:
    acidosis = calculate_stewart_light(
        acid_base_input(ph=7.20, pco2_mmhg=25.0, hco3_mmol_l=10.0, sbe_mmol_l=-15.0)
    )
    alkalosis = calculate_stewart_light(
        acid_base_input(ph=7.50, pco2_mmhg=46.0, hco3_mmol_l=32.0, sbe_mmol_l=10.0)
    )

    assert acidosis.compensation_map.acute_respiratory_sbe == pytest.approx(0.0)
    assert acidosis.compensation_map.chronic_respiratory_sbe == pytest.approx(-6.0)
    assert acidosis.compensation_map.expected_pco2_from_sbe_acidosis == pytest.approx(25.0)
    assert acidosis.compensation_map.expected_pco2_from_sbe_alkalosis is None
    assert alkalosis.compensation_map.expected_pco2_from_sbe_alkalosis == pytest.approx(46.0)


def test_chronic_hypercapnia_overlay_statuses() -> None:
    compatible = calculate_stewart_light(
        acid_base_input(
            pco2_mmhg=60.0,
            hco3_mmol_l=32.0,
            sbe_mmol_l=8.0,
            na_mmol_l=145.0,
            cl_mmol_l=103.0,
            suspect_chronic_hypercapnia=True,
        )
    )
    above = calculate_stewart_light(
        acid_base_input(
            pco2_mmhg=60.0,
            hco3_mmol_l=32.0,
            sbe_mmol_l=12.0,
            na_mmol_l=152.0,
            cl_mmol_l=101.0,
            suspect_chronic_hypercapnia=True,
        )
    )
    below = calculate_stewart_light(
        acid_base_input(
            pco2_mmhg=60.0,
            hco3_mmol_l=32.0,
            sbe_mmol_l=4.0,
            na_mmol_l=140.0,
            cl_mmol_l=105.0,
            suspect_chronic_hypercapnia=True,
        )
    )
    soft = calculate_stewart_light(acid_base_input(pco2_mmhg=60.0, hco3_mmol_l=32.0))

    assert compatible.chronic_hypercapnia_overlay.expected_sbe_sid_comp_min == pytest.approx(6.0)
    assert compatible.chronic_hypercapnia_overlay.expected_sbe_sid_comp_max == pytest.approx(8.0)
    assert compatible.chronic_hypercapnia_overlay.status == "compatible"
    assert above.chronic_hypercapnia_overlay.status == "above_expected"
    assert below.chronic_hypercapnia_overlay.status == "below_expected"
    assert soft.chronic_hypercapnia_overlay.enabled is False
    assert "chronicity" in str(soft.chronic_hypercapnia_overlay.soft_note)


def test_follow_up_considerations_and_copy_guardrails() -> None:
    result = calculate_stewart_light(
        acid_base_input(
            ph=7.20,
            pco2_mmhg=25.0,
            hco3_mmol_l=10.0,
            sbe_mmol_l=-18.0,
            na_mmol_l=140.0,
            cl_mmol_l=100.0,
            albumin_g_l=20.0,
        )
    )
    payload = result.to_dict()
    encoded = json.dumps(payload).lower()

    assert result.follow_up.enabled is True
    assert any("toxic alcohols" in prompt for prompt in result.follow_up.prompts)
    assert "does not reliably exclude toxic alcohol exposure" in str(
        result.follow_up.toxicology_caveat
    )
    for banned in [
        "proves",
        "more correct",
        "superior",
        "establishes causation",
        "uniquely mechanistic",
    ]:
        assert banned not in encoded

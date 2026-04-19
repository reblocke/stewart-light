from __future__ import annotations

import json

from stewartlight import AcidBaseInput, calculate_stewart_light, demo_payload, healthcheck


def test_healthcheck_contract() -> None:
    payload = healthcheck()
    assert payload["status"] == "ok"
    assert payload["package"] == "stewartlight"


def test_demo_payload_is_json_serializable() -> None:
    payload = demo_payload()
    encoded = json.dumps(payload)

    assert "stewartlight" in encoded
    assert payload["status"] == "ok"
    assert "Synthetic educational demo" in str(payload["clinical_use"])
    assert payload["calculation"]["partition"]["closure_error"] == 0.0


def test_public_calculation_api_contract() -> None:
    result = calculate_stewart_light(
        AcidBaseInput(
            ph=7.40,
            pco2_mmhg=40.0,
            hco3_mmol_l=24.0,
            sbe_mmol_l=0.0,
            na_mmol_l=140.0,
            cl_mmol_l=105.0,
            albumin_g_l=40.0,
        )
    )

    assert result.partition.sbe_total == 0.0
    assert result.boston.acid_base_state == "near-normal pH"
    assert (
        "Stewart Light keeps the traditional compensation assessment"
        in result.narrative.what_it_adds
    )
    assert result.anion_gap.anion_gap_flag == "not_elevated"
    assert result.hydrogen.hydrogen_nmol_l > 0

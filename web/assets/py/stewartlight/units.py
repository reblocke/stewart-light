"""Canonical unit labels and input normalization helpers."""

from __future__ import annotations

from typing import Literal

from stewartlight.models import AcidBaseInput, StewartLightInputError

Pco2Unit = Literal["mmHg", "kPa"]
AlbuminUnit = Literal["g/L", "g/dL"]
MMHG_PER_KPA = 7.500616827041697

FOUNDATION_UNITS: dict[str, str] = {
    "ph": "pH units",
    "pco2": "mmHg",
    "hco3": "mmol/L",
    "sbe": "mmol/L",
    "sodium": "mmol/L",
    "chloride": "mmol/L",
    "albumin": "g/L",
    "phosphate": "mmol/L",
}


def pco2_kpa_to_mmhg(value_kpa: float) -> float:
    """Convert PaCO2 from kPa to mmHg."""

    return value_kpa * MMHG_PER_KPA


def albumin_g_dl_to_g_l(value_g_dl: float) -> float:
    """Convert albumin from g/dL to g/L."""

    return value_g_dl * 10.0


def normalize_input_units(
    *,
    ph: float,
    pco2: float,
    hco3_mmol_l: float,
    sbe_mmol_l: float,
    na_mmol_l: float,
    cl_mmol_l: float,
    albumin: float,
    lactate_mmol_l: float | None = None,
    phosphate_mmol_l: float | None = None,
    pco2_unit: Pco2Unit = "mmHg",
    albumin_unit: AlbuminUnit = "g/L",
    suspect_chronic_hypercapnia: bool = False,
) -> AcidBaseInput:
    """Normalize UI-facing units and return canonical calculator input."""

    if pco2_unit == "mmHg":
        pco2_mmhg = pco2
    elif pco2_unit == "kPa":
        pco2_mmhg = pco2_kpa_to_mmhg(pco2)
    else:
        raise StewartLightInputError("pco2_unit must be 'mmHg' or 'kPa'.")

    if albumin_unit == "g/L":
        albumin_g_l = albumin
    elif albumin_unit == "g/dL":
        albumin_g_l = albumin_g_dl_to_g_l(albumin)
    else:
        raise StewartLightInputError("albumin_unit must be 'g/L' or 'g/dL'.")

    return AcidBaseInput(
        ph=ph,
        pco2_mmhg=pco2_mmhg,
        hco3_mmol_l=hco3_mmol_l,
        sbe_mmol_l=sbe_mmol_l,
        na_mmol_l=na_mmol_l,
        cl_mmol_l=cl_mmol_l,
        albumin_g_l=albumin_g_l,
        lactate_mmol_l=lactate_mmol_l,
        phosphate_mmol_l=phosphate_mmol_l,
        suspect_chronic_hypercapnia=suspect_chronic_hypercapnia,
    )

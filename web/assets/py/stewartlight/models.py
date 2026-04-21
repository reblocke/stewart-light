"""Public data models for the Stewart Light calculation engine."""

from __future__ import annotations

import math
from collections.abc import Mapping
from dataclasses import dataclass, fields, is_dataclass

REQUIRED_INPUT_FIELDS = (
    "ph",
    "pco2_mmhg",
    "hco3_mmol_l",
    "sbe_mmol_l",
    "na_mmol_l",
    "cl_mmol_l",
    "albumin_g_l",
)


class StewartLightInputError(ValueError):
    """Raised when an input cannot be interpreted as canonical Stewart Light data."""


def _missing_field_message(field_name: str) -> str:
    if field_name == "sbe_mmol_l":
        return (
            "sbe_mmol_l is required because Stewart Light v1 depends on measured "
            "blood-gas standard base excess (SBE); SBE is not estimated from pH or HCO3."
        )
    return f"{field_name} is required for Stewart Light calculation."


def _coerce_float(field_name: str, value: object) -> float:
    if value is None:
        raise StewartLightInputError(_missing_field_message(field_name))
    if isinstance(value, bool):
        raise StewartLightInputError(f"{field_name} must be a number, not a boolean.")
    try:
        numeric_value = float(value)
    except (TypeError, ValueError) as error:
        raise StewartLightInputError(f"{field_name} must be a finite number.") from error
    if not math.isfinite(numeric_value):
        raise StewartLightInputError(f"{field_name} must be a finite number.")
    return numeric_value


def _validate_positive(field_name: str, value: float) -> None:
    if value <= 0:
        raise StewartLightInputError(f"{field_name} must be greater than zero.")


def _validate_nonnegative(field_name: str, value: float) -> None:
    if value < 0:
        raise StewartLightInputError(f"{field_name} must be greater than or equal to zero.")


def to_json_dict(value: object) -> dict[str, object]:
    """Return a JSON-friendly dictionary for a dataclass result object."""

    converted = _to_json_value(value)
    if not isinstance(converted, dict):
        raise TypeError("Expected a dataclass or dictionary value.")
    return converted


def _to_json_value(value: object) -> object:
    if is_dataclass(value) and not isinstance(value, type):
        return {field.name: _to_json_value(getattr(value, field.name)) for field in fields(value)}
    if isinstance(value, Mapping):
        return {str(key): _to_json_value(item) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [_to_json_value(item) for item in value]
    return value


@dataclass(frozen=True)
class AcidBaseInput:
    """Canonical acid-base inputs consumed by the Stewart Light calculator.

    The core calculator expects PaCO2 in mmHg and albumin in g/L. Unit conversion belongs at
    the UI/input-normalization boundary, not inside the calculator.
    """

    ph: float
    pco2_mmhg: float
    hco3_mmol_l: float
    sbe_mmol_l: float
    na_mmol_l: float
    cl_mmol_l: float
    albumin_g_l: float
    lactate_mmol_l: float | None = None
    phosphate_mmol_l: float | None = None
    suspect_chronic_hypercapnia: bool = False

    def __post_init__(self) -> None:
        for field_name in REQUIRED_INPUT_FIELDS:
            _coerce_float(field_name, getattr(self, field_name))

        _validate_positive("ph", float(self.ph))
        _validate_positive("pco2_mmhg", float(self.pco2_mmhg))
        _validate_positive("hco3_mmol_l", float(self.hco3_mmol_l))
        _validate_positive("na_mmol_l", float(self.na_mmol_l))
        _validate_positive("cl_mmol_l", float(self.cl_mmol_l))
        _validate_nonnegative("albumin_g_l", float(self.albumin_g_l))

        if self.lactate_mmol_l is not None:
            lactate = _coerce_float("lactate_mmol_l", self.lactate_mmol_l)
            _validate_nonnegative("lactate_mmol_l", lactate)

        if self.phosphate_mmol_l is not None:
            phosphate = _coerce_float("phosphate_mmol_l", self.phosphate_mmol_l)
            _validate_nonnegative("phosphate_mmol_l", phosphate)

        if not isinstance(self.suspect_chronic_hypercapnia, bool):
            raise StewartLightInputError("suspect_chronic_hypercapnia must be a boolean.")

    @classmethod
    def from_mapping(cls, data: Mapping[str, object]) -> AcidBaseInput:
        """Build canonical input from a mapping and raise clear validation errors."""

        missing = [name for name in REQUIRED_INPUT_FIELDS if name not in data or data[name] is None]
        if missing:
            messages = [_missing_field_message(field_name) for field_name in missing]
            raise StewartLightInputError(" ".join(messages))

        values = {name: _coerce_float(name, data[name]) for name in REQUIRED_INPUT_FIELDS}
        lactate_value = data.get("lactate_mmol_l")
        lactate = None if lactate_value is None else _coerce_float("lactate_mmol_l", lactate_value)
        phosphate_value = data.get("phosphate_mmol_l")
        phosphate = (
            None if phosphate_value is None else _coerce_float("phosphate_mmol_l", phosphate_value)
        )

        return cls(
            **values,
            lactate_mmol_l=lactate,
            phosphate_mmol_l=phosphate,
            suspect_chronic_hypercapnia=bool(data.get("suspect_chronic_hypercapnia", False)),
        )

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-friendly representation."""

        return to_json_dict(self)


@dataclass(frozen=True)
class LactatePartition:
    """Optional lactate subpartition of residual unmeasured-ion SBE."""

    sbe_lactate: float
    sbe_ui_non_lactate: float

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-friendly representation."""

        return to_json_dict(self)


@dataclass(frozen=True)
class StewartPartition:
    """Stewart Light partition of measured standard base excess."""

    sbe_total: float
    sid_reference: float
    sid_reference_adjusted: bool
    sbe_sid: float
    sbe_alb: float
    sbe_ui: float
    lactate: LactatePartition | None
    reconstructed_sbe: float
    closure_error: float
    offsetting_components_present: bool

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-friendly representation."""

        return to_json_dict(self)


@dataclass(frozen=True)
class BostonAssessment:
    """Traditional/Boston-style acid-base compensation assessment."""

    acid_base_state: str
    primary_process_guess: str
    expected_compensation: dict[str, object]
    measured_vs_expected: str
    mixed_disorder_flag: bool
    notes: list[str]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-friendly representation."""

        return to_json_dict(self)


@dataclass(frozen=True)
class NarrativeSummary:
    """Cautious human-readable interpretation for educational use."""

    headline: str
    boston_summary: str
    stewart_light_summary: str
    what_it_adds: str
    limitations: list[str]
    cautions: list[str]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-friendly representation."""

        return to_json_dict(self)


@dataclass(frozen=True)
class AnionGapContext:
    """Albumin-corrected anion-gap context for guarded interpretation."""

    anion_gap_raw: float
    anion_gap_corrected: float
    anion_gap_flag: str
    notes: list[str]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-friendly representation."""

        return to_json_dict(self)


@dataclass(frozen=True)
class HydrogenContext:
    """Compact pH-to-hydrogen concentration teaching aid."""

    hydrogen_nmol_l: float
    note: str

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-friendly representation."""

        return to_json_dict(self)


@dataclass(frozen=True)
class AdvancedBedsideDecomposition:
    """Advanced water/chloride/albumin/other bedside decomposition."""

    water_effect: float
    chloride_corrected: float
    chloride_effect: float
    albumin_effect_bedside: float
    phosphate_effect: float | None
    other_effect: float
    note: str

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-friendly representation."""

        return to_json_dict(self)


@dataclass(frozen=True)
class CompensationMap:
    """Educational SBE-vs-PaCO2 compensation-map values."""

    patient_pco2_mmhg: float
    patient_sbe_mmol_l: float
    normal_pco2_mmhg: float
    normal_sbe_mmol_l: float
    acute_respiratory_sbe: float
    chronic_respiratory_sbe: float
    expected_pco2_from_sbe_acidosis: float | None
    expected_pco2_from_sbe_alkalosis: float | None
    closest_region: str
    note: str

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-friendly representation."""

        return to_json_dict(self)


@dataclass(frozen=True)
class ChronicHypercapniaOverlay:
    """Quantitative chronic hypercapnia/SID compensation context."""

    enabled: bool
    measured_sbe_sid: float
    expected_sbe_sid_comp_min: float | None
    expected_sbe_sid_comp_max: float | None
    status: str | None
    message: str | None
    soft_note: str | None

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-friendly representation."""

        return to_json_dict(self)


@dataclass(frozen=True)
class FollowUpConsiderations:
    """Non-diagnostic follow-up prompts for unexplained high-gap/UI acidosis patterns."""

    enabled: bool
    trigger_reasons: list[str]
    prompts: list[str]
    toxicology_caveat: str | None

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-friendly representation."""

        return to_json_dict(self)


@dataclass(frozen=True)
class StewartLightResult:
    """Complete JSON-friendly Stewart Light calculation result."""

    input: AcidBaseInput
    partition: StewartPartition
    boston: BostonAssessment
    narrative: NarrativeSummary
    anion_gap: AnionGapContext
    hydrogen: HydrogenContext
    advanced_bedside: AdvancedBedsideDecomposition
    compensation_map: CompensationMap
    chronic_hypercapnia_overlay: ChronicHypercapniaOverlay
    follow_up: FollowUpConsiderations

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-friendly representation."""

        return to_json_dict(self)


@dataclass(frozen=True)
class DemoPayload:
    """Browser smoke-test payload returned by the Python package."""

    status: str
    package: str
    message: str
    clinical_use: str
    units: dict[str, str]
    calculation: dict[str, object]

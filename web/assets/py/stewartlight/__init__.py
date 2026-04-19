"""Stewart Light educational calculator foundation."""

from stewartlight.calculator import calculate_stewart_light, demo_payload, healthcheck
from stewartlight.models import AcidBaseInput, StewartLightInputError, StewartLightResult

__version__ = "0.1.0"

__all__ = [
    "__version__",
    "AcidBaseInput",
    "StewartLightInputError",
    "StewartLightResult",
    "calculate_stewart_light",
    "demo_payload",
    "healthcheck",
]

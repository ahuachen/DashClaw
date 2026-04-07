"""Validate organism.json configuration files."""
import json
from pathlib import Path
from typing import Any


REQUIRED_SECTIONS = ["identity", "boundaries", "quality_standards"]
REQUIRED_IDENTITY_FIELDS = ["name", "purpose", "philosophy"]
REQUIRED_BOUNDARY_FIELDS = ["growth_zone", "forbidden_zone"]
REQUIRED_QUALITY_FIELDS = ["test_coverage_floor", "max_complexity_per_function", "max_file_length"]


def validate_organism(config: dict[str, Any]) -> list[str]:
    """Validate an organism config dict. Returns list of error strings (empty = valid)."""
    errors: list[str] = []

    for section in REQUIRED_SECTIONS:
        if section not in config:
            errors.append(f"Missing required section: {section}")

    if "identity" in config:
        identity = config["identity"]
        for field_name in REQUIRED_IDENTITY_FIELDS:
            if field_name not in identity:
                errors.append(f"Missing required field: identity.{field_name}")

    if "boundaries" in config:
        boundaries = config["boundaries"]
        for field_name in REQUIRED_BOUNDARY_FIELDS:
            if field_name not in boundaries:
                errors.append(f"Missing required field: boundaries.{field_name}")

    if "quality_standards" in config:
        qs = config["quality_standards"]
        for field_name in REQUIRED_QUALITY_FIELDS:
            if field_name not in qs:
                errors.append(f"Missing required field: quality_standards.{field_name}")

    return errors


def load_organism(filepath: str) -> tuple[dict[str, Any] | None, list[str]]:
    """Load and validate an organism.json file. Returns (config, errors)."""
    path = Path(filepath)
    if not path.exists():
        return None, [f"organism.json not found at: {filepath}"]
    try:
        with open(path) as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        return None, [f"Invalid JSON in organism.json: {e}"]
    errors = validate_organism(config)
    return config, errors

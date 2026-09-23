"""Durable schedule model and cron calculation for Ting workflows."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def _field_matches(value: int, spec: str, *, minimum: int, maximum: int) -> bool:
    for part in spec.split(","):
        part = part.strip()
        if not part:
            return False
        if "/" in part:
            base, raw_step = part.split("/", 1)
            step = int(raw_step)
            if step <= 0:
                return False
            start = minimum if base == "*" else int(base)
            if start < minimum or start > maximum:
                return False
            if value >= start and (value - start) % step == 0:
                return True
            continue
        if part == "*":
            return True
        if "-" in part:
            raw_low, raw_high = part.split("-", 1)
            low, high = int(raw_low), int(raw_high)
            if low < minimum or high > maximum or low > high:
                return False
            if low <= value <= high:
                return True
            continue
        parsed = int(part)
        if parsed < minimum or parsed > maximum:
            return False
        if value == parsed:
            return True
    return False


def cron_matches(expression: str, value: datetime) -> bool:
    """Return whether a five-field cron expression matches *value*."""
    fields = expression.split()
    if len(fields) != 5:
        return False
    minute, hour, day, month, weekday = fields
    try:
        return (
            _field_matches(value.minute, minute, minimum=0, maximum=59)
            and _field_matches(value.hour, hour, minimum=0, maximum=23)
            and _field_matches(value.day, day, minimum=1, maximum=31)
            and _field_matches(value.month, month, minimum=1, maximum=12)
            and _field_matches(
                (value.weekday() + 1) % 7,
                weekday,
                minimum=0,
                maximum=6,
            )
        )
    except (TypeError, ValueError):
        return False


def next_cron_occurrence(expression: str, timezone: str, after: datetime) -> datetime:
    """Return the next matching instant in UTC, with minute precision."""
    try:
        zone = ZoneInfo(timezone)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f"Unknown timezone: {timezone}") from exc
    cursor = after.astimezone(UTC).replace(second=0, microsecond=0) + timedelta(minutes=1)
    for _ in range(366 * 24 * 60):
        if cron_matches(expression, cursor.astimezone(zone)):
            return cursor
        cursor += timedelta(minutes=1)
    raise ValueError("Schedule has no occurrence in the next 366 days")


@dataclass(frozen=True)
class WorkflowSchedule:
    id: UUID
    workflow_id: UUID
    owner_id: str
    tenant_id: str
    cron_expression: str
    timezone: str
    prompt: str
    session_name: str | None
    repo: str
    branch: str
    connection_id: str | None
    enabled: bool
    next_run_at: datetime
    created_at: datetime
    updated_at: datetime
    last_run_at: datetime | None = None
    last_session_id: str | None = None
    last_status: str | None = None
    last_error: str | None = None

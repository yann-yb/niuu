from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from ting.domain.services.workflow_scheduler import WorkflowScheduler
from ting.domain.workflow_schedule import WorkflowSchedule, cron_matches, next_cron_occurrence


def schedule(**overrides) -> WorkflowSchedule:
    now = datetime(2026, 9, 23, 20, 0, tzinfo=UTC)
    base = WorkflowSchedule(
        id=uuid4(),
        workflow_id=uuid4(),
        owner_id="dev-user",
        tenant_id="default",
        cron_expression="0 8 * * *",
        timezone="America/Los_Angeles",
        prompt="Daily scan",
        session_name="daily-scan",
        repo="",
        branch="",
        connection_id=None,
        enabled=True,
        next_run_at=now,
        created_at=now,
        updated_at=now,
    )
    return replace(base, **overrides)


def test_cron_matches_ranges_steps_and_lists() -> None:
    value = datetime(2026, 9, 23, 8, 30)
    assert cron_matches("*/15 8-10 * * 1,3,5", value)
    assert not cron_matches("0 9 * * *", value)
    assert not cron_matches("not cron", value)


def test_next_occurrence_respects_timezone() -> None:
    after = datetime(2026, 9, 23, 20, 0, tzinfo=UTC)
    assert next_cron_occurrence("0 8 * * *", "America/Los_Angeles", after) == datetime(
        2026, 9, 24, 15, 0, tzinfo=UTC
    )


def test_next_occurrence_rejects_unknown_timezone() -> None:
    with pytest.raises(ValueError, match="Unknown timezone"):
        next_cron_occurrence("0 8 * * *", "Mars/Olympus", datetime.now(UTC))


@pytest.mark.asyncio
async def test_scheduler_records_successful_launch() -> None:
    item = schedule()

    class Repo:
        def __init__(self) -> None:
            self.result = None

        async def claim_due(self, now, limit=10):
            return [item]

        async def record_result(self, schedule_id, **result):
            self.result = (schedule_id, result)

    repo = Repo()
    scheduler = WorkflowScheduler(
        repo, lambda _: _launch_result(), lambda _schedule, _session_id: _reuse_result()
    )
    assert await scheduler.tick(item.next_run_at) == 1
    assert repo.result is not None
    assert repo.result[1]["session_id"] == "session-1"
    assert repo.result[1]["status"] == "created"


async def _launch_result() -> tuple[str, str]:
    return "session-1", "created"


async def _reuse_result() -> str:
    return "running"


@pytest.mark.asyncio
async def test_scheduler_reuses_existing_session() -> None:
    item = schedule(last_session_id="session-existing")

    class Repo:
        def __init__(self) -> None:
            self.result = None

        async def record_result(self, schedule_id, **result):
            self.result = (schedule_id, result)

    launch_calls = 0
    reuse_calls = []

    async def launch(_schedule):
        nonlocal launch_calls
        launch_calls += 1
        return "session-new", "created"

    async def reuse(existing_schedule, session_id):
        reuse_calls.append((existing_schedule, session_id))
        return "running"

    repo = Repo()
    scheduler = WorkflowScheduler(repo, launch, reuse)

    assert await scheduler.run_schedule(item) == ("session-existing", "running")
    assert launch_calls == 0
    assert reuse_calls == [(item, "session-existing")]
    assert repo.result is not None
    assert repo.result[1]["session_id"] == "session-existing"
    assert repo.result[1]["status"] == "running"


@pytest.mark.asyncio
async def test_scheduler_keeps_existing_session_when_reuse_fails() -> None:
    item = schedule(last_session_id="session-existing")

    class Repo:
        def __init__(self) -> None:
            self.result = None

        async def record_result(self, schedule_id, **result):
            self.result = (schedule_id, result)

    async def launch(_schedule):
        return "session-new", "created"

    async def reuse(_schedule, _session_id):
        raise RuntimeError("session unavailable")

    repo = Repo()
    scheduler = WorkflowScheduler(repo, launch, reuse)

    with pytest.raises(RuntimeError, match="session unavailable"):
        await scheduler.run_schedule(item)

    assert repo.result is not None
    assert repo.result[1]["session_id"] == "session-existing"
    assert repo.result[1]["status"] == "failed"
    assert repo.result[1]["error"] == "session unavailable"

"""Background runner for durable Ting workflow schedules."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

from ting.domain.workflow_schedule import WorkflowSchedule
from ting.ports.workflow_schedule_repository import WorkflowScheduleRepository

logger = logging.getLogger(__name__)

ScheduleLauncher = Callable[[WorkflowSchedule], Awaitable[tuple[str, str]]]
ScheduleSessionReuser = Callable[[WorkflowSchedule, str], Awaitable[str]]


class WorkflowScheduler:
    def __init__(
        self,
        repo: WorkflowScheduleRepository,
        launcher: ScheduleLauncher,
        session_reuser: ScheduleSessionReuser,
        *,
        poll_seconds: float = 15.0,
    ) -> None:
        self._repo = repo
        self._launcher = launcher
        self._poll_seconds = poll_seconds
        self._session_reuser = session_reuser
        self._task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._run(), name="ting-workflow-scheduler")

    async def stop(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None

    async def run_schedule(self, schedule: WorkflowSchedule) -> tuple[str, str]:
        ran_at = datetime.now(UTC)
        try:
            if schedule.last_session_id:
                session_id = schedule.last_session_id
                status = await self._session_reuser(schedule, session_id)
            else:
                session_id, status = await self._launcher(schedule)
        except Exception as exc:
            logger.exception("Scheduled workflow run failed: schedule=%s", schedule.id)
            await self._repo.record_result(
                schedule.id,
                ran_at=ran_at,
                session_id=schedule.last_session_id,
                status="failed",
                error=str(exc)[:2000],
            )
            raise
        await self._repo.record_result(
            schedule.id,
            ran_at=ran_at,
            session_id=session_id,
            status=status,
            error=None,
        )
        return session_id, status

    async def tick(self, now: datetime | None = None) -> int:
        schedules = await self._repo.claim_due(now or datetime.now(UTC))
        for schedule in schedules:
            try:
                await self.run_schedule(schedule)
            except Exception:
                continue
        return len(schedules)

    async def _run(self) -> None:
        while True:
            await self.tick()
            await asyncio.sleep(self._poll_seconds)

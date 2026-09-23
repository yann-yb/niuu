"""Persistence port for scheduled workflow launches."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from uuid import UUID

from ting.domain.workflow_schedule import WorkflowSchedule


class WorkflowScheduleRepository(ABC):
    @abstractmethod
    async def list_schedules(self, owner_id: str) -> list[WorkflowSchedule]: ...

    @abstractmethod
    async def get_schedule(self, schedule_id: UUID) -> WorkflowSchedule | None: ...

    @abstractmethod
    async def save_schedule(self, schedule: WorkflowSchedule) -> WorkflowSchedule: ...

    @abstractmethod
    async def delete_schedule(self, schedule_id: UUID, owner_id: str) -> bool: ...

    @abstractmethod
    async def claim_due(self, now: datetime, limit: int = 10) -> list[WorkflowSchedule]: ...

    @abstractmethod
    async def record_result(
        self,
        schedule_id: UUID,
        *,
        ran_at: datetime,
        session_id: str | None,
        status: str,
        error: str | None,
    ) -> None: ...

"""PostgreSQL persistence for scheduled Ting workflow launches."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

import asyncpg

from ting.domain.workflow_schedule import WorkflowSchedule, next_cron_occurrence
from ting.ports.workflow_schedule_repository import WorkflowScheduleRepository


class PostgresWorkflowScheduleRepository(WorkflowScheduleRepository):
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def list_schedules(self, owner_id: str) -> list[WorkflowSchedule]:
        rows = await self._pool.fetch(
            "SELECT * FROM workflow_schedules WHERE owner_id = $1 ORDER BY created_at DESC",
            owner_id,
        )
        return [self._from_row(row) for row in rows]

    async def get_schedule(self, schedule_id: UUID) -> WorkflowSchedule | None:
        row = await self._pool.fetchrow(
            "SELECT * FROM workflow_schedules WHERE id = $1", schedule_id
        )
        return self._from_row(row) if row else None

    async def save_schedule(self, schedule: WorkflowSchedule) -> WorkflowSchedule:
        row = await self._pool.fetchrow(
            """
            INSERT INTO workflow_schedules (
                id, workflow_id, owner_id, tenant_id, cron_expression, timezone,
                prompt, session_name, repo, branch, connection_id, enabled,
                next_run_at, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
            )
            ON CONFLICT (id) DO UPDATE SET
                cron_expression = EXCLUDED.cron_expression,
                timezone = EXCLUDED.timezone,
                prompt = EXCLUDED.prompt,
                session_name = EXCLUDED.session_name,
                repo = EXCLUDED.repo,
                branch = EXCLUDED.branch,
                connection_id = EXCLUDED.connection_id,
                enabled = EXCLUDED.enabled,
                next_run_at = EXCLUDED.next_run_at,
                updated_at = EXCLUDED.updated_at
            WHERE workflow_schedules.owner_id = EXCLUDED.owner_id
            RETURNING *
            """,
            schedule.id,
            schedule.workflow_id,
            schedule.owner_id,
            schedule.tenant_id,
            schedule.cron_expression,
            schedule.timezone,
            schedule.prompt,
            schedule.session_name,
            schedule.repo,
            schedule.branch,
            schedule.connection_id,
            schedule.enabled,
            schedule.next_run_at,
            schedule.created_at,
            schedule.updated_at,
        )
        if row is None:
            raise PermissionError("Schedule ownership is immutable")
        return self._from_row(row)

    async def delete_schedule(self, schedule_id: UUID, owner_id: str) -> bool:
        result = await self._pool.execute(
            "DELETE FROM workflow_schedules WHERE id = $1 AND owner_id = $2",
            schedule_id,
            owner_id,
        )
        return result == "DELETE 1"

    async def claim_due(self, now: datetime, limit: int = 10) -> list[WorkflowSchedule]:
        claimed: list[WorkflowSchedule] = []
        async with self._pool.acquire() as connection, connection.transaction():
            rows = await connection.fetch(
                """
                SELECT * FROM workflow_schedules
                WHERE enabled = TRUE AND next_run_at <= $1
                ORDER BY next_run_at
                FOR UPDATE SKIP LOCKED
                LIMIT $2
                """,
                now,
                limit,
            )
            for row in rows:
                schedule = self._from_row(row)
                next_run = next_cron_occurrence(schedule.cron_expression, schedule.timezone, now)
                await connection.execute(
                    "UPDATE workflow_schedules SET next_run_at = $2, updated_at = $1 WHERE id = $3",
                    now,
                    next_run,
                    schedule.id,
                )
                claimed.append(schedule)
        return claimed

    async def record_result(
        self,
        schedule_id: UUID,
        *,
        ran_at: datetime,
        session_id: str | None,
        status: str,
        error: str | None,
    ) -> None:
        await self._pool.execute(
            """
            UPDATE workflow_schedules
            SET last_run_at = $2, last_session_id = $3, last_status = $4,
                last_error = $5, updated_at = $2
            WHERE id = $1
            """,
            schedule_id,
            ran_at,
            session_id,
            status,
            error,
        )

    @staticmethod
    def _from_row(row: asyncpg.Record) -> WorkflowSchedule:
        return WorkflowSchedule(
            id=row["id"],
            workflow_id=row["workflow_id"],
            owner_id=row["owner_id"],
            tenant_id=row["tenant_id"],
            cron_expression=row["cron_expression"],
            timezone=row["timezone"],
            prompt=row["prompt"],
            session_name=row.get("session_name"),
            repo=row.get("repo") or "",
            branch=row.get("branch") or "",
            connection_id=row.get("connection_id"),
            enabled=bool(row["enabled"]),
            next_run_at=row["next_run_at"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            last_run_at=row.get("last_run_at"),
            last_session_id=row.get("last_session_id"),
            last_status=row.get("last_status"),
            last_error=row.get("last_error"),
        )

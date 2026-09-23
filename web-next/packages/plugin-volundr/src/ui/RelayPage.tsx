import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { EmptyState, ErrorState, LoadingState, StateDot, relTime } from '@niuulabs/ui';
import type { DotState } from '@niuulabs/ui';
import type { Session, SessionState } from '../domain/session';
import {
  buildRelayBoard,
  relaySessionPath,
  relaySessionTitle,
  type RelayLaneId,
} from '../application/relayBoard';
import { useRelaySessions } from './useRelaySessions';
import { RelayWorkflowPanel } from './RelayWorkflowPanel';

const STATE_DOT: Record<SessionState, DotState> = {
  requested: 'queued',
  provisioning: 'processing',
  ready: 'healthy',
  running: 'running',
  idle: 'idle',
  awaiting_input: 'attention',
  terminating: 'degraded',
  terminated: 'archived',
  archived: 'archived',
  failed: 'failed',
};

const LANE_ACCENT: Record<RelayLaneId, string> = {
  attention: 'niuu:border-l-text-primary',
  active: 'niuu:border-l-text-secondary',
  standby: 'niuu:border-l-border-strong',
  closed: 'niuu:border-l-border-subtle',
};

function sessionMeta(session: Session): string {
  return [
    session.trackerIssue?.identifier,
    session.personaName,
    session.clusterName ?? session.clusterId,
  ]
    .filter(Boolean)
    .join(' · ');
}

function MissionCard({ session, onOpen }: { session: Session; onOpen: () => void }) {
  const activity = session.lastActivityAt ?? session.startedAt;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="niuu:w-full niuu:rounded-lg niuu:border niuu:border-border-subtle niuu:bg-transparent niuu:p-3 niuu:text-left niuu:transition-colors hover:niuu:border-border-strong hover:niuu:bg-bg-secondary focus-visible:niuu:outline-2 focus-visible:niuu:outline-offset-2 focus-visible:niuu:outline-text-primary"
      aria-label={`Open ${relaySessionTitle(session)}`}
      data-testid={`relay-session-${session.id}`}
    >
      <span className="niuu:flex niuu:items-start niuu:justify-between niuu:gap-3">
        <span className="niuu:min-w-0">
          <span className="niuu:block niuu:truncate niuu:text-sm niuu:font-semibold niuu:text-text-primary">
            {relaySessionTitle(session)}
          </span>
          <span className="niuu:mt-1 niuu:block niuu:truncate niuu:text-xs niuu:text-text-secondary">
            {sessionMeta(session)}
          </span>
        </span>
        <StateDot state={STATE_DOT[session.state]} title={session.state.replace('_', ' ')} />
      </span>
      {session.preview ? (
        <span className="niuu:mt-3 niuu:block niuu:line-clamp-2 niuu:text-xs niuu:leading-5 niuu:text-text-secondary">
          {session.preview}
        </span>
      ) : null}
      <span className="niuu:mt-3 niuu:flex niuu:items-center niuu:justify-between niuu:gap-2 niuu:border-t niuu:border-border-subtle niuu:pt-2 niuu:text-[11px] niuu:text-text-faint">
        <span>{session.state.replace('_', ' ')}</span>
        <span>{relTime(activity)}</span>
      </span>
    </button>
  );
}

export function RelayPage() {
  const navigate = useNavigate();
  const sessionsQuery = useRelaySessions();
  const lanes = useMemo(() => buildRelayBoard(sessionsQuery.data ?? []), [sessionsQuery.data]);
  const total = lanes.reduce((count, lane) => count + lane.sessions.length, 0);

  if (sessionsQuery.isLoading) {
    return <LoadingState label="Loading mission control…" />;
  }

  if (sessionsQuery.isError) {
    return (
      <ErrorState
        title="Mission control unavailable"
        message={
          sessionsQuery.error instanceof Error
            ? sessionsQuery.error.message
            : 'Could not load agent sessions.'
        }
      />
    );
  }

  return (
    <main
      className="niuu:min-h-full niuu:bg-bg-primary niuu:p-6 niuu:font-sans"
      data-testid="relay-page"
    >
      <RelayWorkflowPanel />

      <div className="niuu:mt-8 niuu:border-t niuu:border-border-subtle niuu:pt-5">
        <h2 className="niuu:text-base niuu:font-semibold niuu:text-text-primary">Job runs</h2>
        <p className="niuu:mt-1 niuu:text-xs niuu:text-text-secondary">
          Active handoffs grouped by operator attention.
        </p>
      </div>

      {total === 0 ? (
        <div className="niuu:py-16">
          <EmptyState
            title="No missions yet"
            description="Launch a job and its handoff will appear here."
          />
        </div>
      ) : (
        <section
          className="niuu:mt-6 niuu:grid niuu:gap-4 niuu:xl:grid-cols-4"
          aria-label="Mission lanes"
        >
          {lanes.map((lane) => (
            <section
              key={lane.id}
              className={`niuu:min-w-0 niuu:rounded-xl niuu:border niuu:border-l-2 niuu:border-border-subtle niuu:bg-bg-secondary/40 niuu:p-3 ${LANE_ACCENT[lane.id]}`}
              aria-labelledby={`relay-lane-${lane.id}`}
              data-testid={`relay-lane-${lane.id}`}
            >
              <header className="niuu:flex niuu:items-start niuu:justify-between niuu:gap-3 niuu:px-1 niuu:pb-3">
                <div>
                  <h2
                    id={`relay-lane-${lane.id}`}
                    className="niuu:text-sm niuu:font-semibold niuu:text-text-primary"
                  >
                    {lane.label}
                  </h2>
                  <p className="niuu:mt-0.5 niuu:text-xs niuu:text-text-faint">
                    {lane.description}
                  </p>
                </div>
                <span className="niuu:rounded-full niuu:border niuu:border-border-subtle niuu:bg-transparent niuu:px-2 niuu:py-0.5 niuu:text-[11px] niuu:font-medium niuu:text-text-secondary">
                  {lane.sessions.length}
                </span>
              </header>
              <div className="niuu:space-y-2">
                {lane.sessions.length === 0 ? (
                  <p className="niuu:rounded-lg niuu:border niuu:border-dashed niuu:border-border-subtle niuu:px-3 niuu:py-6 niuu:text-center niuu:text-xs niuu:text-text-faint">
                    Clear
                  </p>
                ) : (
                  lane.sessions.map((session) => (
                    <MissionCard
                      key={session.id}
                      session={session}
                      onOpen={() => navigate({ to: relaySessionPath(session) as never })}
                    />
                  ))
                )}
              </div>
            </section>
          ))}
        </section>
      )}
    </main>
  );
}

import type { Session, SessionState } from '../domain/session';

export type RelayLaneId = 'attention' | 'active' | 'standby' | 'closed';

export interface RelayLane {
  id: RelayLaneId;
  label: string;
  description: string;
  sessions: Session[];
}

const LANE_STATES: Record<RelayLaneId, readonly SessionState[]> = {
  attention: ['awaiting_input', 'failed'],
  active: ['requested', 'provisioning', 'ready', 'running', 'terminating'],
  standby: ['idle'],
  closed: ['terminated', 'archived'],
};

const LANE_COPY: Record<RelayLaneId, Pick<RelayLane, 'label' | 'description'>> = {
  attention: { label: 'Needs you', description: 'Waiting for a decision or recovery' },
  active: { label: 'In flight', description: 'Work currently moving' },
  standby: { label: 'Standing by', description: 'Ready for your next handoff' },
  closed: { label: 'Closed', description: 'Finished or archived missions' },
};

const LANE_ORDER: RelayLaneId[] = ['attention', 'active', 'standby', 'closed'];

function activityTime(session: Session): number {
  return new Date(session.lastActivityAt ?? session.startedAt).getTime();
}

export function buildRelayBoard(sessions: Session[]): RelayLane[] {
  return LANE_ORDER.map((id) => ({
    id,
    ...LANE_COPY[id],
    sessions: sessions
      .filter((session) => LANE_STATES[id].includes(session.state))
      .sort((left, right) => activityTime(right) - activityTime(left)),
  }));
}

export function relaySessionTitle(session: Session): string {
  return session.title?.trim() || session.name?.trim() || session.trackerIssue?.title || session.id;
}

export function relaySessionPath(session: Session): string {
  const suffix = session.state === 'archived' ? '/archived' : '';
  return `/volundr/session/${encodeURIComponent(session.id)}${suffix}`;
}

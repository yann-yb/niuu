import type { Session, SessionState } from '../domain/session';
import { describe, expect, it } from 'vitest';
import { buildRelayBoard, relaySessionPath, relaySessionTitle } from './relayBoard';

function session(id: string, state: SessionState, lastActivityAt?: string): Session {
  return {
    id,
    ravnId: 'operator',
    name: id,
    personaName: 'Codex',
    templateId: 'default',
    clusterId: 'local',
    state,
    startedAt: '2026-09-23T10:00:00Z',
    lastActivityAt,
    resources: {
      cpuRequest: 0,
      cpuLimit: 0,
      cpuUsed: 0,
      memRequestMi: 0,
      memLimitMi: 0,
      memUsedMi: 0,
      gpuCount: 0,
    },
    env: {},
    events: [],
  };
}

describe('Relay board', () => {
  it('groups sessions by operator-oriented mission state and sorts by activity', () => {
    const lanes = buildRelayBoard([
      session('older', 'running', '2026-09-23T11:00:00Z'),
      session('blocked', 'awaiting_input'),
      session('newer', 'running', '2026-09-23T12:00:00Z'),
      session('idle', 'idle'),
      session('failed', 'failed'),
      session('done', 'archived'),
    ]);

    expect(lanes.map((lane) => [lane.id, lane.sessions.map(({ id }) => id)])).toEqual([
      ['attention', ['blocked', 'failed']],
      ['active', ['newer', 'older']],
      ['standby', ['idle']],
      ['closed', ['done']],
    ]);
  });

  it('uses the best available title and links archived sessions correctly', () => {
    expect(
      relaySessionTitle({ ...session('session-id', 'running'), name: '', title: 'Mission' }),
    ).toBe('Mission');
    expect(relaySessionPath(session('session/id', 'archived'))).toBe(
      '/volundr/session/session%2Fid/archived',
    );
  });
});

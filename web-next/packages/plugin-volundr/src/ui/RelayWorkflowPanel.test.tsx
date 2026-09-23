import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RelayWorkflowPanel } from './RelayWorkflowPanel';

vi.mock('./useRelayWorkflows', () => ({
  useRelayWorkflows: () => ({
    data: [{ id: 'workflow-1', name: 'Daily scan', description: '', nodes: [], edges: [] }],
    isLoading: false,
    isError: false,
  }),
  useRelaySchedules: () => ({
    data: [
      {
        id: 'schedule-1',
        workflowId: 'workflow-1',
        prompt: 'Daily scan',
        sessionName: 'Daily scan',
        lastSessionId: 'session-1',
        lastStatus: 'stopped',
      },
    ],
    isError: false,
  }),
  useLaunchRelayWorkflow: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useCreateRelaySchedule: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useRunRelaySchedule: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useRelayRunEvidence: () => ({
    isLoading: false,
    data: {
      session: { status: 'stopped' },
      report: { path: 'report.md', content: '# Daily report' },
      conversation: null,
      chronicle: null,
      trace: {
        traceId: 'trace-1',
        sessionId: 'session-1',
        startedAt: null,
        endedAt: null,
        durationMs: 0,
        lanes: [],
        spans: [
          {
            id: 'activity-1',
            sessionId: 'session-1',
            traceId: 'trace-1',
            parentSpanId: null,
            kind: 'tool.call',
            name: 'web_search',
            status: 'completed',
            startedAt: '2026-09-23T10:00:00Z',
            endedAt: null,
            durationMs: null,
            actorLabel: 'researcher',
            attributes: { query: 'daily merge requests' },
          },
        ],
      },
    },
  }),
}));

describe('RelayWorkflowPanel', () => {
  it('keeps Activities collapsed until the user expands it', () => {
    render(<RelayWorkflowPanel />);

    const heading = screen.getByText('Activities');
    const details = heading.closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    expect(screen.getByText('1 activity · 1 agent')).toBeInTheDocument();

    fireEvent.click(details!.querySelector('summary')!);

    expect(details).toHaveAttribute('open');
    expect(screen.getByText('daily merge requests')).toBeInTheDocument();
  });
});

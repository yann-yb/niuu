import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ServicesProvider } from '@niuulabs/plugin-sdk';
import type { ISessionStore } from '../ports/ISessionStore';
import type { Session, SessionState } from '../domain/session';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RelayPage } from './RelayPage';
import { relayEvidenceRefreshInterval } from './useRelayWorkflows';

const navigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));
vi.mock('./RelayWorkflowPanel', () => ({ RelayWorkflowPanel: () => <div>Jobs panel</div> }));

function session(id: string, state: SessionState): Session {
  return {
    id,
    ravnId: 'operator',
    title: `Mission ${id}`,
    personaName: 'Codex',
    templateId: 'default',
    clusterId: 'local',
    state,
    startedAt: '2026-09-23T10:00:00Z',
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

function store(listSessions: ISessionStore['listSessions']): ISessionStore {
  return {
    getSession: vi.fn(),
    listSessions,
    createSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
  };
}

function wrap(sessionStore: ISessionStore) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ServicesProvider services={{ 'volundr.sessions': sessionStore }}>
        <RelayPage />
      </ServicesProvider>
    </QueryClientProvider>,
  );
}

describe('RelayPage', () => {
  beforeEach(() => navigate.mockReset());

  it('renders Volundr sessions in operator-oriented mission lanes', async () => {
    wrap(
      store(
        vi
          .fn()
          .mockResolvedValue([session('blocked', 'awaiting_input'), session('one', 'running')]),
      ),
    );

    expect(screen.getByText('Loading mission control…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('relay-page')).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Relay' })).not.toBeInTheDocument();
    expect(
      screen.queryByText('Human-operated mission control for every active handoff.'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('relay-lane-attention')).toHaveTextContent('Mission blocked');
    expect(screen.getByTestId('relay-lane-active')).toHaveTextContent('Mission one');

    fireEvent.click(screen.getByRole('button', { name: 'Open Mission one' }));
    expect(navigate).toHaveBeenCalledWith({ to: '/volundr/session/one' });
  });

  it('shows the empty state when Volundr has no sessions', async () => {
    wrap(store(vi.fn().mockResolvedValue([])));
    expect(await screen.findByText('No missions yet')).toBeInTheDocument();
  });

  it('shows a real service error instead of demo data', async () => {
    wrap(store(vi.fn().mockRejectedValue(new Error('Forge unavailable'))));
    expect(await screen.findByText('Forge unavailable')).toBeInTheDocument();
  });

  it('polls active jobs and stops polling terminal jobs', () => {
    expect(relayEvidenceRefreshInterval()).toBe(2_000);
    expect(relayEvidenceRefreshInterval('running')).toBe(2_000);
    expect(relayEvidenceRefreshInterval('stopped')).toBe(false);
    expect(relayEvidenceRefreshInterval('failed')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import type { Workflow } from '@niuulabs/plugin-ting';
import {
  buildRelayMarkdownReport,
  relayActivities,
  stripMarkdownFrontmatter,
  workflowAgents,
} from './relayWorkflow';

const workflow: Workflow = {
  id: '53cc4e74-d040-44ba-b35d-e857f8cf1681',
  name: 'Daily scan',
  nodes: [
    {
      id: 'scan',
      kind: 'stage',
      label: 'Scan sources',
      runId: null,
      personaIds: [],
      stageMembers: [
        {
          personaId: 'researcher',
          model: '',
          budget: 10,
          consumesEventTypes: [],
          eventFilters: {},
        },
      ],
      executionMode: 'parallel',
      maxConcurrent: 3,
      joinMode: 'all',
      position: { x: 200, y: 0 },
    },
  ],
  edges: [],
};

describe('Relay workflow evidence', () => {
  it('classifies recorded tool spans without inventing keywords', () => {
    const activities = relayActivities(
      {
        traceId: 'trace',
        sessionId: 'session',
        startedAt: null,
        endedAt: null,
        durationMs: 0,
        lanes: [],
        spans: [
          {
            id: 'search',
            sessionId: 'session',
            traceId: 'trace',
            parentSpanId: null,
            kind: 'tool.call',
            name: 'web_search',
            status: 'completed',
            startedAt: '2026-09-23T10:00:00Z',
            endedAt: null,
            durationMs: null,
            attributes: { query: 'open merge requests' },
          },
          {
            id: 'knowledge',
            sessionId: 'session',
            traceId: 'trace',
            parentSpanId: null,
            kind: 'tool.call',
            name: 'mimir_lookup',
            status: 'completed',
            startedAt: '2026-09-23T10:01:00Z',
            endedAt: null,
            durationMs: null,
            attributes: { topic: 'nvbugs' },
          },
          {
            id: 'mail-search',
            sessionId: 'session',
            traceId: 'trace',
            parentSpanId: null,
            kind: 'tool.call',
            name: '_search_messages',
            status: 'completed',
            startedAt: '2026-09-23T10:01:30Z',
            endedAt: null,
            durationMs: null,
            attributes: { tool_input: { query: 'unread Jira notifications' } },
          },
          {
            id: 'persona',
            sessionId: 'session',
            traceId: 'trace',
            parentSpanId: null,
            kind: 'turn.peer',
            name: 'Handle mesh:outcome:research.framed',
            status: 'completed',
            startedAt: '2026-09-23T10:02:00Z',
            endedAt: null,
            durationMs: null,
            actorLabel: 'research-framer',
            attributes: {},
          },
        ],
      },
      null,
    );
    expect(activities.map(({ label, keywords }) => [label, keywords])).toEqual([
      ['Web search', 'open merge requests'],
      ['View knowledge', 'nvbugs'],
      ['Web search', 'unread Jira notifications'],
      ['Agent action', 'Handle mesh:outcome:research.framed'],
    ]);
  });

  it('lists stage agents and emits a Markdown report', () => {
    expect(workflowAgents(workflow)).toEqual(['researcher']);
    expect(buildRelayMarkdownReport(workflow, 'session-1', [], null)).toContain(
      '# Daily scan report',
    );
  });

  it('removes artifact metadata before displaying a report', () => {
    expect(stripMarkdownFrontmatter('---\nsource_ids:\n  - scan\n---\n# Daily briefing')).toBe(
      '# Daily briefing',
    );
  });
});

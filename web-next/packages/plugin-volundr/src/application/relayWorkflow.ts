import type { Workflow, WorkflowNode } from '@niuulabs/plugin-ting';
import type {
  ChronicleEvent,
  SessionChronicle,
  VolundrSessionTrace,
} from '../models/volundr.model';
import type { VolundrConversationHistory } from '../ports/IVolundrService';

export type RelayActivityKind =
  'web-search' | 'read-code' | 'view-knowledge' | 'command' | 'agent-action';

export interface RelayActivity {
  id: string;
  kind: RelayActivityKind;
  label: string;
  keywords: string;
  agent?: string;
  status?: string;
  timestamp?: string;
}

const ACTIVITY_LABEL: Record<RelayActivityKind, string> = {
  'web-search': 'Web search',
  'read-code': 'Read code',
  'view-knowledge': 'View knowledge',
  command: 'Run command',
  'agent-action': 'Agent action',
};

const DETAIL_KEYS = [
  'query',
  'queries',
  'search_query',
  'searchQuery',
  'keywords',
  'pattern',
  'subject',
  'path',
  'file',
  'url',
  'topic',
  'command',
  'cmd',
] as const;

function conciseDetail(value: unknown): string {
  const text = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').join(', ')
    : typeof value === 'string'
      ? value
      : '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > 180 ? `${normalized.slice(0, 177)}…` : normalized;
}

function textFromAttributes(attributes: Record<string, unknown>): string {
  const sources = [
    attributes,
    attributes.tool_input,
    attributes.input,
    attributes.arguments,
    attributes.params,
  ].filter(
    (value): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null && !Array.isArray(value),
  );
  for (const source of sources) {
    for (const key of DETAIL_KEYS) {
      const detail = conciseDetail(source[key]);
      if (detail) return detail;
    }
  }
  return '';
}

function classify(value: string): RelayActivityKind {
  const terms = new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
  const hasAny = (...candidates: string[]) => candidates.some((candidate) => terms.has(candidate));
  if (hasAny('mimir', 'knowledge', 'memory', 'catalog')) return 'view-knowledge';
  if (hasAny('web', 'browser', 'http', 'search', 'fetch')) return 'web-search';
  if (hasAny('read', 'file', 'code', 'grep', 'glob')) return 'read-code';
  if (hasAny('terminal', 'command', 'shell', 'exec', 'bash')) return 'command';
  return 'agent-action';
}

function chronicleActivity(event: ChronicleEvent, index: number): RelayActivity {
  const kind = classify(`${event.type} ${event.action ?? ''} ${event.label}`);
  return {
    id: `chronicle-${event.t}-${index}`,
    kind,
    label: ACTIVITY_LABEL[kind],
    keywords: event.label,
    status: event.exit == null ? undefined : event.exit === 0 ? 'completed' : 'failed',
    timestamp: new Date(event.t).toISOString(),
  };
}

export function relayActivities(
  trace: VolundrSessionTrace | null,
  chronicle: SessionChronicle | null,
): RelayActivity[] {
  const spans = (trace?.spans ?? [])
    .filter((span) => span.kind === 'tool.call' || span.kind === 'turn.peer')
    .map((span) => {
      const kind = classify(`${span.kind} ${span.name} ${span.sourceService ?? ''}`);
      const detail = textFromAttributes(span.attributes);
      return {
        id: span.id,
        kind,
        label: ACTIVITY_LABEL[kind],
        keywords:
          detail ||
          (kind === 'agent-action'
            ? span.name.replace(/^_+/, '').replace(/[_-]+/g, ' ')
            : 'Details not recorded'),
        agent: span.actorLabel ?? span.actorId ?? undefined,
        status: span.status,
        timestamp: span.startedAt,
      } satisfies RelayActivity;
    });
  const events = (chronicle?.events ?? [])
    .filter((event) => event.type === 'error' || Boolean(event.action))
    .map(chronicleActivity);
  return [...spans, ...events].sort((left, right) =>
    (left.timestamp ?? '').localeCompare(right.timestamp ?? ''),
  );
}

export function workflowPipeline(workflow: Workflow): WorkflowNode[] {
  return workflow.nodes
    .filter((node) => node.kind !== 'resource')
    .sort(
      (left, right) => left.position.x - right.position.x || left.position.y - right.position.y,
    );
}

export function workflowAgents(workflow: Workflow): string[] {
  const names = new Set<string>();
  for (const node of workflow.nodes) {
    if (node.kind !== 'stage') continue;
    for (const member of node.stageMembers ?? []) names.add(member.personaId);
    for (const persona of node.personaIds ?? []) names.add(persona);
  }
  return [...names];
}

export function buildRelayMarkdownReport(
  workflow: Workflow,
  sessionId: string,
  activities: RelayActivity[],
  conversation?: VolundrConversationHistory | null,
): string {
  const lines = [
    `# ${workflow.name} report`,
    '',
    `- Session: \`${sessionId}\``,
    `- Generated: ${new Date().toISOString()}`,
    `- Recorded activities: ${activities.length}`,
    '',
    '## Pipeline',
    '',
    workflowPipeline(workflow)
      .map((node) => `\`${node.label}\``)
      .join(' → ') || '_No execution stages recorded._',
    '',
    '## Agent activity',
    '',
  ];
  if (activities.length === 0) lines.push('_No trace or chronicle activity was recorded._');
  for (const activity of activities) {
    const agent = activity.agent ? ` — ${activity.agent}` : '';
    lines.push(`- **${activity.label}** · ${activity.keywords}${agent}`);
  }
  const finalResponse = [...(conversation?.turns ?? [])]
    .reverse()
    .find((turn) => turn.role === 'assistant' && turn.visibility !== 'internal');
  lines.push(
    '',
    '## Result',
    '',
    finalResponse?.content || '_No final agent report is available yet._',
  );
  return lines.join('\n');
}

export function stripMarkdownFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

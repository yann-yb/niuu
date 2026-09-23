import { useEffect, useMemo, useState } from 'react';
import { MarkdownContent } from '@niuulabs/ui';
import type { Workflow, WorkflowSchedule } from '@niuulabs/plugin-ting';
import {
  buildRelayMarkdownReport,
  relayActivities,
  stripMarkdownFrontmatter,
  workflowAgents,
} from '../application/relayWorkflow';
import {
  useCreateRelaySchedule,
  useLaunchRelayWorkflow,
  useRelayRunEvidence,
  useRelaySchedules,
  useRelayWorkflows,
  useRunRelaySchedule,
} from './useRelayWorkflows';

function scheduleFor(
  workflow: Workflow,
  schedules: WorkflowSchedule[],
): WorkflowSchedule | undefined {
  return schedules.find((schedule) => schedule.workflowId === workflow.id);
}

function downloadReport(name: string, markdown: string) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-report.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RelayWorkflowPanel() {
  const workflowsQuery = useRelayWorkflows();
  const schedulesQuery = useRelaySchedules();
  const launch = useLaunchRelayWorkflow();
  const createSchedule = useCreateRelaySchedule();
  const runSchedule = useRunRelaySchedule();
  const workflows = useMemo(() => workflowsQuery.data ?? [], [workflowsQuery.data]);
  const schedules = useMemo(() => schedulesQuery.data ?? [], [schedulesQuery.data]);
  const [selectedId, setSelectedId] = useState<string>();
  const [prompt, setPrompt] = useState('');
  const [cronExpression, setCronExpression] = useState('0 8 * * *');
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [launchedSessionId, setLaunchedSessionId] = useState<string>();
  const visibleWorkflows = useMemo(() => {
    const scheduledIds = new Set(schedules.map((schedule) => schedule.workflowId));
    const scheduled = workflows.filter((workflow) => scheduledIds.has(workflow.id));
    const example =
      workflows.find(
        (workflow) => !scheduledIds.has(workflow.id) && workflow.name === 'Research Campaign',
      ) ?? workflows.find((workflow) => !scheduledIds.has(workflow.id));
    return example ? [...scheduled, example] : scheduled;
  }, [schedules, workflows]);
  const selected =
    visibleWorkflows.find((workflow) => workflow.id === selectedId) ?? visibleWorkflows[0];
  const selectedSchedule = selected ? scheduleFor(selected, schedules) : undefined;
  useEffect(() => {
    setPrompt(selectedSchedule?.prompt ?? selected?.description ?? '');
  }, [selected?.description, selected?.id, selectedSchedule?.prompt]);
  const sessionId = launchedSessionId ?? selectedSchedule?.lastSessionId;
  const evidence = useRelayRunEvidence(sessionId);
  const activities = useMemo(
    () => relayActivities(evidence.data?.trace ?? null, evidence.data?.chronicle ?? null),
    [evidence.data],
  );
  const agentCount = useMemo(
    () => new Set(activities.flatMap((activity) => (activity.agent ? [activity.agent] : []))).size,
    [activities],
  );
  const report = useMemo(() => {
    if (evidence.data?.report?.content) {
      return stripMarkdownFrontmatter(evidence.data.report.content);
    }
    return selected && sessionId
      ? buildRelayMarkdownReport(selected, sessionId, activities, evidence.data?.conversation)
      : '';
  }, [activities, evidence.data?.conversation, evidence.data?.report, selected, sessionId]);

  if (workflowsQuery.isLoading) {
    return <p className="niuu:mt-6 niuu:text-sm niuu:text-text-secondary">Loading jobs…</p>;
  }
  if (workflowsQuery.isError) {
    return (
      <p className="niuu:mt-6 niuu:text-sm niuu:text-status-error">Job catalog unavailable.</p>
    );
  }

  return (
    <section className="niuu:mt-0" aria-labelledby="relay-workflows-heading">
      <div className="niuu:flex niuu:items-end niuu:justify-between niuu:gap-3">
        <div>
          <h2
            id="relay-workflows-heading"
            className="niuu:text-base niuu:font-semibold niuu:text-text-primary"
          >
            Jobs
          </h2>
          <p className="niuu:mt-1 niuu:text-xs niuu:text-text-secondary">
            Latest briefs from your scheduled job, plus one one-time example.
          </p>
        </div>
      </div>

      <div className="niuu:mt-3 niuu:grid niuu:gap-2 niuu:lg:grid-cols-2">
        {visibleWorkflows.map((workflow) => {
          const schedule = scheduleFor(workflow, schedules);
          const active = workflow.id === selected?.id;
          return (
            <button
              type="button"
              key={workflow.id}
              onClick={() => {
                setSelectedId(workflow.id);
                setPrompt(workflow.description ?? '');
                setLaunchedSessionId(undefined);
              }}
              className={`niuu:rounded-lg niuu:border niuu:p-3 niuu:text-left niuu:transition-colors ${active ? 'niuu:border-border-strong niuu:bg-bg-secondary' : 'niuu:border-border-subtle niuu:bg-transparent hover:niuu:border-border-strong'}`}
            >
              <span className="niuu:flex niuu:items-start niuu:justify-between niuu:gap-2">
                <span className="niuu:text-sm niuu:font-semibold niuu:text-text-primary">
                  {workflow.name}
                </span>
                <span className="niuu:rounded-full niuu:border niuu:border-border-subtle niuu:bg-transparent niuu:px-2 niuu:py-0.5 niuu:text-[10px] niuu:font-medium niuu:text-text-secondary">
                  {schedule ? 'Scheduled' : 'One-time'}
                </span>
              </span>
              <span className="niuu:mt-2 niuu:block niuu:text-xs niuu:text-text-secondary">
                {workflowAgents(workflow).join(' · ') || 'No agents assigned'}
              </span>
              {schedule ? (
                <span className="niuu:mt-2 niuu:block niuu:font-mono niuu:text-[10px] niuu:text-text-faint">
                  {schedule.cronExpression} · {schedule.timezone}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="niuu:mt-3 niuu:rounded-xl niuu:border niuu:border-border-subtle niuu:bg-bg-secondary/40 niuu:p-4">
          <div className="niuu:flex niuu:flex-wrap niuu:items-start niuu:justify-between niuu:gap-3">
            <div>
              <h3 className="niuu:text-sm niuu:font-semibold niuu:text-text-primary">
                {selected.name}
              </h3>
              <p className="niuu:mt-1 niuu:max-w-3xl niuu:text-xs niuu:text-text-secondary">
                {selected.description || 'No job description.'}
              </p>
            </div>
            {selectedSchedule ? (
              <button
                type="button"
                disabled={runSchedule.isPending}
                onClick={() =>
                  runSchedule.mutate(selectedSchedule.id, {
                    onSuccess: (result) => setLaunchedSessionId(result.sessionId),
                  })
                }
                className="niuu:rounded-md niuu:border niuu:border-border-strong niuu:bg-transparent niuu:px-3 niuu:py-2 niuu:text-xs niuu:font-medium niuu:text-text-primary hover:niuu:bg-bg-secondary disabled:niuu:opacity-50"
              >
                Run scheduled job now
              </button>
            ) : null}
          </div>

          <details className="niuu:mt-4 niuu:border-t niuu:border-border-subtle niuu:pt-3">
            <summary className="niuu:cursor-pointer niuu:text-xs niuu:font-medium niuu:text-text-secondary">
              Run settings
            </summary>
            <div className="niuu:mt-3 niuu:grid niuu:gap-3 niuu:lg:grid-cols-[1fr_auto]">
              <label className="niuu:block">
                <span className="niuu:mb-1 niuu:block niuu:text-[11px] niuu:font-medium niuu:text-text-faint">
                  Job prompt
                </span>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={3}
                  placeholder="What should this job accomplish?"
                  className="niuu:w-full niuu:rounded-md niuu:border niuu:border-border-subtle niuu:bg-transparent niuu:px-3 niuu:py-2 niuu:text-sm niuu:text-text-primary focus:niuu:border-border-strong focus:niuu:outline-none"
                />
              </label>
              <button
                type="button"
                disabled={!prompt.trim() || launch.isPending}
                onClick={() =>
                  launch.mutate(
                    { workflowId: selected.id, request: { prompt: prompt.trim() } },
                    { onSuccess: (result) => setLaunchedSessionId(result.sessionId) },
                  )
                }
                className="niuu:self-end niuu:rounded-md niuu:border niuu:border-border-strong niuu:bg-transparent niuu:px-4 niuu:py-2 niuu:text-xs niuu:font-semibold niuu:text-text-primary hover:niuu:bg-bg-secondary disabled:niuu:opacity-50"
              >
                Run once
              </button>
            </div>

            {!selectedSchedule ? (
              <div className="niuu:mt-3 niuu:grid niuu:gap-3 niuu:border-t niuu:border-border-subtle niuu:pt-3 niuu:sm:grid-cols-[1fr_1fr_auto]">
                <label className="niuu:block niuu:text-xs niuu:text-text-secondary">
                  Cron schedule
                  <input
                    value={cronExpression}
                    onChange={(event) => setCronExpression(event.target.value)}
                    className="niuu:mt-1 niuu:w-full niuu:rounded-md niuu:border niuu:border-border-subtle niuu:bg-transparent niuu:px-3 niuu:py-2 niuu:font-mono niuu:text-xs niuu:text-text-primary"
                  />
                </label>
                <label className="niuu:block niuu:text-xs niuu:text-text-secondary">
                  Timezone
                  <input
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    className="niuu:mt-1 niuu:w-full niuu:rounded-md niuu:border niuu:border-border-subtle niuu:bg-transparent niuu:px-3 niuu:py-2 niuu:text-xs niuu:text-text-primary"
                  />
                </label>
                <button
                  type="button"
                  disabled={!prompt.trim() || createSchedule.isPending || schedulesQuery.isError}
                  onClick={() =>
                    createSchedule.mutate({
                      workflowId: selected.id,
                      cronExpression,
                      timezone,
                      prompt: prompt.trim(),
                      sessionName: selected.name,
                    })
                  }
                  className="niuu:self-end niuu:rounded-md niuu:border niuu:border-border-strong niuu:bg-transparent niuu:px-4 niuu:py-2 niuu:text-xs niuu:font-semibold niuu:text-text-primary hover:niuu:bg-bg-secondary disabled:niuu:opacity-50"
                >
                  Schedule
                </button>
              </div>
            ) : (
              <p className="niuu:mt-3 niuu:border-t niuu:border-border-subtle niuu:pt-3 niuu:text-[11px] niuu:text-text-secondary">
                {selectedSchedule.lastStatus ?? 'not run'}
              </p>
            )}

            {launch.error || createSchedule.error || runSchedule.error ? (
              <p className="niuu:mt-3 niuu:text-xs niuu:text-status-error">
                {(launch.error ?? createSchedule.error ?? runSchedule.error)?.message}
              </p>
            ) : null}
          </details>

          {sessionId ? (
            <div className="niuu:mt-5 niuu:flex niuu:flex-col niuu:gap-4 niuu:border-t niuu:border-border-subtle niuu:pt-4">
              <details className="niuu:group niuu:order-2">
                <summary className="niuu:flex niuu:cursor-pointer niuu:items-center niuu:justify-between niuu:gap-3 niuu:rounded-md niuu:px-1 niuu:py-1 hover:niuu:bg-bg-secondary">
                  <h4 className="niuu:text-xs niuu:font-semibold niuu:uppercase niuu:tracking-wider niuu:text-text-secondary">
                    Activities
                  </h4>
                  <span className="niuu:text-[11px] niuu:text-text-faint">
                    {activities.length} {activities.length === 1 ? 'activity' : 'activities'} ·{' '}
                    {agentCount} {agentCount === 1 ? 'agent' : 'agents'}
                  </span>
                </summary>
                <div className="niuu:mt-3 niuu:max-h-[32rem] niuu:overflow-auto">
                  {activities.length ? (
                    activities.map((activity, index) => (
                      <div
                        key={activity.id}
                        className="niuu:grid niuu:grid-cols-[2rem_minmax(0,1fr)] niuu:gap-2"
                      >
                        <div className="niuu:relative niuu:flex niuu:justify-center">
                          {index < activities.length - 1 ? (
                            <span
                              className="niuu:absolute niuu:top-6 niuu:bottom-0 niuu:w-px niuu:bg-border-subtle"
                              aria-hidden="true"
                            />
                          ) : null}
                          <span className="niuu:relative niuu:flex niuu:h-6 niuu:w-6 niuu:items-center niuu:justify-center niuu:rounded-full niuu:border niuu:border-border-strong niuu:bg-bg-primary niuu:text-[10px] niuu:font-medium niuu:text-text-secondary">
                            {index + 1}
                          </span>
                        </div>
                        <div className="niuu:mb-2 niuu:rounded-md niuu:border niuu:border-border-subtle niuu:bg-transparent niuu:px-3 niuu:py-2">
                          <div className="niuu:flex niuu:flex-wrap niuu:items-center niuu:justify-between niuu:gap-2">
                            <span className="niuu:text-xs niuu:font-medium niuu:text-text-primary">
                              {activity.label}
                            </span>
                            {activity.agent ? (
                              <span className="niuu:rounded-full niuu:border niuu:border-border-subtle niuu:px-2 niuu:py-0.5 niuu:text-[10px] niuu:font-medium niuu:text-text-secondary">
                                {activity.agent}
                              </span>
                            ) : null}
                          </div>
                          <p className="niuu:mt-1 niuu:text-[11px] niuu:leading-4 niuu:text-text-secondary">
                            {activity.keywords}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="niuu:text-xs niuu:text-text-faint">
                      {evidence.isLoading
                        ? 'Loading recorded activity…'
                        : 'No trace activity recorded yet.'}
                    </p>
                  )}
                </div>
              </details>
              <section className="niuu:order-1">
                <div className="niuu:flex niuu:items-center niuu:justify-between niuu:gap-2">
                  <h4 className="niuu:text-xs niuu:font-semibold niuu:uppercase niuu:tracking-wider niuu:text-text-secondary">
                    Latest brief
                  </h4>
                  <button
                    type="button"
                    onClick={() => downloadReport(selected.name, report)}
                    className="niuu:rounded-md niuu:border niuu:border-border-subtle niuu:bg-transparent niuu:px-2 niuu:py-1 niuu:text-[10px] niuu:text-text-secondary hover:niuu:border-border-strong"
                  >
                    Download .md
                  </button>
                </div>
                <div className="niuu:mt-2 niuu:rounded-md niuu:border niuu:border-border-subtle niuu:bg-transparent niuu:p-4 niuu:text-sm niuu:text-text-primary">
                  <MarkdownContent content={report} />
                </div>
              </section>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

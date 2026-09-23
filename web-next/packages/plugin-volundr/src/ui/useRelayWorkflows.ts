import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useService } from '@niuulabs/plugin-sdk';
import type {
  CreateWorkflowScheduleRequest,
  IWorkflowService,
  WorkflowLaunchRequest,
} from '@niuulabs/plugin-ting';
import type { IVolundrService } from '../ports/IVolundrService';

const WORKFLOWS_KEY = ['relay', 'workflows'] as const;
const SCHEDULES_KEY = ['relay', 'workflow-schedules'] as const;
const ACTIVE_SESSION_STATUSES = new Set([
  'created',
  'starting',
  'provisioning',
  'running',
  'stopping',
]);

export function relayEvidenceRefreshInterval(status?: string): number | false {
  return !status || ACTIVE_SESSION_STATUSES.has(status) ? 2_000 : false;
}

export function useRelayWorkflows() {
  const service = useService<IWorkflowService>('ting.workflows');
  return useQuery({ queryKey: WORKFLOWS_KEY, queryFn: () => service.listWorkflows() });
}

export function useRelaySchedules() {
  const service = useService<IWorkflowService>('ting.workflows');
  return useQuery({
    queryKey: SCHEDULES_KEY,
    queryFn: () => {
      if (!service.listSchedules) throw new Error('Job scheduling is unavailable.');
      return service.listSchedules();
    },
    retry: false,
    refetchInterval: 5_000,
  });
}

export function useLaunchRelayWorkflow() {
  const service = useService<IWorkflowService>('ting.workflows');
  return useMutation({
    mutationFn: ({ workflowId, request }: { workflowId: string; request: WorkflowLaunchRequest }) =>
      service.launchWorkflow(workflowId, request),
  });
}

export function useCreateRelaySchedule() {
  const service = useService<IWorkflowService>('ting.workflows');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateWorkflowScheduleRequest) => {
      if (!service.createSchedule) throw new Error('Job scheduling is unavailable.');
      return service.createSchedule(request);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SCHEDULES_KEY }),
  });
}

export function useRunRelaySchedule() {
  const service = useService<IWorkflowService>('ting.workflows');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scheduleId: string) => {
      if (!service.runSchedule) throw new Error('Job scheduling is unavailable.');
      return service.runSchedule(scheduleId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SCHEDULES_KEY }),
  });
}

export function useRelayRunEvidence(sessionId?: string) {
  const service = useService<IVolundrService>('volundr');
  return useQuery({
    queryKey: ['relay', 'run-evidence', sessionId],
    enabled: Boolean(sessionId),
    queryFn: async () => {
      const id = sessionId!;
      const [session, trace, chronicle, conversation, report] = await Promise.all([
        service.getSession(id),
        service.getSessionTrace(id),
        service.getChronicle(id),
        service.getConversationHistory(id),
        service.getSessionReport(id),
      ]);
      return { session, trace, chronicle, conversation, report };
    },
    retry: false,
    refetchInterval: (query) => relayEvidenceRefreshInterval(query.state.data?.session?.status),
  });
}

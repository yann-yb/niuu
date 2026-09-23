import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useService } from '@niuulabs/plugin-sdk';
import type { ISessionStore } from '../ports/ISessionStore';
import type { Session } from '../domain/session';

const RELAY_SESSIONS_QUERY_KEY = ['relay', 'sessions'] as const;

export function useRelaySessions() {
  const store = useService<ISessionStore>('volundr.sessions');
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: RELAY_SESSIONS_QUERY_KEY,
    queryFn: () => store.listSessions(),
  });

  useEffect(
    () =>
      store.subscribe((sessions: Session[]) => {
        queryClient.setQueryData(RELAY_SESSIONS_QUERY_KEY, sessions);
      }),
    [queryClient, store],
  );

  return query;
}

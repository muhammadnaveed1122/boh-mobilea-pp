import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { searchAgents, type ApproverOption } from '../services';

const ALL_AGENTS: ApproverOption = { value: '', label: 'All Agents' };

export function useAgentSearch() {
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data } = useQuery({
    queryKey: ['approvals', 'agents', debounced],
    queryFn: () => searchAgents(debounced),
    staleTime: 60_000,
  });

  return { options: [ALL_AGENTS, ...(data ?? [])], search, setSearch };
}

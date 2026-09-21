import { QueryClient } from '@tanstack/react-query';

// Lazy singleton. Instantiating at module load pulls `new QueryClient()`
// into the early bootstrap require chain (auth.store -> session ->
// query-client) and can run before @tanstack/react-query is initialized
// (RN/Metro circular-import ordering -> "Property 'QueryClient' doesn't
// exist"). Construct on first real use instead — well after module eval.
let client: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  client ??= new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        staleTime: 30_000,
        refetchOnMount: 'always',
        refetchOnReconnect: 'always',
      },
    },
  });
  return client;
}

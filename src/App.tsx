import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo } from 'react';
import { HostDashboard } from './components/HostDashboard';
import { EmbeddedAnalytics } from './components/EmbeddedAnalytics';
import type { DashboardFilters } from './types';
import { formatDateForInput } from './lib/utils';

const queryClient = new QueryClient();

const readInitialFilters = (): { embed: boolean; filters: DashboardFilters } => {
  const params = new URLSearchParams(window.location.search);
  const today = formatDateForInput(new Date());
  return {
    embed: params.get('embed') === '1',
    filters: {
      userId: params.get('userId') ?? undefined,
      startDate: params.get('startDate') ?? today,
      endDate: params.get('endDate') ?? today
    }
  };
};

function App() {
  const { embed, filters } = useMemo(() => readInitialFilters(), []);
  return (
    <QueryClientProvider client={queryClient}>
      {embed ? <EmbeddedAnalytics initialFilters={filters} /> : <HostDashboard />}
    </QueryClientProvider>
  );
}

export default App;

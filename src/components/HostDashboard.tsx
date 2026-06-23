import { useMemo, useRef, useState } from 'react';
import { FilterBar } from './FilterBar';
import { useUsers } from '../hooks/useDvmDashboardData';
import { formatDateForInput } from '../lib/utils';
import type { DashboardFilters } from '../types';

export const HostDashboard = () => {
  const now = useMemo(() => new Date(), []);
  const [filters, setFilters] = useState<DashboardFilters>({
    startDate: formatDateForInput(now),
    endDate: formatDateForInput(now)
  });
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { data: users = [] } = useUsers();

  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({
      embed: '1',
      startDate: filters.startDate,
      endDate: filters.endDate
    });
    if (filters.userId) {
      params.set('userId', filters.userId);
    }
    return `/?${params.toString()}`;
  }, [filters]);

  const pushFilters = (nextFilters: DashboardFilters) => {
    setFilters(nextFilters);
    iframeRef.current?.contentWindow?.postMessage({ type: 'host:filters:update', payload: nextFilters }, window.location.origin);
  };

  return (
    <div className="min-h-screen bg-bg p-4 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-xl border border-slate-700 bg-panel p-4">
          <h1 className="text-2xl font-semibold">DVM Metrics Dashboard</h1>
          <p className="text-sm text-slate-400">iFrame-based analytics with persisted DVM and date filters.</p>
        </header>

        <FilterBar filters={filters} users={users} onChange={pushFilters} />

        <div className="rounded-xl border border-slate-700 bg-panel p-2">
          <iframe
            ref={iframeRef}
            title="DVM Analytics Iframe"
            src={iframeSrc}
            className="h-[1200px] w-full rounded-lg border border-slate-800 bg-slate-950"
          />
        </div>
      </div>
    </div>
  );
};

import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardFilters } from '../types';
import {
  useCancellations,
  useConsultsPerHourGraph,
  useLeaderboard,
  usePphAddons,
  useServiceBreakdown,
  useSummary,
  useTaskStats,
  useTimeBetweenConsults
} from '../hooks/useDvmDashboardData';
import { formatNumber, formatPercent } from '../lib/utils';

interface Props {
  initialFilters: DashboardFilters;
}

const cardClass = 'rounded-xl border border-slate-700 bg-card p-4';

export const EmbeddedAnalytics = ({ initialFilters }: Props) => {
  const [filters, setFilters] = useState<DashboardFilters>(initialFilters);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'host:filters:update') {
        return;
      }
      if (!event.data?.payload) {
        return;
      }
      setFilters(event.data.payload as DashboardFilters);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: 'iframe:ready' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  const { data: summary } = useSummary(filters);
  const { data: serviceBreakdown = [] } = useServiceBreakdown(filters);
  const { data: taskStats = [] } = useTaskStats(filters);
  const { data: cancellations } = useCancellations(filters);
  const { data: consultsPerHour = [] } = useConsultsPerHourGraph(filters);
  const { data: leaderboard = [] } = useLeaderboard(filters);
  const { data: pphAddons } = usePphAddons(filters);
  const { data: timeBetween } = useTimeBetweenConsults(filters);

  const serviceTable = useMemo(
    () =>
      serviceBreakdown.map((row) => (
        <tr key={row.serviceType} className="border-b border-slate-800">
          <td className="py-2">{row.serviceType}</td>
          <td className="py-2 text-right">{formatNumber(row.count)}</td>
          <td className="py-2 text-right">{formatPercent(row.percent)}</td>
        </tr>
      )),
    [serviceBreakdown]
  );

  return (
    <div className="space-y-4 p-4 text-slate-100">
      <div className="grid gap-3 md:grid-cols-4">
        <div className={cardClass}>
          <p className="text-xs uppercase text-slate-400">Consultations Owned</p>
          <p className="text-2xl font-semibold">{formatNumber(summary?.consultationsOwned ?? 0)}</p>
        </div>
        <div className={cardClass}>
          <p className="text-xs uppercase text-slate-400">Available Consultations</p>
          <p className="text-2xl font-semibold">{formatNumber(summary?.availableConsultations ?? 0)}</p>
        </div>
        <div className={cardClass}>
          <p className="text-xs uppercase text-slate-400">Consultations / Hour</p>
          <p className="text-2xl font-semibold">{(summary?.consultationsPerHour ?? 0).toFixed(2)}</p>
        </div>
        <div className={cardClass}>
          <p className="text-xs uppercase text-slate-400">Total Active DVMs</p>
          <p className="text-2xl font-semibold">{formatNumber(summary?.totalDvmsActive ?? 0)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cardClass}>
          <h3 className="mb-2 text-lg font-medium">Service Type Breakdown</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400">
                <th className="py-2 text-left">Service</th>
                <th className="py-2 text-right">Count</th>
                <th className="py-2 text-right">Percent</th>
              </tr>
            </thead>
            <tbody>{serviceTable}</tbody>
          </table>
        </div>
        <div className={cardClass}>
          <h3 className="mb-2 text-lg font-medium">Task Statistics</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400">
                <th className="py-2 text-left">Task</th>
                <th className="py-2 text-right">Count</th>
                <th className="py-2 text-right">Percent</th>
              </tr>
            </thead>
            <tbody>
              {taskStats.map((row) => (
                <tr key={row.taskType} className="border-b border-slate-800">
                  <td className="py-2">{row.taskType}</td>
                  <td className="py-2 text-right">{row.countAvailable ? formatNumber(row.count ?? 0) : '-'}</td>
                  <td className="py-2 text-right">{formatPercent(row.percent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cardClass}>
        <h3 className="mb-3 text-lg font-medium">Consultations Per Hour</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={consultsPerHour}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="hourBucket" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="consultationsOwned" name="Owned" stroke="#3b82f6" />
              <Line type="monotone" dataKey="consultationsPerHour" name="CPH" stroke="#22c55e" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cardClass}>
          <h3 className="mb-2 text-lg font-medium">Top 10 DVM Leaderboard</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400">
                <th className="py-2 text-left">Rank</th>
                <th className="py-2 text-left">DVM</th>
                <th className="py-2 text-right">Owned</th>
                <th className="py-2 text-right">CPH</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row) => (
                <tr key={row.userId} className="border-b border-slate-800">
                  <td className="py-2">{row.rank}</td>
                  <td className="py-2">{row.userName}</td>
                  <td className="py-2 text-right">{formatNumber(row.consultationsOwned)}</td>
                  <td className="py-2 text-right">{row.consultationsPerHour.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={cardClass}>
          <h3 className="mb-2 text-lg font-medium">Additional Statistics</h3>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-slate-400">PPH Add-ons (aggregate):</span> {formatNumber(pphAddons ?? 0)}
            </p>
            <p>
              <span className="text-slate-400">Cancelled Consults:</span> {formatNumber(cancellations?.totalCancelled ?? 0)}
            </p>
            <p>
              <span className="text-slate-400">Time Between Consults (avg/median/p90 mins):</span>{' '}
              {timeBetween
                ? `${timeBetween.averageMinutes.toFixed(1)} / ${timeBetween.medianMinutes.toFixed(1)} / ${timeBetween.p90Minutes.toFixed(1)}`
                : '0 / 0 / 0'}
            </p>
            <div>
              <p className="mb-1 text-slate-400">Cancellation Reasons</p>
              <ul className="space-y-1">
                {(cancellations?.byReason ?? []).map((row) => (
                  <li key={row.reasonCode}>
                    {row.reasonLabel}: {formatNumber(row.count)} ({formatPercent(row.percent)})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

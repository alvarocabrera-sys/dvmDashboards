import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type {
  CancellationRow,
  ConsultPerHourPoint,
  DashboardFilters,
  LeaderboardRow,
  ServiceBreakdownRow,
  SummaryMetrics,
  TaskStatRow,
  TimeBetweenConsultsStats,
  UserOption
} from '../types';

const API_BASE = '/api/dvm-dashboard';

export const serializeFilters = (filters: DashboardFilters) => {
  const out: Record<string, string> = {
    startDate: filters.startDate,
    endDate: filters.endDate
  };
  if (filters.userId) {
    out.userId = filters.userId;
  }
  return out;
};

export const useUsers = () =>
  useQuery({
    queryKey: ['dvm-users'],
    queryFn: async () => {
      const { data } = await axios.get<UserOption[]>(`${API_BASE}/filters/users`);
      return data;
    },
    staleTime: 5 * 60 * 1000
  });

export const useSummary = (filters: DashboardFilters) =>
  useQuery({
    queryKey: ['dvm-summary', filters],
    queryFn: async () => {
      const { data } = await axios.get<SummaryMetrics>(`${API_BASE}/summary`, { params: serializeFilters(filters) });
      return data;
    }
  });

export const useServiceBreakdown = (filters: DashboardFilters) =>
  useQuery({
    queryKey: ['dvm-service-breakdown', filters],
    queryFn: async () => {
      const { data } = await axios.get<{ rows: ServiceBreakdownRow[] }>(`${API_BASE}/service-breakdown`, {
        params: serializeFilters(filters)
      });
      return data.rows;
    }
  });

export const useTaskStats = (filters: DashboardFilters) =>
  useQuery({
    queryKey: ['dvm-task-stats', filters],
    queryFn: async () => {
      const { data } = await axios.get<{ rows: TaskStatRow[] }>(`${API_BASE}/task-stats`, { params: serializeFilters(filters) });
      return data.rows;
    }
  });

export const useCancellations = (filters: DashboardFilters) =>
  useQuery({
    queryKey: ['dvm-cancellations', filters],
    queryFn: async () => {
      const { data } = await axios.get<{ byReason: CancellationRow[]; totalCancelled: number }>(`${API_BASE}/cancellations`, {
        params: serializeFilters(filters)
      });
      return data;
    }
  });

export const usePphAddons = (filters: DashboardFilters) =>
  useQuery({
    queryKey: ['dvm-pph-addons', filters.startDate, filters.endDate],
    queryFn: async () => {
      const { data } = await axios.get<{ count: number }>(`${API_BASE}/pph-addons`, {
        params: { startDate: filters.startDate, endDate: filters.endDate }
      });
      return data.count;
    }
  });

export const useConsultsPerHourGraph = (filters: DashboardFilters) =>
  useQuery({
    queryKey: ['dvm-consults-per-hour-graph', filters],
    queryFn: async () => {
      const { data } = await axios.get<{ points: ConsultPerHourPoint[] }>(`${API_BASE}/graphs/consults-per-hour`, {
        params: serializeFilters(filters)
      });
      return data.points;
    }
  });

export const useLeaderboard = (filters: DashboardFilters) =>
  useQuery({
    queryKey: ['dvm-leaderboard', filters.startDate, filters.endDate],
    queryFn: async () => {
      const { data } = await axios.get<{ rows: LeaderboardRow[] }>(`${API_BASE}/leaderboard/top-dvms`, {
        params: { startDate: filters.startDate, endDate: filters.endDate }
      });
      return data.rows;
    }
  });

export const useTimeBetweenConsults = (filters: DashboardFilters) =>
  useQuery({
    queryKey: ['dvm-time-between-consults', filters],
    queryFn: async () => {
      const { data } = await axios.get<TimeBetweenConsultsStats>(`${API_BASE}/time-between-consults`, {
        params: serializeFilters(filters)
      });
      return data;
    }
  });

export interface DashboardFilters {
  userId?: string;
  startDate: string;
  endDate: string;
}

export interface UserOption {
  id: string;
  name: string;
}

export interface SummaryMetrics {
  consultationsOwned: number;
  availableConsultations: number;
  consultationsPerHour: number;
  totalDvmsActive: number;
  generatedAt: string;
}

export interface ServiceBreakdownRow {
  serviceType: string;
  count: number;
  percent: number;
}

export interface TaskStatRow {
  taskType: 'Prescriptions' | 'Transfers' | 'Diagnostic Requests';
  count: number | null;
  percent: number;
  countAvailable: boolean;
}

export interface CancellationRow {
  reasonCode: string;
  reasonLabel: string;
  count: number;
  percent: number;
}

export interface ConsultPerHourPoint {
  hourBucket: string;
  consultationsOwned: number;
  consultationsPerHour: number;
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  userName: string;
  consultationsOwned: number;
  consultationsPerHour: number;
}

export interface TimeBetweenConsultsStats {
  averageMinutes: number;
  medianMinutes: number;
  p90Minutes: number;
  sampleSize: number;
}

import type { DashboardFilters, UserOption } from '../types';

interface Props {
  filters: DashboardFilters;
  users: UserOption[];
  onChange: (filters: DashboardFilters) => void;
}

export const FilterBar = ({ filters, users, onChange }: Props) => {
  return (
    <div className="rounded-xl border border-slate-700 bg-panel p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          DVM User
          <select
            className="rounded-md border border-slate-600 bg-slate-900 p-2 text-sm text-slate-100"
            value={filters.userId ?? ''}
            onChange={(event) => onChange({ ...filters, userId: event.target.value || undefined })}
          >
            <option value="">All DVMs (Aggregate)</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Start Date
          <input
            type="date"
            className="rounded-md border border-slate-600 bg-slate-900 p-2 text-sm text-slate-100"
            value={filters.startDate}
            onChange={(event) => onChange({ ...filters, startDate: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          End Date
          <input
            type="date"
            className="rounded-md border border-slate-600 bg-slate-900 p-2 text-sm text-slate-100"
            value={filters.endDate}
            onChange={(event) => onChange({ ...filters, endDate: event.target.value })}
          />
        </label>
      </div>
    </div>
  );
};

export const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);

export const formatPercent = (value: number) => `${value.toFixed(1)}%`;

export const formatDateForInput = (value: Date) => value.toISOString().slice(0, 10);

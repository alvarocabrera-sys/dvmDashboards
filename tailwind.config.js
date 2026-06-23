/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f172a',
        panel: '#111827',
        card: '#1f2937',
        muted: '#9ca3af',
        accent: '#3b82f6',
        good: '#22c55e',
        warn: '#f59e0b',
        bad: '#ef4444'
      }
    }
  },
  plugins: []
};

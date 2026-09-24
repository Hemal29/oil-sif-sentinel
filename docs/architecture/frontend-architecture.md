# Frontend Architecture (intended)

- app/: Next.js routes (login, dashboard, reports, analyze, patterns, sites, activities, rules, reviews, ai-assistant)
- components/: layout, dashboard, reports, analysis, patterns, reviews, charts, common, ui
- lib/api.ts: Axios instance using NEXT_PUBLIC_API_URL
- types/, hooks/
- Dashboard charts via Recharts (later).

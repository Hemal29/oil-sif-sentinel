# System Architecture (intended)

HSE User -> Next.js frontend -> Express REST API (/api/v1) -> MySQL (Sequelize) + AI/NLP service.

- Frontend: Next.js pages (dashboard, reports, analyze, patterns, reviews).
- Backend: thin controllers, services for logic, middleware for auth/validation.
- AI service: called ONLY via analysis.service.js; output stored in AIAnalysis.
- Later: BullMQ + Redis for batch jobs, SQL aggregation for dashboard.

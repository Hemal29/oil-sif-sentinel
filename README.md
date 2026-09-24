# OIL SIF Sentinel — AI/NLP Engine to Detect SIF Precursors

SIH project for OIL: detect Serious Injury & Fatality (SIF) precursors in
Unsafe-Act, Unsafe-Condition and Near-Miss reports.

## Purpose

- Digitise HSE unsafe-act / unsafe-condition / near-miss reports.
- Flag SIF potential early using AI/NLP + Life-Saving Rules.
- Prioritise HIGH-risk reports for HSE review.
- Surface repeat patterns by site / activity / rule.

## Technologies

- **Frontend:** Next.js + React + TypeScript + Tailwind CSS + Recharts + Axios
- **Backend:** Node.js + Express.js (JavaScript) + Sequelize + JWT + Zod + Multer
- **AI service:** Python NLP microservice (placeholder at this stage)
- **DB:** MySQL (managed via MySQL Workbench) | **Queue (later):** BullMQ + Redis

## High-level architecture

```text
                    HSE USER
                       │
                       ▼
              Next.js Frontend
                       │
                    REST API
                       │
                       ▼
              Node.js + Express
                │      │      │
                │      │      └── Pattern Engine
                │      │
                │      └──────── AI Orchestration
                │
                ▼
         MySQL/Sequelize
                │
                ▼
         AI/NLP Service
```

Architecture rules: thin controllers, logic in services, validation before
logic, auth via middleware, AI only via `analysis.service.js`, original
report text never overwritten, AI output stored in `AIAnalysis` with
`modelName` + `modelVersion`.

## Folder structure

```text
oil-sif-sentinel/
├── frontend/    # Next.js app
├── backend/     # Express API (/api/v1/*)
├── ai-service/  # Python NLP placeholder + API contract
└── docs/        # architecture / api / database / development
```

## Development order

1. Project structure (this step) + `GET /api/v1/health`.
2. Auth + Report CRUD + MySQL/Sequelize models.
3. AI orchestration (`analysis.service.js` ↔ AI service contract).
4. Review workflow + Life-Saving Rules + Sites/Activities masters.
5. Pattern engine + Dashboard aggregations.
6. AI assistant + batch jobs (BullMQ + Redis) + hardening.

See `docs/development/setup.md` for run instructions.

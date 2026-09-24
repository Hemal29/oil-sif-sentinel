# Dashboard API

Base: `/api/v1/dashboard`. All endpoints require `Authorization: Bearer <JWT>`
(any authenticated role). Read-only — no mutations, no new tables.

## Query parameters

| Param      | Values                          | Notes                                              |
|------------|---------------------------------|----------------------------------------------------|
| `preset`   | `7d` `30d` `90d` `1y` `all`     | Default `30d`. Ignored when explicit dates given.  |
| `dateFrom` | `YYYY-MM-DD`                    | Must be paired with `dateTo`.                      |
| `dateTo`   | `YYYY-MM-DD`                    | Inclusive. `dateFrom` must not be after `dateTo`.  |
| `limit`    | `1`–`50`                        | Only on `recent-reports` (default 10) and `pending-reviews` (default 20). |

Date behavior: filtering uses `reports.date` (incident date as stored).
Bounds are inclusive; all math is UTC so server timezone never shifts a
boundary. Invalid/partial/reversed dates → `400 VALIDATION_ERROR`.

## Endpoints

- `GET /overview` → `{ totalReports, sifPotential, highPriority, pendingReviews }`
- `GET /trends` → `{ bucket: "day"|"week"|"month", points: [{ date, totalReports, sifReports }] }`
  - Bucketing: span ≤ 31d daily, ≤ 120d weekly (Monday start), else monthly.
  - Buckets with zero reports are included as zero-filled points.
- `GET /distributions` → `{ reportType: {UNSAFE_ACT, UNSAFE_CONDITION, NEAR_MISS}, priority: {LOW, MEDIUM, HIGH, CRITICAL} (zero-filled), sif: {sif, nonSif, unanalyzed} }`
- `GET /sites` → `{ items: [{ siteId, siteName, siteCode, reportCount, sifCount, highCriticalCount }] }` (only sites with reports)
- `GET /activities` → `{ items: [{ activity, reportCount, sifCount, highCriticalCount }] }` (groups the `reports.activity` string field)
- `GET /life-saving-rules` → `{ items: [{ ruleId, ruleCode, ruleName, isPrototype, reportCount, sifCount }] }` (resolved rules only; prototype rows flagged, never presented as official OIL rules)
- `GET /recent-reports` → `{ items: [...] }` newest-first HIGH/CRITICAL completed analyses
- `GET /pending-reviews` → `{ items, total }` oldest-first reports with status `UNDER_REVIEW`

## KPI definitions (mandatory correctness rules)

- `sifPotential` / SIF counts: `ai_analyses.analysisStatus = 'COMPLETED'` **AND** `sifPotential = true`. Nothing else.
- `highPriority`: COMPLETED analyses with priority `HIGH` or `CRITICAL`.
- `nonSif`: COMPLETED analyses where `sifPotential` is not true.
- `unanalyzed`: reports with **no** COMPLETED analysis (PENDING, FAILED, and missing rows all count here — never as non-SIF).
- `pendingReviews`: reports with status `UNDER_REVIEW` (existing review workflow, no new states).
- Successful analysis advances `NEW → ANALYZED`; dashboard never writes.

## SIF disclaimer (also shown in UI)

SIF Potential / priority / AI confidence are classifications of the current
**prototype** model — **SIF Potential ≠ actual injury probability**, and
prototype rules are not official OIL methodology.

## Empty states

Empty ranges return zeros / `[]` (never sample data). The frontend renders
"No reports available for this period.", "No completed AI analyses
available.", "No high-priority reports found.", and "No pending reviews.
The queue is clear." respectively, plus a retry panel on API failure.

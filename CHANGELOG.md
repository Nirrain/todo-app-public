# Changelog

The format is simple and chronological.  
Dates use YYYY-MM-DD.

---
## 2026-07-13
- Replaced the placeholder specification with a keyed live app specification in `SPECIFICATION.md`
- Documented the current task model, UI behavior, ranking rules, sync flow, and PWA/offline behavior as the source of truth
- Added `CODELINK.json` as an AI-oriented map from third-level spec sections to the primary code owners for each behavior

---
## 2026-07-06
- Sync adjusted to be live
- Category controlled in settings added
- Tasks now keep a completed flag, track changedAt, support due dates, and can be sorted by importance, created date, or due date
- Filters changed to context/category toggle chips plus free-text search; importance was removed as a filter and sort moved to a compact icon menu
- Settings no longer open with Login preselected, and the big-win concept was removed from the task model and UI
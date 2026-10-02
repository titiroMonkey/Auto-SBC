# Frontend Split Layout

This folder contains the split-source frontend that is bundled into `plainJavascript.js`.
The runtime still executes a single script; this split layout exists for maintainability.

## Source Structure

- `src/vendor/` — third-party helpers.
- `src/core/` — shared bootstrapping and utility primitives (`styles`, `dom`, `init`, console hooks).
- `src/data/` — data collectors and data-source helpers (club, concepts).
- `src/features/` — functional workflows:
  - `features/unassigned/` — unassigned item collection, grouping, processing, refresh.
  - `features/solver/` — solve lifecycle (state, pricing, navigation, submit, overrides, `quick-solution`).
  - `features/sbc-core.js` — SBC orchestration core.
- `src/overrides/` — UI/runtime monkey-patches grouped by domain:
  - `overrides/player/` — player item/slot/search overrides + split pricing/picks modules.
  - `overrides/pack/` — pack and popup overrides.
  - `overrides/sbc/` — SBC UI controls and settings (`sidebar-nav`, `sidebar-nav-controls`, buttons, tags, views).
  - `overrides/navigation/` — home/navigation-specific overrides.

## Build Order

Load order is controlled by `frontend/manifest.json`.
When moving files, always update the manifest so global dependencies still initialize in the correct order.

## Rebuild `plainJavascript.js`

From repo root:

```
C:/Users/940418/Documents/Repositories/Auto-SBC/.venv/Scripts/python.exe scripts/build_plainjavascript.py
```

If needed, change `OUTPUT` in `scripts/build_plainjavascript.py`.

## Gallery planner

Gallery is separate from Collection Book. It caches FUT.GG set definitions,
thresholds and bonus tags, checking the catalogue on startup. Candidate players
come from EA club items and the local concept cache, not FUT.GG player pools.

The default "Club + seen" pool also includes previously observed definitions
from Collection Book ownership history, even after sale or SBC submission.
Those cards are labelled "Seen before" and do not receive First Owner credit
without current club evidence. "All concepts" additionally includes unseen cards.

The planner uses EA `gradingScore` values (`UTItemEntity.sbsScore`), excludes
loans, and counts each definition once. Bonuses use matching item scores,
round down per tag, and pay the ten highest bonuses. First Owner applies only
to club items with ownership evidence. Grades require every slot to be filled.

Small pools are searched exhaustively. Larger pools use a bounded, bonus-aware
search labelled "Best found". Scores and tokens are projections, not claimed
in-game progress. No players are bought, submitted or moved.

Concept cache schema 6 preserves grading scores, holographic metadata, positions,
face attributes and skill ratings. Older caches are refreshed through EA.

Run the focused regression checks from the repository root:

```sh
node --test frontend/tests/gallery.test.cjs
```

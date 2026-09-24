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

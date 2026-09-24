# Overrides Folder Guide

Overrides patch EAFC Web App UI/controllers at runtime. Files are grouped by domain:

- `player/`
  - `player-item.js`: player tile/action panel UI patching
  - `player-pricing.js`: price cache, pricing fetchers, fodder helpers
  - `player-picks.js`: open-pick/open-pack flow and pick synchronization
  - `player-slot.js`: squad slot interactions
- `pack/`
  - `pack.js`: pack-level flow
  - `pack-item.js`: pack item row/card behavior
  - `popup.js`: popup handling around pack/unassigned flows
- `sbc/`
  - `sidebar-nav.js`: settings screen assembly, tabs, and data wiring
  - `sidebar-nav-controls.js`: reusable settings control builders (toggle/dropdown/spinner)
  - `sbc-view.js`: SBC screen view behavior
  - `sbc-button.js`: solve and helper buttons
  - `fav-tag.js`: favourite/challenge tagging behavior
- `navigation/`
  - `fut-home.js`: home screen/navigation entry hooks

Keep override files focused on view/controller patching only. Put business flow logic in `features/` when possible.

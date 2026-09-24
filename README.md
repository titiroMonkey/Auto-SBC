## EAFC Automated SBC Solving ⚽

If you want to add any new features to the ideas section of the discussions tab and ill try to implement them.

#### The goal is to automatically solve the SBC using the currently available players in the club with the minimum cost.

### How to Use

Auto-SBC runs as a local FastAPI backend plus a frontend script that gets injected into the EA FC Ultimate Team web app in your browser — there is no browser extension or userscript manager to install.

1. Install dependencies once: `pip3 install -r requirements.txt && python -m playwright install chrome`
2. Start everything with a single command: `./sbc` (macOS/Linux/Git Bash), `sbc.cmd` (Windows cmd), or `sbc.ps1` (PowerShell). This starts the backend, which automatically opens a browser window with the frontend script injected and re-injects it on every refresh — see [Script Injection Methods](#script-injection-methods) if you'd rather run it manually.
3. Log into the EA FC Ultimate Team web app in the window that opens. The Auto-SBC UI (toolbar, settings tab, SBC page buttons) appears once the script has injected.
4. Open an SBC challenge and press **Solve SBC** to send your available club players to the backend solver — it fills the squad with the cheapest valid combination it can find. Pressing Solve again re-solves using the current squad as a starting point.
5. Use the **SBC Solver Settings** tab (gear icon in the navigation bar) to tune how solving, unassigned-item processing, and the UI behave — see [Settings Reference](#settings-reference) below for what every option does.

### Frontend

The frontend script is injected into the EAFC web app to output the users Club Player Data.
The script implements a number of backend functions with the main feature being a Solve SBC button on each SBC that sends players to the backend solver. The solver will attempt to use the current sbc solution as a starting point. This means subsequent solves ( pushing solve sbc button ) will use the previous solve as a starting point.

![solveBtn](https://github.com/titiroMonkey/Auto-SBC/blob/main/pictures/solveBtn.jpg?raw=true)

Players will also get SBC Lock button to not send use this player in the solution (if its a duplicate it will get sent)

Also a set the cost of this player to 0 button so it will get most likely get used if it can be fit into the SBC.
This is useful to get rid of high rated duplicates or overpriced SBCS.

![solveBtn](https://github.com/titiroMonkey/Auto-SBC/blob/main/pictures/Player.jpg?raw=true)

Check out the settings menu item for extra details!

### Settings Reference

All settings live in the **SBC Solver Settings** tab, split into three sub-tabs: **UI**, **SBC Settings**, and **Unassigned Rules**.

#### UI tab

General, app-wide options that aren't tied to a specific SBC.

| Setting | What it does |
| --- | --- |
| Play Sounds | Plays a sound effect on solver/notification events. |
| Pack Animation Item Filter | Restricts the full-screen walkout/pack animation to items matching the chosen filters (duplicate, tradable, rating range, price range, league/nation/team/rarity include-exclude lists, etc.) instead of animating every pulled item. |
| Show Club and storage stats | Displays club and storage rating/count stats in the UI. |
| Show Prices | Shows cached market prices on player items throughout the app. |
| Show Latest 10 Packed Special Players | Shows a fixed strip at the bottom of the screen with your latest 10 packed non-fodder players. |
| Unassigned Grid Items | Displays each Unassigned section (and My Club search results) as a multi-column item grid instead of a single list. |
| Show SBC Submit Tracker | Shows successful SBC submit counts for the last 60 minutes and 24 hours next to your coin balance. |
| Price Cache Minutes | How long a fetched market price is considered fresh before it's treated as stale and re-fetched. |
| Show SBCs Tab | Toggles the dedicated SBCs tab in the navigation bar. |
| Auto Open Packs 100 Coins or Less | When enabled, running the SBC tab refresh automatically buys/opens store packs priced at 100 coins or less. |
| Auto Grind Submit Mode | Controls when Auto Grind submits solutions: **Optimal** (only best solutions) or **Always** (any valid solution). |
| Auto Grind Open All Packs | When enabled, Auto Grind tries to open all owned packs after each completed SBC; when disabled it skips pack draining and moves straight to the next SBC. |
| Enable Club Search Overrides | Controls whether the My Club search enhancements (grid view, quick actions, etc.) are applied. Turning on applies immediately; turning off applies on next reload. |
| Replace Storage Players | When storage is full, quick sells the lowest-priced storage items to make room for higher-priced incoming items (or quick sells the new items if they're worth less than everything already stored). |
| Show Debug Log Overlay | Shows an on-screen log overlay useful for troubleshooting. |
| Show QuickSolution Button on SBC Screen | Controls whether the Fetch Quick Solution button is displayed on the SBC challenge screen. |
| Show Quick Buy Button on SBC Screen | Controls whether the Quick Buy Squad button is displayed on the SBC challenge screen. |
| Clear All Prices | Button that wipes all cached market price data (localStorage + IndexedDB) so the next refresh fetches everything fresh. |

#### SBC Settings tab

Configured per-SBC (and optionally per-challenge). Includes a Customise SBC panel for setting up rules that apply automatically across SBC groups.

| Setting | What it does |
| --- | --- |
| 1-click Auto Submit | Controls when this SBC is automatically submitted: **Always** (any solution), **Optimal** (only best solutions), or **Never** (manual submission). |
| Repeat Count | Number of times to repeat this SBC: `-1` repeats indefinitely, `0` performs once, positive numbers repeat that many times. |
| Automatically try All Sbcs in Group | Automatically attempts every SBC in the same group as this one. |
| Automatically try to buy concepts in SBC solution | Automatically buys concept players to fill gaps in the solution. |
| Max Price per player to buy concepts | Maximum price per player when buying concept players for the solution. |
| Price above value to purchase concepts | Only buys a concept player if its market price is less than this much above its current price. |
| Automatically try SBC on Login | Runs this SBC automatically whenever you log into FUT. |
| Auto Apply Quick Solution on open | Opening this SBC's challenge page fetches and applies players from the configured quick solution URL. |
| Use Concepts | Includes concept players in solutions (requires concept collection to be enabled). |
| Automatically Open Reward Packs | Automatically opens reward packs after SBC completion. |
| Run in Background | Avoids opening the squad/unassigned views during solving and keeps chained runs in the background. |
| Auto Confirm Pick | Automatically confirms player-pick rewards. |
| Player Rating Range | Restricts the rating range of players considered for the solution (a narrower range solves faster but may miss the optimal solution). |
| Ignore Exclusions & Max Ratings for Storage | Allows duplicate players to be used in SBCs regardless of their rating. |
| Duplicate Value % | How much duplicate players are valued relative to market price (lower % = more likely to be used). |
| Untradeable Value % | How much untradeable players are valued relative to market price (lower % = more likely to be used). |
| Concept Premium | How much concept players are valued relative to market price (higher = less likely to be used). |
| API Max Solve Time | Maximum time in seconds the backend spends searching for an optimal solution. |
| Max Player Price | Maximum price per player to include in the solve (`0` = no limit). |
| Only use Storage Players | Restricts the solution to players held in storage. |
| Do not include Players from other SBC solutions | Excludes players currently reserved by other in-progress SBC solutions. |
| Exclude Objective Players | Excludes players earned from objectives. |
| Exclude Evolved Players | Excludes players that have Evolution upgrades applied. |
| Exclude Special Players | Excludes special cards (TOTW, TOTS, Heroes, etc.). |
| Exclude Tradable Players | Excludes tradable players. |
| Exclude SBC Players | Excludes players earned from SBCs. |
| Exclude Extinct Players | Excludes players with no listings on the transfer market. |
| Convert Rarity Group 'Min X' To Exact X | Solves rarity-group "Min X" requirements as "Exactly X" instead (e.g. Any TOTW/TOTS/FOF Min 1 → Exactly 1). |
| EXCLUDE - Players / Leagues / Nations / Teams / Rarity | Pick specific players, leagues, nations, clubs, or rarities to exclude from this SBC's solutions. |
| EXCLUDE - From Squad | Multi-select of your saved squads (Squad Management hub, not SBC squads); players currently assigned to any selected squad are excluded from this SBC's solutions. |

#### Unassigned Rules tab

Rules that decide what happens to items landing in your Unassigned pile (packed players, SBC rewards, objective drops, etc.). Rules are processed top-to-bottom and are re-orderable by drag; each item is handled by the first rule whose filters all match. Available actions:

| Action | What it does |
| --- | --- |
| Send to club | Moves the item into your club. |
| Send to transfer list | Lists the item for sale on the transfer market. |
| Quick sell | Quick sells the item for coins. |
| List on transfer market | Lists the item using the Quick List flow. |
| Send to storage | Moves the item into storage. |

Each rule's filters mirror the Pack Animation filters (duplicate/tradable/movable/player/special/fodder/first-owner/TOTS-TOTW flags, rating range, price range, league/nation/team/rarity include-exclude lists, and "Matches Animation Filter").

### Backend

#### Locally

Run `pip3 install -r requirements.txt` to install the required dependencies, then start the backend (packaged under `backend/`) with the `sbc` / `sbc.cmd` / `sbc.ps1` launcher script in the repo root, or directly:

```
cd backend
python -m uvicorn main:app --reload
```

#### API Endpoints

The backend exposes these endpoints:

- `POST /solve` - Submit SBC + player data for optimization
- `GET /solver-logs` - Retrieve solver progress logs
- `GET /plainjavascript.js` - Serve the frontend script for browser injection
- `POST /relay` - Relay HTTP requests (currently placeholder)

#### Script Injection Methods

You can deploy the frontend script using one of these methods:

**Option 1: Persistent Injector (Recommended)**

Automatically re-injects the script on every page refresh.
Opens Edge/Chrome with a persistent profile and re-injects `plainJavascript.js` automatically after every navigation/refresh in the EAFC web app.

The backend auto-launches the injector in the background on startup, so `./sbc` / `sbc.cmd` / `sbc.ps1` (after `pip3 install -r requirements.txt && python -m playwright install chrome`) is all you need — see [How to Use](#how-to-use). Set `AUTO_SBC_DISABLE_INJECTOR=1` to skip auto-start and run it manually instead:

```
python -m uvicorn backend.main:app --reload
python scripts/persistent_injector.py
```

Optional flags:

- `--chrome-exe "C:/Program Files/Google/Chrome/Application/chrome.exe"` (if `chrome.exe` is not on PATH)
- `--profile-dir .browser-profile` (change persistent login/session folder)
- `--url https://www.ea.com/ea-sports-fc/ultimate-team/web-app/`

Notes:

- Keep backend running so launcher can fetch fresh `plainJavascript.js`.
- If backend is temporarily unavailable, launcher falls back to local `plainJavascript.js`.
- Close the launched browser window to stop the injector process.
- Default launch now mirrors `chrome.exe --user-data-dir="C://Chrome dev session" --disable-web-security`.

Troubleshooting if Chrome does not open:

- Install Playwright browser channel: `python -m playwright install chrome`
- Run with explicit path: `python scripts/persistent_injector.py --chrome-exe "C:/Program Files/Google/Chrome/Application/chrome.exe"`
- If backend auto-started injector, check launcher logs in `backend/logs/injector.log`

#### Dependencies

- [Google OR-Tools](https://github.com/google/or-tools)
- Python 3.9
- pandas
- openpyxl
- fastapi
- uvicorn

The constraints used in the program are created in the `optimize.py` file based of the SBC requirements and the optimization problem is solved using [Google CP-SAT solver](https://developers.google.com/optimization/cp/cp_solver).

#### Docker

build:
`docker build -t auto-sbc:latest .`
then run:

`docker run --rm -p 8000:8000 auto-sbc`

### Windows Installer (Optional Packaging)

You can create a single-file executable with PyInstaller and then wrap it in a user-friendly Windows installer (Inno Setup) that asks the user where to install the backend service.

1. Build the one-file executable:

```
pyinstaller --onefile --noconfirm --name AutoSBCBackend backend/main.py
```

2. (Optional) Build an installer (requires Inno Setup `iscc` on PATH):

```
python installer/build_installer.py --version 1.0.0
```

This produces an installer in `dist/installer/AutoSBCBackendSetup-<version>.exe` that:

- Prompts for install directory
- Installs `AutoSBCBackend.exe` and README
- Optionally adds a desktop shortcut & startup (Run at login) entry
- Uninstaller cleans up state/log files generated at runtime.

You can adjust install icon (`pictures/solveBtn.ico`) or add more files by editing `installer/AutoSBCBackendInstaller.iss`.

### Shoutouts

Thanks to [Regista6](https://github.com/Regista6) for showing the way with the google OR tools

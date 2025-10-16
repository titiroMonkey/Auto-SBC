## EAFC Automated SBC Solving ⚽

If you want to add any new features to the idedas section of the discussions tab and ill try to implement them.

#### The goal is to automatically solve the SBC using the currently available players in the club with the minimum cost.

### Frontend

The project utilizes [tamper monkey script](https://www.tampermonkey.net/) to output the users Club Player Data.
Install the tampermonkey extension and then install [the frontend script](https://github.com/titiroMonkey/Auto-SBC/blob/main/tampermonkey-ai-sbc.user.js)

This script implements a number of backend functions but the main feature is a Solve SBC button on each SBC that send players to the backend solver. The solver will attempt to use the current sbc solution as a starting point. This means subsequent solves ( pushing solve sbc button ) will use the previous solve as a starting point.

![solveBtn](https://github.com/titiroMonkey/Auto-SBC/blob/main/pictures/solveBtn.jpg?raw=true)

Players will also get SBC Lock button to not send use this player in the solution (if its a duplicate it will get sent)

Also a set the cost of this player to 0 button so it will get most likely get used if it can be fit into the SBC.
This is useful to get rid of high rated duplicates or overpriced SBCS.

![solveBtn](https://github.com/titiroMonkey/Auto-SBC/blob/main/pictures/Player.jpg?raw=true)

Check out the settings menu item for extra details!

### Backend

Run `pip3 install -r requirements.txt` to install the required dependencies.
To run the backend (now packaged under `backend/`), run:

```
cd backend
python -m uvicorn main:app --reload
```

- [Google OR-Tools](https://github.com/google/or-tools)
- Python 3.9
- pandas
- openpyxl
- fastapi
- uvicorn

The constraints used in the program are created in the `optimize.py` file based of the SBC requirements and the optimization problem is solved using [Google CP-SAT solver](https://developers.google.com/optimization/cp/cp_solver).

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

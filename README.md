# EduCore — Multi-Tenant School Management System

> Full-stack MVP built with **Django 4.2 + DRF + PostgreSQL** (backend) and **React 18 + Vite + Tailwind CSS** (frontend).

---

## 🗂️ Complete Project Structure

```
school-management/
├── backend/
│   ├── config/
│   │   ├── settings/
│   │   │   ├── __init__.py     ← auto-selects dev/prod via DJANGO_ENV
│   │   │   ├── base.py         ← shared: DRF, JWT, CORS, Djoser
│   │   │   ├── dev.py          ← PostgreSQL + debug logging
│   │   │   └── prod.py         ← secure headers, SSL, WhiteNoise
│   │   ├── urls.py             ← all app routers registered here
│   │   ├── wsgi.py / asgi.py
│   ├── apps/
│   │   ├── accounts/           ← Custom User, RBAC, Signals, JWT
│   │   ├── schools/            ← School model + SchoolMiddleware
│   │   ├── students/           ← Student CRUD + class/section filters
│   │   ├── teachers/           ← Teacher CRUD
│   │   ├── attendance/         ← Bulk mark + Report endpoint
│   │   ├── exams/              ← Exam/Subject/Result + student card
│   │   └── fees/               ← FeeStructure + Payment + collection
│   ├── scripts/
│   │   └── seed.py             ← Demo data (1 school, 3 teachers, 10 students)
│   ├── apps/tests.py           ← 25+ unit tests
│   ├── manage.py
│   ├── requirements.txt
│   ├── pytest.ini
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   │   └── AuthContext.jsx ← Global auth + JWT rehydration
│   │   ├── services/
│   │   │   └── api.js          ← Axios + auto-refresh interceptors
│   │   ├── hooks/
│   │   │   └── index.js        ← useAuth, useApi, usePagination
│   │   ├── components/
│   │   │   ├── layout/         ← Sidebar, Header, Layout
│   │   │   └── common/         ← Modal, DataTable, StatCard, Badge…
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Students.jsx
│   │   │   ├── Teachers.jsx
│   │   │   ├── Attendance.jsx
│   │   │   ├── Exams.jsx
│   │   │   └── Fees.jsx
│   │   ├── App.jsx             ← Routes + ProtectedRoute
│   │   ├── main.jsx
│   │   └── index.css           ← Design tokens + utility classes
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
├── .env.example
└── README.md
```

---

## ⚡ Quick Start (Local)

### 1. Clone and configure environment

```bash
git clone <repo-url> school-management
cd school-management
cp .env.example .env
# Edit .env with your DB credentials
```

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Seed demo data (1 school, 3 teachers, 10 students, exams, fees)
python manage.py shell < scripts/seed.py

# Start dev server
python manage.py runserver
# → http://localhost:8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## ⚡ Quick Start (Local Development)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@greenwood.edu` | `Admin@123` |
| Teacher | `priya.sharma@greenwood.edu` | `Teacher@123` |
| Teacher | `rajesh.kumar@greenwood.edu` | `Teacher@123` |
| Student | `aarav.patel@student.greenwood.edu` | `Student@123` |

---

## 🖥️ Desktop Mode (Stage 1 — backend + frontend, no Electron yet)

This repo is being converted into a fully local Windows desktop app: Electron
→ React → Django (via Waitress) → SQLite, with no cloud dependency. **Stage 1**
adds the desktop-mode backend and frontend build; it does **not** add
Electron, PyInstaller, Electron Forge, an installer, auto-update, code
signing, or a backup/restore UI — those come in later stages.

### Browser development workflow (unchanged)

This keeps working exactly as before:

```bash
# Backend
cd backend
.venv\Scripts\activate
python manage.py runserver
# → http://127.0.0.1:8000

# Frontend (separate terminal)
cd frontend
npm run dev
# → http://localhost:5173, proxies /api to http://127.0.0.1:8000
```

### Desktop backend workflow (new)

The desktop backend runs the same Django project through **Waitress**
instead of `runserver`, listening only on `127.0.0.1:8765`:

```bash
cd backend
.venv\Scripts\activate
pip install -r requirements.txt   # ensures waitress is installed
python desktop_launcher.py
# → http://127.0.0.1:8765
```

`desktop_launcher.py`:
1. Resolves `SCHOOL_DATA_DIR` (env var, or `%LOCALAPPDATA%\EduCore` by default).
2. Creates it if missing, and fails loudly (non-zero exit, logged) if it can't.
3. Loads `config.settings.desktop`, generating and persisting a random
   `SECRET_KEY` under `SCHOOL_DATA_DIR/.django-secret` on first run.
4. Runs `migrate` automatically (non-interactive).
5. Serves the app with Waitress on `127.0.0.1:8765` only.

Startup and error logs go to `SCHOOL_DATA_DIR/launcher.log` (and Django's own
`SCHOOL_DATA_DIR/desktop.log`), plus stderr. No secrets are ever printed or
logged.

### `SCHOOL_DATA_DIR`

All persistent, user-generated desktop data lives under one directory,
**outside** the source tree, so it survives reinstalls/updates:

| Data | Location |
|---|---|
| SQLite database | `SCHOOL_DATA_DIR/db.sqlite3` |
| Uploaded media (photos, logos) | `SCHOOL_DATA_DIR/media/` |
| Generated reports/exports | `SCHOOL_DATA_DIR/reports/` |
| Django secret key | `SCHOOL_DATA_DIR/.django-secret` |
| Logs | `SCHOOL_DATA_DIR/desktop.log`, `SCHOOL_DATA_DIR/launcher.log` |

Default: `%LOCALAPPDATA%\EduCore`. Override for local testing with, e.g.:

```bash
set SCHOOL_DATA_DIR=C:\path\to\temp-test-dir
python desktop_launcher.py
```

The repo's own `backend/db.sqlite3` and `backend/media/` (used by
`runserver`/browser development) are untouched by desktop mode — they're
two entirely separate databases and media stores.

### Health endpoint

```
GET /api/health/
```

Public (no auth), checks the database is reachable, returns:

```json
{"status": "ok", "service": "school-management-backend"}
```

### Desktop frontend build

```bash
cd frontend
npm run build:desktop
# → frontend/dist, built against VITE_API_URL from .env.desktop
```

Frontend env files (see `.env.example` / `.env.desktop.example` for
templates — real `.env*` files are gitignored, not committed):

| File | Used by | `VITE_API_URL` |
|---|---|---|
| `.env.development` | `npm run dev` | `http://127.0.0.1:8000` |
| `.env.desktop` | `npm run build:desktop` | `http://127.0.0.1:8765` |

Note: `VITE_API_URL` is the backend **origin only** — endpoint paths in
`src/services/api.js` already include their own `/api/...` prefix, so
requests end up at `http://127.0.0.1:8765/api/...` in desktop mode without
the env var itself containing `/api`.

### What Stage 1 does not include

No Electron process, no PyInstaller packaging, no Windows installer, no
auto-update, no code signing, no backup/restore UI. Stage 2 (below) adds the
Electron development shell; those items remain for a later stage.

---

## 🖥️ Desktop Mode (Stage 2 — Electron development)

Stage 2 adds an Electron shell for **development only**: it starts the
Stage 1 backend launcher itself, waits for both Django and Vite to be
ready, then opens a window loading React from the Vite dev server. It does
**not** add PyInstaller, Electron Forge, an installer, auto-update, or code
signing — those are Stage 3.

```text
Electron
  ├── loads React from the Vite dev server (http://127.0.0.1:5173)
  ├── starts backend/desktop_launcher.py (unless one is already healthy)
  ├── passes SCHOOL_DATA_DIR = <Electron userData>/data
  └── waits for GET /api/health/ before opening the window
```

### Prerequisites

- Node.js 18+ and npm (already required for the frontend).
- A Python virtual environment for the backend with `requirements.txt`
  installed — see [Backend](#2-backend) above. Electron does **not**
  install Python packages for you.
- Root-level Node dependencies (Electron itself, plus `concurrently` to run
  Vite and Electron together):

  ```bash
  npm install
  ```

### Running Stage 2

From the **repository root**:

```bash
npm run dev:desktop
```

This starts, in order: Vite (serving React on `http://127.0.0.1:5173`),
then Electron, which itself starts Django (`desktop_launcher.py`) and waits
for `/api/health/` before opening the window. Closing the Electron window
stops both Vite and Electron; Electron stops the backend it started.

Other root-level scripts:

| Script | What it does |
|---|---|
| `npm run dev:web` | Plain React dev server (`frontend`, unchanged from Stage 1) |
| `npm run dev:backend` | Plain Django dev server on `:8000` (unchanged from Stage 1) |
| `npm run dev:backend:desktop` | Stage 1 Waitress launcher on `:8765`, standalone (unchanged) |
| `npm run dev:frontend:electron` | Vite only, in Electron mode (`VITE_API_URL` → `:8765`) |
| `npm run dev:electron` | Electron only — expects Vite already running separately |
| `npm run dev:desktop` | Full Stage 2 flow: Vite → Electron → Django |

`npm run dev:electron` on its own is useful when you're already running
`npm run dev:frontend:electron` (or the plain `frontend` dev server, if its
`VITE_API_URL` is also pointed at `:8765`) in another terminal.

### Configuration

Copy `desktop/.env.example` to `desktop/.env` for local overrides (gitignored,
never committed — no machine-specific paths are hardcoded in tracked files):

| Variable | Default | Purpose |
|---|---|---|
| `ELECTRON_DEV_SERVER_URL` | `http://127.0.0.1:5173` | Origin Electron loads and is locked to for navigation |
| `DESKTOP_PYTHON_PATH` | `backend/.venv/Scripts/python.exe` | Python interpreter used to run the backend |
| `DESKTOP_BACKEND_LAUNCHER` | `backend/desktop_launcher.py` | Path to the launcher script |
| `ELECTRON_OPEN_DEVTOOLS` | unset | Set to `1` to auto-open DevTools (dev builds only) |

`frontend/.env.electron` (copy from `frontend/.env.electron.example`) sets
`VITE_API_URL=http://127.0.0.1:8765` for `npm run dev:frontend:electron` —
same Vite dev server as browser development, but pointed at the desktop
backend instead of the Django dev server.

### Desktop data location (Electron mode)

Unlike Stage 1's standalone Waitress testing (`%LOCALAPPDATA%\EduCore` by
default), Electron always uses its own per-user application data folder:

```text
<Electron userData>/data
```

On Windows this is typically
`%APPDATA%\school-management-desktop\data` — created automatically before
the backend starts, reused across restarts, and never deleted when you
close the app. This directory holds the same layout as Stage 1
(`db.sqlite3`, `media/`, `reports/`, log files) and is completely separate
from the repository's own `backend/db.sqlite3` / `backend/media/`.

### How duplicate backends are avoided

Before starting Django, Electron checks port `8765`:

- **Nothing listening** → starts `desktop_launcher.py` itself and tracks it
  as its own child process.
- **Something listening that answers `/api/health/` with the expected
  `{"status": "ok", "service": "school-management-backend"}` body** →
  reuses it without starting a second backend, and will not stop it on
  exit (it wasn't Electron's to stop).
- **Something listening that does *not* match** → treated as a conflict:
  Electron shows a clear error and exits without touching Django.

This means a second Electron instance, or `npm run dev:backend:desktop` run
alongside `npm run dev:desktop`, reuses the already-running backend instead
of racing another process over the same SQLite file.

### Security notes

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` — the
  renderer has no direct Node.js or filesystem access.
- The preload script exposes only `window.desktopApp = { isElectron,
  platform }` via `contextBridge` — no `ipcRenderer`, no `require`, no
  filesystem or process-execution APIs.
- Top-level navigation is restricted to the configured dev-server origin;
  only `https:` links opened via `window.open`/target-blank are handed to
  the system browser (`shell.openExternal`), everything else is denied.

### Troubleshooting

**"Port 8765 is already in use by another application"** — something other
than the school-management backend is bound to `8765`. Find and stop it
(`netstat -ano | findstr :8765` on Windows), then retry. Electron will
never start Django on top of an unrecognized listener.

**"Could not find a Python interpreter for the backend"** — no virtual
environment at `backend/.venv`. Create one and install dependencies (see
[Backend](#2-backend)), or set `DESKTOP_PYTHON_PATH` in `desktop/.env` to
an existing interpreter.

**Orphaned dev processes** — if a terminal was closed uncleanly, check for
stray listeners before starting again:

```bash
netstat -ano | findstr :8765
netstat -ano | findstr :5173
taskkill /PID <pid> /F
```

Under normal shutdown (closing the Electron window, or `Ctrl+C` on
`npm run dev:desktop`) Electron stops only the backend it started itself,
`concurrently -k` stops Vite alongside it, and no process is left behind.

### What Stage 2 does not include

No PyInstaller, no packaged Django executable, no Electron Forge, no
installer generation, no production Electron packaging, no auto-updater, no
code signing, no backup/restore UI, no cloud sync. React is still loaded
from the Vite **dev server** — loading the packaged `frontend/dist` build
inside Electron is a Stage 3 concern.

---

## 🖥️ Desktop Mode (Stage 3 — packaged backend executable)

Stage 3 packages the Django backend itself into a standalone Windows
executable with [PyInstaller](https://pyinstaller.org/), so Electron can
start it **without a system Python installation**:

```text
Electron
  ├── source mode:   starts backend/desktop_launcher.py via backend/.venv
  └── packaged mode: starts backend/dist/school-backend/school-backend.exe directly
        └── Waitress on 127.0.0.1:8765
              └── SQLite + media under <Electron userData>/data (unchanged from Stage 1/2)
```

Electron Forge, a Windows installer, an auto-updater, code signing, and
final distribution packaging are **not** part of Stage 3 — see
[What Stage 3 does not include](#what-stage-3-does-not-include).

### Prerequisites

- Everything from [Stage 2](#prerequisites) (backend venv, root Node deps).
- PyInstaller, installed as a **build-only** dependency — never required at
  runtime by the packaged executable itself:
  ```bash
  cd backend
  .venv\Scripts\pip install -r requirements-build.txt
  ```

### Building the backend executable

```bash
npm run build:backend
```

This runs `backend/scripts/build_backend.py`, which:

1. Removes any previous output at `backend/dist/school-backend/` and
   `backend/build/school-backend/` (nothing else).
2. Runs `collectstatic` into `backend/staticfiles/` using a throwaway
   `SCHOOL_DATA_DIR` — needed so WhiteNoise can serve Django admin's CSS/JS
   from inside the frozen bundle. This never runs again at app startup.
3. Runs PyInstaller against the committed **`backend/school-backend.spec`**
   in `--onedir` mode.
4. Prints the resulting executable path and onedir output size, or exits
   non-zero if any step fails.

Output:

```text
backend/
└── dist/
    └── school-backend/
        ├── school-backend.exe
        └── _internal/            # Python runtime, Django, migrations, templates, staticfiles, ...
```

The onedir build is currently ~90 MB. `--onefile` was deliberately not used
for Stage 3 (see [Limitations](#limitations)).

### `backend/school-backend.spec`

The spec file is the single source of truth for what gets bundled. All
paths resolve relative to the spec file itself (`os.path.abspath(SPEC)`),
so the build doesn't depend on any machine-specific absolute path. It:

- Uses `backend/desktop_launcher.py` — the same Stage 1 launcher, unchanged
  as the runtime entry point — as the PyInstaller entry script.
- Calls `django.setup()` at **build time** (introspection only, using a
  scratch `SCHOOL_DATA_DIR` under `backend/build/`, never real user data) to
  walk the actual Django app registry and copy each installed app's
  `migrations/`, `templates/`, and `locale/` directories as real on-disk
  files at the matching dotted-path location. This is necessary because
  Django's migration and template loaders discover files by walking real
  filesystem directories (`pkgutil`, `Path.glob`), not by following Python
  `import` statements — a plain hidden-imports list leaves them invisible
  inside a frozen bundle.
- Adds targeted `collect_submodules()` hidden imports for packages that Django/DRF/djoser
  resolve purely by dotted string in settings (middleware, authentication/permission/filter/pagination/renderer
  classes, storage/email backends) — `django` is collected as a whole
  *minus* contrib apps this project never uses (`gis`, `postgres`, `sites`,
  `redirects`, `sitemaps`, `flatpages`, `syndication`, `humanize`,
  `admindocs`), to avoid pulling in optional native dependencies (e.g. GDAL)
  this project has no use for.
- Bundles `backend/staticfiles/` (collectstatic's output) as data.
- **Strips one specific data file PyInstaller's own built-in
  `hook-django.py` adds automatically**: that hook globs `*.db`/`db.*` next
  to the Django project root and would otherwise bundle
  `backend/db.sqlite3` — the real local dev database — straight into the
  distributable. The spec explicitly excludes it (search the spec for
  `_BLOCKED_DATA_DEST`). Desktop mode never uses a bundled database; SQLite
  always comes from `SCHOOL_DATA_DIR` (see below).
- Excludes dev/lint/test-only tooling (`black`, `flake8`, `pytest`,
  `factory`, `faker`, `tkinter`, ...) that the running backend never needs.
- Builds with `console=True` (see [Console behaviour](#console-behaviour)).

### Source mode vs. packaged mode

| | Source mode (default) | Packaged mode |
|---|---|---|
| What Electron starts | `backend/desktop_launcher.py` via `backend/.venv` | `backend/dist/school-backend/school-backend.exe` |
| Requires a system/venv Python | Yes | No |
| Code changes take effect | Immediately | Only after `npm run build:backend` |
| Selected by | `DESKTOP_BACKEND_MODE` unset or `source` | `DESKTOP_BACKEND_MODE=packaged` |

Both modes bind Waitress to `127.0.0.1:8765` only, apply migrations
automatically, and read/write **the same** `SCHOOL_DATA_DIR` layout — they
are interchangeable from Electron's point of view. Setting
`DESKTOP_BACKEND_MODE` to anything other than `source`/`packaged` fails
loudly at startup (a dialog + non-zero exit) instead of silently picking a
mode.

```bash
# PowerShell
$env:DESKTOP_BACKEND_MODE = "packaged"; npm run dev:desktop

# Reset to source mode (or just leave the variable unset)
$env:DESKTOP_BACKEND_MODE = "source"; npm run dev:desktop
```

`DESKTOP_BACKEND_EXE` (see `desktop/.env.example`) overrides the packaged
executable path if it's not at the default
`backend/dist/school-backend/school-backend.exe`.

### `SCHOOL_DATA_DIR` (unchanged from Stage 1/2)

The packaged executable never hardcodes a database or media path — it reads
`SCHOOL_DATA_DIR` exactly like the source launcher does, and creates it if
missing. Electron always passes `<userData>/data`; running the executable
by hand requires setting it explicitly (see below).

### Running the packaged executable independently

```powershell
$env:SCHOOL_DATA_DIR = "C:\Temp\SchoolBackendData"
cd backend\dist\school-backend
.\school-backend.exe
```

Then, from another terminal: `curl http://127.0.0.1:8765/api/health/`
should return `{"status": "ok", "service": "school-management-backend"}`.
To verify it truly needs no system Python, copy the entire
`school-backend/` folder (not just the `.exe`) to a machine/location
without Python and run it the same way.

### How duplicate backends are avoided, security notes

Identical to [Stage 2](#how-duplicate-backends-are-avoided) — the reuse/
conflict detection, process ownership tracking, and Electron security
settings (`contextIsolation`, no `nodeIntegration`, restricted navigation)
apply the same way regardless of which backend mode is active.

### Console behaviour

The Stage 3 build keeps `console=True` deliberately — a visible console
window during development/testing means startup failures are immediately
visible, rather than silently swallowed by a hidden window. A console-free
variant is future work; it would need startup failures that occur *before*
logging is configured (a missing/unwritable `SCHOOL_DATA_DIR`) to still be
surfaced somewhere, since there's no console to print to at that point.

### Troubleshooting

**Missing resources at runtime (templates/static/migrations not found)** —
almost always means a data file needs adding to `school-backend.spec`'s
`extra_datas` list, or a class needs adding to `hiddenimports`. Check
`backend/build/school-backend/warn-school-backend.txt` after a build (see
below) and check `<SCHOOL_DATA_DIR>/desktop.log` for the actual runtime
traceback — **most backend log messages, including startup failures after
Django initializes (failed migrations, port conflicts, WSGI load errors) go
to `desktop.log`, not the console**, because Django's own `LOGGING` config
(`config/settings/desktop.py`) reconfigures the root logger the moment
`django.setup()` runs. Only messages logged *before* that point (directory
creation, `django.setup()` itself failing) reach the console and
`launcher.log`.

**How to read packaging warnings** — after any build,
`backend/build/school-backend/warn-school-backend.txt` lists every module
PyInstaller couldn't find. Most entries are expected and harmless: optional
imports for database backends this project doesn't use (PostgreSQL/MySQL/
Oracle drivers), optional DRF/djoser extras (`markdown`, `pyyaml`,
`webauthn`, `crispy_forms`), and optional cache backends (`redis`,
`pymemcache`). Anything referencing this project's own `apps.*` or
`config.*` modules would be worth investigating; nothing does today.

**Build fails with "backend/staticfiles/ is missing"** — the spec refuses
to build without collectstatic's output present (this is what admin's
CSS/JS come from). `npm run build:backend` runs `collectstatic`
automatically; only relevant if invoking `pyinstaller` directly.

### How to clean and rebuild

```bash
npm run build:backend
```

is already fully repeatable — it removes only its own previous output
(`backend/dist/school-backend/`, `backend/build/school-backend/`, and the
spec's scratch introspection directory) before rebuilding, never touching
unrelated files. `backend/build/` and `backend/dist/` are gitignored; the
`.spec` file itself is tracked.

### Limitations

- **`--onedir` only.** `--onefile`'s single-executable self-extraction adds
  startup latency and its own set of packaging edge cases; Stage 3 uses
  `--onedir` as specified and hasn't evaluated `--onefile` as a documented
  alternative.
- **No frontend bundled into the executable yet.** The packaged backend can
  serve a built `frontend/dist` (via `config/desktop_views.py`) once one is
  placed at `SCHOOL_FRONTEND_DIST`, but Stage 3 doesn't bundle it into the
  PyInstaller output — Electron dev mode always loads React from the Vite
  dev server regardless of backend mode. Bundling the frontend build is a
  Stage 4/distribution concern.
- **Console-visible only** — see [Console behaviour](#console-behaviour).
- **~90 MB onedir output** — mostly Django itself (PyInstaller's own
  built-in Django hook does a blanket `collect_all('django')`); not
  aggressively minimized in Stage 3.
- **Not tested on a clean Windows VM without Python.** Testing confirmed no
  Python interpreter is invoked and the build was copied to a location
  outside the repo and run successfully, but a fully clean machine (no
  Python anywhere on `PATH`, no dev tools installed) was not available in
  this environment.

### What Stage 3 does not include

No Electron Forge, no Windows installer, no auto-updater, no code signing,
no production/distribution packaging of the frontend, no `--onefile` build.
These remain for a later stage — see below.

---

## 🖥️ Desktop Mode (Stage 4 — Electron Forge packaging + Windows installer)

Stage 4 packages the whole desktop application — React build, Electron
shell, and the Stage 3 PyInstaller backend — into a single Windows
installer (`SchoolManagementSetup.exe`) using
[Electron Forge](https://www.electronforge.io/) with the Squirrel.Windows
maker:

```text
SchoolManagementSetup.exe
        ↓ (installs to %LOCALAPPDATA%\SchoolManagement)
SchoolManagement.exe
        ├── resources/app.asar        — desktop/*.cjs + frontend/dist (React build)
        └── resources/backend/school-backend/  — Stage 3 PyInstaller output, outside asar
                ↓
        Waitress on 127.0.0.1:8765 → SQLite + media under <userData>/data
```

Electron Forge, a Squirrel.Windows installer, and one placeholder icon are
implemented. Auto-updates, code signing, and release publishing are **not**
— see [What Stage 4 does not include](#what-stage-4-does-not-include).

### Prerequisites

Everything from [Stage 3](#prerequisites-1) (PyInstaller build tooling), plus
Electron Forge itself, already a root devDependency:

```bash
npm install
```

### Full desktop build command

```bash
npm run build:desktop
```

Runs, in order, failing immediately on any error:
1. `build:backend` — the Stage 3 PyInstaller build.
2. `build:frontend:desktop` — `vite build --mode desktop` (relative asset
   paths + `HashRouter`, see below).
3. `validate:desktop` — `desktop/scripts/validate-resources.cjs`, which
   confirms every required artifact exists and that nothing sensitive
   (dev database, dev media, `.env` secrets, the Python virtualenv, a
   stray `node_modules`) is reachable from what gets packaged.

### Unpacked package command

```bash
npm run package:desktop
```

Runs `build:desktop`, then `electron-forge package`. Output:

```text
out/
└── SchoolManagement-win32-x64/
    ├── SchoolManagement.exe
    ├── locales/
    └── resources/
        ├── app.asar                        # desktop/*.cjs + frontend/dist + package.json
        └── backend/school-backend/         # Stage 3 PyInstaller --onedir output, untouched
            ├── school-backend.exe
            └── _internal/
```

Always test this unpacked build (run `SchoolManagement.exe` directly) before
making an installer — it's the fastest way to catch a packaging problem.

### Installer command

```bash
npm run make:desktop
```

Runs `build:desktop` → `electron-forge package` → `electron-forge make`.
Output: `out/make/squirrel.windows/x64/SchoolManagementSetup.exe`, alongside
`SchoolManagement-<version>-full.nupkg` and a `RELEASES` manifest (both
Squirrel implementation details, not user-facing).

### `forge.config.cjs`

The single source of truth for packaging, resolved relative to the repo
root (never a machine-specific absolute path):

- **`packagerConfig.ignore`** — an *allowlist* function, not a blocklist:
  only `desktop/`, `frontend/dist/`, and `package.json` are copied into
  `app.asar`. Everything else (`backend/`, `.venv`, `frontend/src`,
  `node_modules`, docs, tests, `.git`) is excluded regardless of what
  exists in the working tree when packaging runs. None of `desktop/*.cjs`
  needs anything from `node_modules` at runtime (only Node built-ins and
  the `electron` module Electron provides natively), so `node_modules`
  doesn't need to ship at all — `app.asar` ends up under 1 MB.
  - **Non-obvious gotcha**: electron-packager's `ignore` function is called
    per-path and *stops recursing the moment a directory is ignored* — so
    an ancestor of an allowed path (e.g. `/frontend`, parent of the
    allowed `/frontend/dist`) must also resolve to "not ignored", or the
    allowed subtree underneath it is never visited. See the `KEEP_PREFIXES`
    ancestor-matching logic in `forge.config.cjs` if this needs extending.
- **`hooks.packageAfterCopy`** — copies `backend/dist/school-backend/`
  (the complete Stage 3 `--onedir` output, not just the `.exe`) into
  `resources/backend/school-backend/`, a sibling of `app.asar` — outside
  ASAR entirely, which a native executable requires to stay runnable.
  Throws (failing the build) if the backend hasn't been built yet.
- **`packagerConfig.asar: true`** — enabled for the (tiny) Electron
  source; the backend is never inside it (see above), so there's no
  native-executable-inside-asar problem to work around.
- **Squirrel maker config** — `name: "SchoolManagement"` (internal,
  Windows-safe, no spaces), `title: "EduCore — School Management System"`
  (in-app branding, unchanged from Stage 1–3), `setupExe:
  "SchoolManagementSetup.exe"`, `setupIcon`/`packagerConfig.icon` both
  point at `desktop/assets/icon.ico`, `noMsi: true` (one installer system
  only, per Stage 4 scope).

### Frontend changes for packaged loading

Electron loads the bundled React build directly via `file://`
(`BrowserWindow.loadFile`), never through the Django backend. Two things
about a `file://`-loaded SPA needed handling, both scoped to the desktop
build only (`vite build --mode desktop`) — normal web dev/prod builds are
untouched:

1. **Relative asset paths.** Vite's default `base: '/'` emits absolute
   `/assets/...` paths, which resolve against the filesystem root under
   `file://`, not the HTML file's own directory. `frontend/vite.config.js`
   sets `base: './'` only when `mode === 'desktop'`.
2. **Routing.** The app uses `BrowserRouter` (HTML5 History API), which
   needs a real server to fall back to `index.html` for nested paths —
   `file://` has none, so reopening or refreshing on e.g. `/students`
   would fail. `frontend/src/main.jsx` switches to `HashRouter` only when
   `import.meta.env.MODE === 'desktop'`. The one place that bypassed
   react-router with a raw `window.location.href = '/login'`
   (`frontend/src/services/api.js`'s session-expiry redirect) was updated
   to use `#/login` in desktop mode for the same reason — verified by
   grepping for every other raw `window.location` use in `frontend/src`
   (there are none).

### CORS fix specific to packaged mode

A `file://`-loaded page sends a literal `Origin: file://` header on
cross-origin requests. This was **not** covered by Stage 1–3's
`CORS_ALLOWED_ORIGINS` (only `http://127.0.0.1:8765` and the Vite dev
server origin were listed) — verified directly against the backend with
`curl -H "Origin: file://" ...` before the fix (no
`Access-Control-Allow-Origin` in the response, meaning a real browser
would silently block every API call the packaged app's React code makes,
even though the backend itself responds fine) and after (header present,
matching). `backend/config/settings/desktop.py` now appends `"file://"` to
`CORS_ALLOWED_ORIGINS`. This is additive and specific — not a blanket
CORS relaxation — and only affects `config.settings.desktop`, so
production/`prod.py` is untouched. Rebuild the backend
(`npm run build:backend`) after pulling this change for it to take effect
in the packaged `.exe`.

### Backend path resolution in packaged/installed mode

`desktop/utils/python-path.cjs`:
- `resolveBackendMode()` returns `'packaged'` unconditionally whenever
  `app.isPackaged` is true (an installed app has no Python venv to fall
  back to) — `DESKTOP_BACKEND_MODE` still works for dev/testing outside a
  packaged app, exactly as in Stage 3.
- `resolvePackagedExePath()` resolves
  `process.resourcesPath/backend/school-backend/school-backend.exe` when
  packaged, falling back to the Stage 3 repo-relative dev/test path
  otherwise. Throws a clear, actionable error (never a silent fallback to
  a source-repository path) if the executable is missing either way.

### Squirrel first-run/uninstall events

Squirrel.Windows doesn't create the Start Menu shortcut itself — it
launches the freshly (un)installed app once with a `--squirrel-install` /
`--squirrel-updated` / `--squirrel-uninstall` / `--squirrel-obsolete` flag
and expects the app to ask Squirrel's own `Update.exe` to create/remove
the shortcut, then exit immediately without showing a window.
`desktop/utils/squirrel-startup.cjs` implements this (checked at the very
top of `desktop/main.cjs`, before anything else runs) — a small local
reimplementation of the well-known `electron-squirrel-startup` package,
done this way specifically so the packaged app still ships zero
`node_modules` dependencies.

### Persistent data and logs (unchanged location, new identity)

Still `app.getPath('userData')/data` — SQLite, media, reports, and now
`logs/electron.log` (Stage 4) all live there. The *installed* app's
`userData` path is `%APPDATA%\school-management-desktop\` (from the root
`package.json`'s `name` field — dev-mode Electron runs still use their own
separate `%APPDATA%\Electron\` folder, as in Stage 1–3, so dev and
installed data never collide). Installer updates and reinstalls of the
same version never touch this folder; uninstalling doesn't either (see
below).

`desktop/utils/logger.cjs` writes `<userData>/data/logs/electron.log`
(5 MB rotation) covering: application startup, resolved backend mode and
executable path, backend process start/exit, health-check pass/fail,
frontend-load failures, and shutdown. It never logs passwords, tokens,
`SECRET_KEY`, or full environment dumps — callers only ever pass short,
specific status strings, never a request body or `process.env` dump.

### Uninstall behavior (tested)

`Update.exe --uninstall` (or the normal Windows "Apps & Features" entry,
listed as "EduCore — School Management System") removes the install
directory under `%LOCALAPPDATA%\SchoolManagement\` and the Start Menu
shortcut. **It does not touch `%APPDATA%\school-management-desktop\`** —
user data (database, media, logs) survives an uninstall by design, since
nothing in this stage was configured to delete it. There is currently no
in-app "erase my data" option; removing that folder by hand is the only
way to fully wipe local data.

### Troubleshooting

**Missing resources when packaging** — `npm run build:desktop`'s
`validate:desktop` step catches this before Forge even runs; read its
`FAIL` lines, each names the exact `npm run` command to fix it.

**Backend fails to start in the installed app** — check
`<userData>/data/logs/electron.log` first (resolved backend executable
path and process exit code are both logged there), then
`<userData>/data/desktop.log` for anything Django logged after
`django.setup()` — same split as Stage 3 (early failures go to
`electron.log`/`launcher.log`; anything after Django's own `LOGGING`
config takes over goes to `desktop.log`).

**Port 8765 conflicts** — identical to Stage 2/3: Electron only ever
reuses an existing listener if it answers the exact expected health-check
shape; anything else is reported as a clear conflict and nothing is
started or killed. `netstat -ano | findstr :8765` to find and stop a
stray process by hand.

**Unsigned application warnings** — see
[Antivirus and Windows warnings](#antivirus-and-windows-warnings) below.
Not a bug; no code signing was implemented in this stage.

### Antivirus and Windows warnings

`SchoolManagementSetup.exe` and `SchoolManagement.exe` are **unsigned** —
no code-signing certificate was available or requested for this stage.
Expect Windows SmartScreen to show an "unrecognized app" warning on first
run of the installer, and some antivirus products may flag an unsigned,
freshly-built Electron+Python executable heuristically. Neither was
observed as an actual detection during this stage's testing (only the
expected SmartScreen "unknown publisher" prompt on an unsigned `.exe`,
which is normal and does not indicate a real problem) — do not disable
antivirus protection or attempt to bypass SmartScreen to work around this;
the correct fix is code signing (Stage 5+, needs a real certificate).

### Clean rebuild

```bash
rm -rf out backend/dist backend/build frontend/dist
npm run make:desktop
```

`npm run build:backend` (via `scripts/build_backend.py`) already cleans
its own previous output; Forge's `out/` is safe to delete freely, it's
fully regenerated by `package:desktop`/`make:desktop`.

### Version updates

Bump `version` in the root `package.json` (Squirrel reads it from there
via `usePackageJson` defaults merged with the explicit `forge.config.cjs`
maker config) — `frontend/package.json`'s own `version` is independent
and doesn't need to match. Re-run `npm run make:desktop`; the new
installer's filename stays `SchoolManagementSetup.exe` (only its internal
NuGet package version changes), so distribute it under a version-specific
name yourself if you need to keep old installers around side by side.

### Clean Windows testing checklist

This stage's testing happened on the development machine only — no
second, genuinely Python/Node-free Windows machine or clean VM was
available. Everything short of that was verified: the unpacked app starts
no Python process (confirmed via `tasklist`), the installed app requires
no dev tools on `PATH`, and no source-repository path is referenced
anywhere in the packaged output. Before a real release, additionally
verify on a truly clean machine:

- [ ] Installer runs without .NET Framework already present (Squirrel
      bundles its own, but confirm on an older/minimal Windows image)
- [ ] No security software blocks installation outright (only the
      expected SmartScreen prompt)
- [ ] Full workflow (install → login → create/read → restart → uninstall)
      end to end with zero prior project files on the machine

### What Stage 4 does not include

No auto-updates, no update server, no release publishing, no code signing
(no certificate was available or requested for this stage), no
`--onefile` PyInstaller build, no MSI (Squirrel's own installer only), no
backup/restore UI, no license/subscription system. These remain for a
later stage.

Stage 5 (below) implemented the backup/restore item above. Code signing,
auto-update, MSI packaging, and multi-machine distribution remain future
work — see
[What Stage 5 does not include](#what-stage-5-does-not-include).

---

## 🖥️ Desktop Mode (Stage 5 — backup/restore, migration safety, diagnostics, release tooling)

Stage 5 turns the Stage 4 installer into software a school can actually
run unattended: reliable local backup/restore, automatic daily backups,
migration safety, integrity checks, sanitized logging/diagnostics, an
admin-only Settings UI, a single source of truth for the app version, and
a repeatable release build with an installer checksum. It deliberately
does **not** add cloud backup, online sync, auto-update, a license/
subscription system, or code signing — see
[What Stage 5 does not include](#what-stage-5-does-not-include).

```text
Settings (admin-only, React)
  ├── Create/Restore Backup, Open Backup Folder, Retention, Integrity Check
  ├── Open Logs Folder, Export Diagnostic Report, App Version, Data Directory
  │       ↓ (HTTP, admin-only DRF permission)
  ├── apps.backups — safe SQLite hot backup, zip format, checksums,
  │       validation, retention, integrity check, diagnostics
  │       ↓ (validate + stage happen over HTTP; the risky file swap doesn't)
  └── Electron IPC (narrow, allowlisted channels only)
          └── desktop/utils/restore.cjs — stop backend → rename-aside →
              swap staged files in → restart backend → health check →
              cleanup or automatic rollback
```

### Backup format

Each backup is a single `.zip`, named
`SchoolManagementBackup-YYYY-MM-DD-HH-mm-ss.zip`, containing:

```text
db.sqlite3        ← safe point-in-time SQLite snapshot (see below — never a raw file copy)
media/**          ← everything under the live media folder
metadata.json     ← format version, app version, created_at, kind (manual/automatic/pre_migration/pre_restore_safety)
checksums.json    ← SHA-256 of db.sqlite3 and every media file, checked on restore
```

Written atomically (`.tmp` suffix, then `os.replace()`), so a backup that
crashes partway through never leaves a corrupt file where a real backup
name is expected.

### Safe SQLite backup (not a file copy)

`apps.backups.services` never copies `db.sqlite3` while the app might be
writing to it. It opens a **read-only** connection to the live file
(`sqlite3.connect("file:...?mode=ro", uri=True)`) and uses SQLite's own
Online Backup API (`Connection.backup()`) to produce a consistent
snapshot — the same mechanism the `sqlite3` CLI's `.backup` command uses,
safe against concurrent writes without needing to stop the backend.

### Manual and automatic backups

- **Manual**: Settings → Create Backup (admin-only). Goes to
  `backups/manual/`.
- **Automatic**: runs once per day, at most once (checked against the
  newest existing automatic backup's real `created_at` from its
  `metadata.json`, never just a filename/mtime guess), triggered from
  `desktop_launcher.py` on startup after migrations. Goes to
  `backups/automatic/`.
- **Pre-migration**: an automatic backup taken right before any pending
  migration runs (see below), also in `backups/automatic/`, tagged
  `kind: "pre_migration"`.
- **Pre-restore safety**: taken automatically immediately before every
  restore, in `backups/safety/`, capped at the 3 most recent.
- **Retention**: configurable per kind (Settings; defaults 14/14),
  applied by created_at, never deletes the newest or only backup in a
  directory, and skips (never deletes) any file it can't read.

### Restore

Validation and staging happen over HTTP through Django (checked before
anything risky happens):

1. **Validate** — rejects a missing/corrupt zip, path traversal or
   absolute-path entries, blocked executable extensions
   (`.exe/.dll/.bat/.cmd/.ps1/.sh/.com/.scr/.msi`), an unsupported format
   version, and any tampered checksum — with a specific, readable reason
   for each rejection.
2. **Stage** — extracts a validated archive into
   `backups/_staging/restore/`, not yet touching live data.
3. **Restore** (Electron-only from here) — `desktop/utils/restore.cjs`:
   creates a safety backup of the current live data, stops the backend,
   renames the current `db.sqlite3`/`media/` aside (never deletes them),
   renames the staged files into place, restarts the backend, and waits
   for a health check. On any failure at any point, it renames the aside
   files straight back and restarts — a plain filesystem operation that
   doesn't depend on Django being reachable. The aside files are only
   deleted after the post-restart health check actually passes.

**Media restore policy: replace, not merge.** Restoring a backup sets
`media/` to exactly what's in that backup — files added after the backup
was taken are gone afterward. This is intentional (a merge policy has
much murkier correctness under partial failure) and is shown in the
restore confirmation dialog before the user confirms.

### Migration safety

`desktop_launcher.py`, on every startup:
1. Detects pending migrations via Django's own `MigrationExecutor`
   (best-effort — assumes "pending" on any detection error, so the safety
   backup still fires rather than silently skip it).
2. If any are pending, takes a `pre_migration` backup first (failure here
   is logged, never fatal — a failed backup attempt doesn't block a
   needed migration).
3. Runs `migrate` non-interactively.
4. Verifies connectivity afterward with a raw `SELECT 1`.
5. Logs the whole sequence to `data/logs/migrations.log`, a dedicated log
   file separate from the general launcher/desktop logs.

Never auto-rolls-back a migration destructively — if something goes
wrong, the pre-migration backup is there to restore from manually (see
[docs/RECOVERY.md](docs/RECOVERY.md)).

### Integrity checks and diagnostics

- **Integrity Check** (Settings, admin-only): verifies the live database
  connection and that expected core tables exist — no raw SQL is ever
  exposed to the renderer or the API caller, only a pass/fail result and
  a short reason.
- **Diagnostics** (Settings → Export Diagnostic Report): app/Django/
  Python/OS versions, data directory, database/media size, backup count
  and most recent backup time, integrity check result, and free/total
  disk space. Explicitly excludes passwords, tokens, `SECRET_KEY`, and
  any full environment dump — every field is either a version string, a
  count, a size, or a boolean.
- **Disk space checks**: run before backup/restore/migration operations
  that write meaningfully sized files; the operation is refused with a
  clear message rather than risking a partial write if there isn't
  enough free space.

### Logging

`data/logs/` holds `electron.log` (Electron/backend-process lifecycle,
Stage 4), `desktop.log` (Django's own log, Stage 1+), `launcher.log`
(pre-Django-setup startup events, Stage 1+), and the new
`migrations.log` (Stage 5). All rotate rather than grow unbounded. None
of them ever log passwords, tokens, `SECRET_KEY`, full request bodies, or
raw environment dumps — every call site logs a short, specific status
string.

### Admin-only Settings UI

`frontend/src/pages/Settings.jsx`, routed at `/settings`, restricted to
the `admin` role both at the React route level (`ProtectedRoute
allowedRoles={['admin']}`, non-admins are redirected away) **and** at the
Django REST layer (`IsSchoolAdmin` permission on every `apps.backups`
endpoint — a hidden button is never the only thing stopping a non-admin,
verified directly: a teacher token gets a 403, an unauthenticated request
gets a 401). Sections: Create/Restore Backup, backup list, Open Backup
Folder, Last Successful Backup, Retention configuration, Integrity Check,
Open Logs Folder, Export Diagnostic Report, App Version, and Data
Directory (path shown with the `Users\<name>` segment masked for
screenshots — a display courtesy only, not a real security boundary,
since the admin viewing it already has full access to their own
machine).

### Secure IPC (Stage 5 additions)

`desktop/utils/ipc-handlers.cjs` registers a small, explicit allowlist of
channels (`backup:choose-destination`, `backup:choose-file`,
`backup:open-folder`, `backup:copy-to`, `restore:finalize`,
`logs:open-folder`, `diagnostics:export`, `app:get-info`) — no channel
here runs a shell command, opens an arbitrary external URL, or exposes
environment variables to the renderer. The two channels that accept a
path-like argument (`backup:copy-to`'s destination folder,
`diagnostics:export`'s save location) only ever act on paths that came
back from a native OS file/folder picker the user just interacted with;
`backup:copy-to`'s source filename is additionally re-validated against
the real managed backup directories before any file is touched.
`contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`
are unchanged from Stage 2 — the preload script (`desktop/preload.cjs`)
still exposes only named wrapper functions via `contextBridge`, never
raw `ipcRenderer`.

### Single source of truth for the app version

The root `package.json`'s `"version"` field is the only place the
version is set. It reaches:
- **Electron** via `app.getVersion()` (Squirrel/Forge read the same
  field automatically).
- **Django** via a `SCHOOL_APP_VERSION` environment variable, set by
  `desktop/utils/backend-process.cjs` when it spawns the backend (reads
  the root `package.json` directly), read back with
  `os.environ.get("SCHOOL_APP_VERSION", "unknown")` — used in backup
  `metadata.json`, the Diagnostics endpoint, and the Settings page.
- **The installer and checksum file** via `npm run verify:release` (see
  below).

To release a new version: bump `version` in the root `package.json`,
then `npm run verify:release` — no other file needs editing for the
version number itself.

### Release build and checksum

```bash
npm run verify:release
```

`desktop/scripts/verify-release.cjs`: checks Git branch/working-tree
state and that a backend virtualenv exists (warnings only, except a
genuinely missing virtualenv, which is fatal), runs the full
`build:backend → build:frontend:desktop → validate:desktop →
electron-forge package → electron-forge make` pipeline (via the existing
`make:desktop` script — failing loudly on any step), computes the
installer's SHA-256, writes it next to the installer as
`SchoolManagementSetup-<version>.exe.sha256` (installer filename, hash,
version, generation timestamp), and prints every output path and size.
**This checksum verifies the file wasn't corrupted or tampered with in
transit — it is not a substitute for code signing** (no certificate was
available for this stage; see
[Antivirus and Windows warnings](#antivirus-and-windows-warnings)) and
does not by itself make Windows/SmartScreen trust the installer. Never
publishes anything automatically.

### Documentation added in Stage 5

- [docs/RELEASE_NOTES_TEMPLATE.md](docs/RELEASE_NOTES_TEMPLATE.md) — copy
  per release.
- [docs/PILOT_CHECKLIST.md](docs/PILOT_CHECKLIST.md) — single-computer
  deployment checklist, including a mandatory backup/restore drill before
  a school starts entering real data.
- [docs/RECOVERY.md](docs/RECOVERY.md) — what to do for startup failures,
  port conflicts, database integrity failures, restore/migration
  failures, reinstalling, Windows-account/machine changes, and storage
  replacement. Never recommends manually deleting the database as a
  first response.
- [docs/UNINSTALL_AND_DATA_RETENTION.md](docs/UNINSTALL_AND_DATA_RETENTION.md)
  — confirms uninstall does not delete school data by default, and
  documents the backup retention policy.

### What Stage 5 does not include

No cloud backup, no Google Drive/OneDrive integration, no online sync, no
auto-updater or update server, no license/subscription/billing system, no
multi-school SaaS mode, no PostgreSQL migration, no network server mode,
no mobile app, and no code signing (still no certificate available —
Stage 4's unsigned-installer notes still apply). These remain future
work, same as listed at the end of Stage 4.

---

## 🌐 API Reference

All endpoints require `Authorization: Bearer <access_token>` except login.

### Auth
```
POST   /api/auth/jwt/create/          Login → {access, refresh}
POST   /api/auth/jwt/refresh/         Refresh token
GET    /api/users/me/                 Current user profile
GET    /api/users/dashboard_stats/    Dashboard aggregate stats
```

### Schools
```
GET    /api/schools/                  List schools (scoped to user)
POST   /api/schools/                  Create school (superuser only)
```

### Students
```
GET    /api/students/                 List students (filter: class_name, section)
POST   /api/students/                 Create student profile
POST   /api/students/import-csv/      Bulk import students from CSV
PATCH  /api/students/{id}/            Update student
DELETE /api/students/{id}/            Delete student (admin only)
```

**Student CSV columns:**
- Required: `email`, `first_name`, `last_name`, `class_name`, `section`, `roll_number`
- Optional: `parent_contact`, `address`, `date_of_birth` (`YYYY-MM-DD`), `password`

### Teachers
```
GET    /api/teachers/                 List teachers (filter: subject)
POST   /api/teachers/                 Create teacher profile
PATCH  /api/teachers/{id}/            Update teacher
DELETE /api/teachers/{id}/            Delete teacher (admin only)
```

### Attendance
```
GET    /api/attendance/               List records (filter: date, class, section, status)
POST   /api/attendance/bulk-mark/     Mark entire class at once (idempotent)
GET    /api/attendance/report/        Aggregate % per student (filter: class, section, date range)
```

**Bulk mark request:**
```json
{
  "date": "2024-09-01",
  "records": [
    {"student_id": 1, "status": "present"},
    {"student_id": 2, "status": "absent", "remarks": "sick"}
  ]
}
```

### Exams
```
GET    /api/exams/                    List exams
POST   /api/exams/                    Create exam
GET    /api/subjects/                 List subjects
POST   /api/subjects/                 Create subject
GET    /api/results/                  List results (filter: exam, student, class)
POST   /api/results/                  Add marks
GET    /api/results/student-card/     ?student=<id>&exam=<id> → full report card
GET    /api/results/class-summary/    ?class_name=10&exam=<id> → ranked list
```

### Fees
```
GET    /api/fee-structures/           List fee structures (filter: class, year)
POST   /api/fee-structures/           Create structure
GET    /api/payments/                 List payments (filter: status, class, date)
POST   /api/payments/pay/             Record a payment (auto-computes status)
GET    /api/payments/student-status/  ?student=<id>&academic_year=2024-25
GET    /api/payments/collection-summary/ ?academic_year=2024-25
```

---

## 🏗️ Architecture Decisions

### Multi-tenancy
Every model has `school = ForeignKey(School)`. The `SchoolMiddleware` attaches `request.school` from the JWT user. Every ViewSet's `get_queryset()` does `.filter(school=request.user.school)` — enforcing isolation at the SQL level.

### Custom User (AbstractBaseUser)
Full control over required fields. Email as `USERNAME_FIELD`. Roles stored as `CharField(choices)` — not Django groups — for simplicity and direct permission checks.

### Signal-driven profile creation
`post_save` on `User` auto-creates `Student` or `Teacher` based on role. User creation stays atomic from the API.

### Idempotent bulk attendance
`update_or_create()` per record — calling bulk-mark twice safely updates, never duplicates. The `unique_together = [('student', 'date')]` constraint is the database-level safety net.

### Grade computation on save
`Result.save()` calls `compute_grade()` and stores the result. No runtime calculation on every read — consistent, queryable, filterable.

### JWT auto-refresh
Axios response interceptor catches 401, queues all concurrent requests, refreshes the token once, then retries all queued requests with the new token. No request is lost during a token refresh.

---

## 🧪 Running Tests

```bash
cd backend

# Django test runner
python manage.py test apps

# pytest (recommended)
pip install pytest pytest-django
pytest

# With coverage
pip install pytest-cov
pytest --cov=apps --cov-report=html
```

### Test coverage includes
- User model (roles, full_name, superuser creation)
- Auth API (login, wrong password, me endpoint)
- Multi-tenancy (School A admin cannot see School B students)
- Student CRUD + filters + permissions
- Bulk attendance (idempotency, cross-school rejection)
- Exam/Result (grade boundaries, student card endpoint)
- Fee (full/partial payment status, student fee status, collection summary)
- Permission boundaries (student/teacher role restrictions)

---

## 🔒 Security Checklist

| Item | Status |
|------|--------|
| JWT access tokens (1 hr) + refresh (7 days) | ✅ |
| Token blacklisting on rotation | ✅ |
| School-scoped queryset on every endpoint | ✅ |
| Role-based permission classes | ✅ |
| HTTPS-ready (prod settings) | ✅ |
| HSTS, XFrame, CSRF headers (prod) | ✅ |
| No superuser required for school operations | ✅ |

---

## 📦 Key Dependencies

### Backend
| Package | Purpose |
|---------|---------|
| `django==4.2` | Web framework |
| `djangorestframework` | REST API |
| `djangorestframework-simplejwt` | JWT auth |
| `djoser` | Auth endpoints (login, register) |
| `django-filter` | QuerySet filtering |
| `django-cors-headers` | CORS for React dev server |
| `psycopg2-binary` | PostgreSQL adapter |
| `whitenoise` | Static file serving in production |
| `gunicorn` | WSGI server |
| `waitress` | WSGI server for desktop mode (Stage 1+) |
| `pyinstaller` (`requirements-build.txt`, build-only) | Packages the desktop backend into a standalone `.exe` (Stage 3) |

### Frontend
| Package | Purpose |
|---------|---------|
| `react 18` | UI framework |
| `react-router-dom 6` | Client-side routing (`HashRouter` in the desktop build, Stage 4) |
| `axios` | HTTP client + interceptors |
| `recharts` | Dashboard charts |
| `react-hot-toast` | Toast notifications |
| `tailwindcss` | Utility CSS |

### Desktop (root `package.json`)
| Package | Purpose |
|---------|---------|
| `electron` | Desktop shell runtime |
| `@electron-forge/cli` | Packaging/installer CLI (Stage 4) |
| `@electron-forge/maker-squirrel` | Windows installer (Squirrel.Windows), Stage 4 |
| `concurrently` | Runs Vite + Electron together in dev (Stage 2) |

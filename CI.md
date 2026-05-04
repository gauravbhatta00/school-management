**CI / GitHub Actions Overview**

This project now includes a basic GitHub Actions workflow at `.github/workflows/ci.yml`.

- **What it runs**:
  - `lint` job: checks Python formatting with `black --check` and runs `flake8` on the `backend` folder.
  - `backend` job: runs pytest in the `backend` directory using a Python matrix (3.10, 3.11).
  - `frontend` job: installs Node dependencies in `frontend` and runs `npm test`.

- **When it runs**: on `push` and `pull_request` targeting `main`/`master`.

How to run locally (backend):

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
pytest -q
```

How to run linters locally:

```bash
pip install black flake8
black --check backend
flake8 backend
```

How to run frontend tests locally:

```bash
cd frontend
npm ci
npm test
```

Next recommended improvements:
- Add exact `black` and `flake8` configuration files (e.g., `pyproject.toml`, `.flake8`).
- Add environment/secrets guidance for Django settings when running in CI (use repository `Secrets`).
- Add `collectstatic` or database setup if Django tests require full integration.

Secrets and enforcement:

- The workflow now reads `SECRET_KEY` and `DATABASE_URL` from repository Secrets and runs `python manage.py migrate` before tests. Add those Secrets in GitHub: **Settings → Secrets and variables → Actions**.
- Lint failures are enforced: `black --check` and `flake8` now fail the workflow on violations.

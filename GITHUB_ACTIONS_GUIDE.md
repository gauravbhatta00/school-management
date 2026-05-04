# GitHub Actions Guide – Understanding & Verifying Your CI/CD

## How to Check & Verify the Workflow

### Step 1: Push to GitHub
```bash
git add .github/workflows/ci.yml CI.md
git commit -m "Add GitHub Actions CI workflow"
git push origin main
```

### Step 2: View the Actions Tab in GitHub
1. Go to your repository on GitHub.
2. Click the **"Actions"** tab at the top.
3. You'll see your workflow runs listed under the name "**CI**".
4. Click on a run to see detailed logs for each job.

### Step 3: Understand the Workflow Execution Flow

The workflow runs **3 jobs in parallel** (after lint completes):

```
On push/PR to main/master:
│
├─ Job: lint (runs first)
│  ├─ Setup Python 3.11
│  ├─ Install black & flake8
│  ├─ Run black --check backend
│  └─ Run flake8 backend
│
├─ Job: backend (waits for lint)
│  ├─ Setup Python 3.10 / 3.11 (matrix)
│  ├─ Cache pip dependencies
│  ├─ Install from requirements.txt
│  └─ Run pytest -q
│
└─ Job: frontend (runs independently)
   ├─ Setup Node 18
   ├─ Cache node_modules
   ├─ npm ci
   └─ npm test
```

### Step 4: Check Workflow Status in VS Code

Install the **GitHub Actions** extension:
- Search "GitHub Actions" in Extensions and install `github.vscode-github-actions`.
- Open the Command Palette (`Ctrl+Shift+P`) → "GitHub Actions: View Workflows"
- See live status without opening GitHub.

### Step 5: Understand the Logs

After your workflow runs, click a job to see:
- **Checkmark ✓** = Job succeeded
- **Red ✗** = Job failed (click to expand and see error)
- Each step shows `✓ Setup Python`, `✓ Install dependencies`, etc.

## Common Issues & How to Debug

### Issue: Backend tests fail locally but pass in CI
**Fix:** Check Python version mismatch (CI tests on 3.10 & 3.11).
```bash
python --version  # Ensure 3.10+
cd backend && pytest -q --tb=short
```

### Issue: `pip cache` not working
**Diagnosis:** GitHub Actions auto-caches pip, but key must match.
**View cache:** GitHub → Settings → Actions → Caches

### Issue: Frontend `npm test` fails but not locally
**Fix:** Ensure `package-lock.json` is committed (npm ci needs exact versions).
```bash
cd frontend
npm ci  # Respects package-lock.json (strict)
npm test
```

### Issue: Lint warnings fail the workflow
**Current:** Linting uses `|| true` so it won't block the run.
**To enforce:** Remove `|| true` from the workflow.

## Manual Workflow Triggers (Optional)

You can manually trigger the workflow without pushing:
1. Go to **Actions** tab on GitHub.
2. Select the **CI** workflow on the left.
3. Click **"Run workflow"** → Choose branch → **"Run workflow"**.

## Environment Secrets (Advanced)

If Django needs environment variables in CI:
1. Go to **Settings** → **Secrets and variables** → **Actions**.
2. Add secrets like `DATABASE_URL`, `SECRET_KEY`, etc.
3. Reference in workflow:
```yaml
env:
  SECRET_KEY: ${{ secrets.SECRET_KEY }}
```

## Summary: Workflow Execution Order

1. **Event Trigger:** Push to main/master or open PR
2. **lint job starts** → Checks code style
3. **backend job waits** for lint to complete, then runs on Python 3.10 & 3.11 in parallel
4. **frontend job runs independently** → No dependencies
5. **All complete** → GitHub displays ✓ or ✗ status on the PR/commit

## Next Steps to Improve

- [ ] Add Django environment setup (migrations, DB, SECRET_KEY)
- [ ] Add code coverage reporting (codecov/coveralls)
- [ ] Add Docker build step (if using Docker for deployment)
- [ ] Add automatic deployment to staging on success (CD step)
- [ ] Add YAML linting with `yamllint` for the workflow itself

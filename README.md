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
│   └── Dockerfile
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
│   ├── nginx.conf              ← SPA fallback + /api proxy
│   └── Dockerfile
├── docker-compose.yml
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

## 🐳 Docker (Full Stack)

```bash
# From project root
cp .env.example .env
docker compose up --build

# Frontend → http://localhost
# Backend API → http://localhost:8000
# Django Admin → http://localhost:8000/admin
```

---

## 🔑 Demo Credentials (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@greenwood.edu` | `Admin@123` |
| Teacher | `priya.sharma@greenwood.edu` | `Teacher@123` |
| Teacher | `rajesh.kumar@greenwood.edu` | `Teacher@123` |
| Student | `aarav.patel@student.greenwood.edu` | `Student@123` |

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
| Non-root Docker user | ✅ |
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

### Frontend
| Package | Purpose |
|---------|---------|
| `react 18` | UI framework |
| `react-router-dom 6` | Client-side routing |
| `axios` | HTTP client + interceptors |
| `recharts` | Dashboard charts |
| `react-hot-toast` | Toast notifications |
| `tailwindcss` | Utility CSS |

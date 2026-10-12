# 🏥 HMS — Hospital Management System

A full-stack Hospital Management System built with **Flask**, **Vue.js 3**, **SQLite**, **Redis**, and **Celery**.

---

## ✅ Features

### Roles
| Role    | Capabilities |
|---------|-------------|
| Admin   | Manage doctors/patients, view all appointments, search, blacklist |
| Doctor  | View appointments, mark complete, enter treatments, set availability |
| Patient | Register, browse doctors by dept, book/cancel/reschedule, view history |

### Tech Stack
- **Backend**: Flask + SQLAlchemy + JWT Auth
- **Frontend**: Vue.js 3 + Vue Router + Bootstrap 5
- **Database**: SQLite (auto-created on first run)
- **Cache**: Redis (via Flask-Caching)
- **Jobs**: Celery + Redis (daily reminders, monthly reports, CSV export)

---

## 🚀 Local Setup

### 1. Prerequisites
- Python 3.9+
- Redis server running on `localhost:6379`
- pip

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Start Redis (if not running)
```bash
# macOS
brew services start redis

# Ubuntu/Debian
sudo service redis-server start

# Or run directly
redis-server
```

### 4. Run the Flask App
```bash
# From inside the backend/ folder (evaluation mode):
cd backend
python app.py

# OR from the project root:
python backend/app.py
```
App will be available at: **http://localhost:5000**

### 5. (Optional) Start Celery Worker
```bash
# In a new terminal, from the project root:
celery -A backend.celery_worker.celery_app worker --loglevel=info
```

### 6. (Optional) Start Celery Beat (scheduled tasks)
```bash
# In another terminal:
celery -A backend.celery_worker.celery_app beat --loglevel=info
```

---

## 🔑 Default Credentials

| Role  | Username | Password |
|-------|----------|----------|
| Admin | `admin`  | `admin`  |

> Patients register via the signup page. Doctors are added by Admin.

---

## 📁 Project Structure

```
hms/
├── run.py                    # Entry point
├── requirements.txt
├── README.md
├── backend/
│   ├── app.py                # Flask app + config + init_db
│   ├── models.py             # SQLAlchemy models
│   ├── extensions.py         # db, bcrypt, cache
│   ├── tasks.py              # Celery tasks
│   ├── celery_worker.py      # Celery app factory
│   └── routes/
│       ├── auth.py           # Login, register, JWT
│       ├── admin.py          # Admin endpoints
│       ├── doctor.py         # Doctor endpoints
│       └── patient.py        # Patient endpoints
├── templates/
│   └── index.html            # Jinja2 entry point → Vue SPA
└── static/
    ├── css/main.css          # Custom styles
    └── js/app.js             # Vue 3 SPA (all pages)
```

---

## 🗄️ Database Models

- **User** — id, username, email, password_hash, role, status, created_at
- **Doctor** — id, user_id, name, specialization, experience_years, department_id, profile_description
- **Patient** — id, user_id, name, phone, address, date_of_birth
- **Department** — id, name, description
- **Appointment** — id, patient_id, doctor_id, department_id, date, time, status, created_at
- **DoctorAvailability** — id, doctor_id, date, morning_slot_available, evening_slot_available
- **Treatment** — id, appointment_id, diagnosis, prescription, doctor_notes, next_visit_date

---

## ⚙️ Environment Variables (optional)

| Variable          | Default                         | Description |
|-------------------|---------------------------------|-------------|
| `SECRET_KEY`      | `my_sec_key_r3`                 | JWT secret |
| `CACHE_TYPE`      | `SimpleCache`                   | `RedisCache` if Redis is available |
| `CACHE_REDIS_URL` | `redis://localhost:6379/0`      | Redis connection URL |

---

## 📋 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | Authenticate user |
| POST | `/api/register` | Register patient |
| GET | `/api/admin/dashboard` | Admin stats |
| POST | `/api/admin/doctors` | Add doctor |
| PUT | `/api/admin/doctors/<id>` | Update doctor |
| DELETE | `/api/admin/doctors/<id>` | Delete doctor |
| GET | `/api/admin/appointments` | All appointments |
| GET | `/api/admin/search` | Search doctors/patients |
| GET | `/api/doctor/dashboard` | Doctor overview |
| GET | `/api/doctor/appointments` | Doctor's appointments |
| POST | `/api/doctor/update-treatment` | Save treatment |
| POST | `/api/doctor/availability` | Set availability |
| GET | `/api/patient/departments` | List departments |
| GET | `/api/patient/doctors` | List doctors |
| POST | `/api/patient/book-appointment` | Book appointment |
| DELETE | `/api/patient/cancel-appointment/<id>` | Cancel appointment |
| PUT | `/api/patient/reschedule-appointment/<id>` | Reschedule |
| GET | `/api/patient/history` | Treatment history |
| POST | `/api/patient/export-history` | Export CSV |

---

## 📌 Notes

- The app runs **without Redis** (falls back to `SimpleCache`) — but Celery requires Redis.
- Double-booking prevention is enforced at the database level.
- JWT tokens expire in 24 hours.

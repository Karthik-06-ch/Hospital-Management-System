"""
HMS - Hospital Management System
Run with:  python app.py   (from inside backend/ folder)
       or  python backend/app.py  (from project root)
"""
import os
import sys

# ── Fix import paths so this file works when run directly ──────────
# Ensure the project ROOT is on sys.path so 'backend.xxx' imports work,
# and also ensure the backend folder itself is accessible.
_this_file = os.path.abspath(__file__)
_backend_dir = os.path.dirname(_this_file)       # .../hms/backend
_project_root = os.path.dirname(_backend_dir)    # .../hms

if _project_root not in sys.path:
    sys.path.insert(0, _project_root)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# ── Now safe to import ─────────────────────────────────────────────
from flask import Flask, render_template, send_from_directory
from flask_cors import CORS
from backend.extensions import db, bcrypt, cache


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'my_sec_key_r3')
    # DB lives one level up from backend/  → project_root/hms.db
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(_project_root, 'hms.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Fall back to SimpleCache if Redis is not running
    CACHE_TYPE = os.environ.get('CACHE_TYPE', 'SimpleCache')
    CACHE_REDIS_URL = os.environ.get('CACHE_REDIS_URL', 'redis://localhost:6379/0')
    CACHE_DEFAULT_TIMEOUT = 300


app = Flask(
    __name__,
    template_folder=os.path.join(_project_root, 'templates'),
    static_folder=os.path.join(_project_root, 'static'),
)
app.config.from_object(Config)

# ── Extensions ─────────────────────────────────────────────────────
CORS(app)
db.init_app(app)
bcrypt.init_app(app)
cache.init_app(app)

# ── Blueprints ─────────────────────────────────────────────────────
from backend.routes.auth    import auth_bp
from backend.routes.admin   import admin_bp
from backend.routes.doctor  import doctor_bp
from backend.routes.patient import patient_bp

app.register_blueprint(auth_bp,    url_prefix='/api')
app.register_blueprint(admin_bp,   url_prefix='/api/admin')
app.register_blueprint(doctor_bp,  url_prefix='/api/doctor')
app.register_blueprint(patient_bp, url_prefix='/api/patient')


# ── Database seed ──────────────────────────────────────────────────
def init_db():
    with app.app_context():
        db.create_all()
        from backend.models import User, Department, Doctor, Patient
        import datetime

        # Only seed if admin doesn't exist yet
        if User.query.filter_by(username='admin').first():
            print("✅  Database already initialised.")
            return

        # ── Departments ────────────────────────────────────────────
        deps_data = [
            ('Cardiology',      'Heart and cardiovascular system'),
            ('Neurology',       'Brain, spine and nervous system'),
            ('Orthopedics',     'Bones, joints and muscles'),
            ('Pediatrics',      'Medical care for infants and children'),
            ('Dermatology',     'Skin, hair and nail conditions'),
            ('General Medicine','Primary health care and general wellness'),
        ]
        depts = {}
        for name, desc in deps_data:
            d = Department(name=name, description=desc)
            db.session.add(d)
            depts[name] = d
        db.session.flush()

        # ── Admin ──────────────────────────────────────────────────
        admin = User(
            username='admin',
            email='admin@hms.com',
            password_hash=bcrypt.generate_password_hash('admin').decode('utf-8'),
            role='admin',
        )
        db.session.add(admin)


        db.session.commit()
        print("✅  Database initialised — only admin created. No demo data.")
        print("    Login → username: admin  /  password: admin")


# ── Static / SPA routes ────────────────────────────────────────────
@app.route('/frontend/<path:filename>')
def serve_frontend(filename):
    return send_from_directory(os.path.join(_project_root, 'frontend'), filename)


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    if path.startswith('api/'):
        return {"error": "Not found"}, 404
    return render_template('index.html')


# ── Entry point ────────────────────────────────────────────────────
if __name__ == '__main__':
    init_db()
    print("🏥  HMS running at http://localhost:5000")
    app.run(debug=True, port=5000)

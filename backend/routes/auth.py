import jwt
import datetime
from functools import wraps
from flask import Blueprint, request, jsonify, current_app
from backend.extensions import db, bcrypt
from backend.models import User, Patient, Doctor, Department

auth_bp = Blueprint('auth', __name__)


# ── JWT decorator ──────────────────────────────────────────────────
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            token = token.split(' ')[1]
            data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = User.query.get(data['id'])
            if not current_user:
                raise Exception('User not found')
            # Block blacklisted users on every request
            if current_user.status == 'blacklisted':
                return jsonify({'message': 'Your account has been blacklisted. Access denied.'}), 403
        except Exception as e:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated


def roles_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(current_user, *args, **kwargs):
            if current_user.role not in roles:
                return jsonify({'message': 'Permission denied.'}), 403
            return f(current_user, *args, **kwargs)
        return decorated_function
    return decorator


# ── Login ──────────────────────────────────────────────────────────
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Username and password required'}), 401

    user = User.query.filter_by(username=data['username']).first()
    if not user:
        return jsonify({'message': 'User not found'}), 401

    # Blacklist check — hard block before password check
    if user.status == 'blacklisted':
        return jsonify({'message': 'Your account has been blacklisted. Please contact the hospital.'}), 403

    if not bcrypt.check_password_hash(user.password_hash, data['password']):
        return jsonify({'message': 'Invalid credentials'}), 401

    token = jwt.encode({
        'id': user.id,
        'role': user.role,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, current_app.config['SECRET_KEY'], algorithm='HS256')

    profile_id = None
    roll_no    = None
    if user.doctor_profile:
        profile_id = user.doctor_profile.id
        roll_no    = user.doctor_profile.roll_no
    elif user.patient_profile:
        profile_id = user.patient_profile.id

    return jsonify({
        'token':      token,
        'role':       user.role,
        'username':   user.username,
        'id':         user.id,
        'profile_id': profile_id,
        'roll_no':    roll_no,
    })


# ── Patient Register ───────────────────────────────────────────────
@auth_bp.route('/register', methods=['POST'])
def register_patient():
    data = request.get_json()

    required = ['username', 'email', 'password', 'name']
    for field in required:
        if not data.get(field):
            return jsonify({'message': f'{field} is required'}), 400

    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'Username already exists'}), 400
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Email already exists'}), 400

    new_user = User(
        username=data['username'],
        email=data['email'],
        password_hash=bcrypt.generate_password_hash(data['password']).decode('utf-8'),
        role='patient',
    )
    db.session.add(new_user)
    db.session.flush()

    new_patient = Patient(
        user_id=new_user.id,
        name=data['name'],
        phone=data.get('phone', ''),
        address=data.get('address', ''),
        date_of_birth=datetime.datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date()
            if data.get('date_of_birth') else None,
    )
    db.session.add(new_patient)
    db.session.commit()
    return jsonify({'message': 'Patient registered successfully'}), 201


# ── Doctor Self-Register ───────────────────────────────────────────
@auth_bp.route('/register-doctor', methods=['POST'])
def register_doctor():
    data = request.get_json()

    required = ['username', 'email', 'password', 'name', 'specialization']
    for field in required:
        if not data.get(field):
            return jsonify({'message': f'{field} is required'}), 400

    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'Username already exists'}), 400
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Email already exists'}), 400

    # Auto-generate unique roll number
    last_doc = Doctor.query.order_by(Doctor.id.desc()).first()
    next_num = (last_doc.id + 1) if last_doc else 1
    roll_no  = f'DOC-{next_num:04d}'

    # Resolve department if provided
    dept_id = data.get('department_id')
    if dept_id:
        dept = Department.query.get(dept_id)
        if not dept:
            dept_id = None

    new_user = User(
        username=data['username'],
        email=data['email'],
        password_hash=bcrypt.generate_password_hash(data['password']).decode('utf-8'),
        role='doctor',
    )
    db.session.add(new_user)
    db.session.flush()

    new_doctor = Doctor(
        user_id=new_user.id,
        roll_no=roll_no,
        name=data['name'],
        specialization=data['specialization'],
        experience_years=int(data.get('experience_years', 0)),
        department_id=dept_id,
        profile_description=data.get('profile_description', ''),
    )
    db.session.add(new_doctor)
    db.session.commit()

    return jsonify({
        'message': 'Doctor registered successfully',
        'roll_no': roll_no,
    }), 201


# ── Get departments (public, for register form) ────────────────────
@auth_bp.route('/departments', methods=['GET'])
def get_departments_public():
    depts = Department.query.all()
    return jsonify([d.to_dict() for d in depts])

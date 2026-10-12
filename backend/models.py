from datetime import datetime
from backend.extensions import db
import uuid


def generate_roll_no():
    """Generate unique doctor roll number like DOC-0001"""
    last = Doctor.query.order_by(Doctor.id.desc()).first()
    next_id = (last.id + 1) if last else 1
    return f"DOC-{next_id:04d}"


class User(db.Model):
    id            = db.Column(db.Integer, primary_key=True)
    username      = db.Column(db.String(80), unique=True, nullable=False)
    email         = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role          = db.Column(db.String(20), nullable=False)   # admin | doctor | patient
    status        = db.Column(db.String(20), default='active') # active | blacklisted
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    doctor_profile  = db.relationship('Doctor',  backref='user', uselist=False, cascade='all, delete-orphan')
    patient_profile = db.relationship('Patient', backref='user', uselist=False, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id, 'username': self.username,
            'email': self.email, 'role': self.role,
            'status': self.status, 'created_at': self.created_at.isoformat()
        }


class Department(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    name        = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)

    doctors = db.relationship('Doctor', backref='department', cascade='all, delete-orphan')

    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'description': self.description}


class Doctor(db.Model):
    id                  = db.Column(db.Integer, primary_key=True)
    user_id             = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    roll_no             = db.Column(db.String(20), unique=True, nullable=False)   # ← NEW: unique roll number
    name                = db.Column(db.String(100), nullable=False)
    specialization      = db.Column(db.String(100), nullable=False)
    experience_years    = db.Column(db.Integer, nullable=False, default=0)
    department_id       = db.Column(db.Integer, db.ForeignKey('department.id'))
    profile_description = db.Column(db.Text)

    availabilities = db.relationship('DoctorAvailability', backref='doctor', cascade='all, delete-orphan')
    appointments   = db.relationship('Appointment', backref='doctor_rel', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'roll_no': self.roll_no,
            'name': self.name,
            'specialization': self.specialization,
            'experience_years': self.experience_years,
            'department_id': self.department_id,
            'department_name': self.department.name if self.department else None,
            'profile_description': self.profile_description,
            'status': self.user.status,
            'email': self.user.email,
            'username': self.user.username,
        }


class Patient(db.Model):
    id            = db.Column(db.Integer, primary_key=True)
    user_id       = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name          = db.Column(db.String(100), nullable=False)
    phone         = db.Column(db.String(20))
    address       = db.Column(db.Text)
    date_of_birth = db.Column(db.Date)

    appointments = db.relationship('Appointment', backref='patient_rel', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'phone': self.phone,
            'address': self.address,
            'date_of_birth': self.date_of_birth.isoformat() if self.date_of_birth else None,
            'status': self.user.status,
            'email': self.user.email,
            'username': self.user.username,
        }


class Appointment(db.Model):
    id               = db.Column(db.Integer, primary_key=True)
    patient_id       = db.Column(db.Integer, db.ForeignKey('patient.id'), nullable=False)
    doctor_id        = db.Column(db.Integer, db.ForeignKey('doctor.id'), nullable=False)
    department_id    = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=False)
    appointment_date = db.Column(db.Date, nullable=False)
    appointment_time = db.Column(db.String(20), nullable=False)  # Morning | Evening
    status           = db.Column(db.String(20), default='booked')  # booked | completed | cancelled
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)

    treatment = db.relationship('Treatment', backref='appointment', uselist=False, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'patient_name': self.patient_rel.name if self.patient_rel else None,
            'doctor_id': self.doctor_id,
            'doctor_name': self.doctor_rel.name if self.doctor_rel else None,
            'doctor_roll_no': self.doctor_rel.roll_no if self.doctor_rel else None,
            'department_id': self.department_id,
            'department_name': self.doctor_rel.department.name if self.doctor_rel and self.doctor_rel.department else None,
            'appointment_date': self.appointment_date.isoformat(),
            'appointment_time': self.appointment_time,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
        }


class DoctorAvailability(db.Model):
    id                    = db.Column(db.Integer, primary_key=True)
    doctor_id             = db.Column(db.Integer, db.ForeignKey('doctor.id'), nullable=False)
    date                  = db.Column(db.Date, nullable=False)
    morning_slot_available = db.Column(db.Boolean, default=True)
    evening_slot_available = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'doctor_id': self.doctor_id,
            'date': self.date.isoformat(),
            'morning_slot_available': self.morning_slot_available,
            'evening_slot_available': self.evening_slot_available,
        }


class Treatment(db.Model):
    id             = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointment.id'), nullable=False)
    diagnosis      = db.Column(db.Text)
    prescription   = db.Column(db.Text)
    doctor_notes   = db.Column(db.Text)
    next_visit_date = db.Column(db.Date)

    def to_dict(self):
        return {
            'id': self.id,
            'appointment_id': self.appointment_id,
            'diagnosis': self.diagnosis,
            'prescription': self.prescription,
            'doctor_notes': self.doctor_notes,
            'next_visit_date': self.next_visit_date.isoformat() if self.next_visit_date else None,
        }

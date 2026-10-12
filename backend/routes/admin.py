from flask import Blueprint, request, jsonify, Response
from backend.extensions import db, bcrypt
from backend.models import User, Doctor, Patient, Appointment, Department
from backend.routes.auth import token_required, roles_required
import csv, io

admin_bp = Blueprint('admin', __name__)


@admin_bp.route('/dashboard', methods=['GET'])
@token_required
@roles_required('admin')
def get_dashboard(current_user):
    total_doctors      = Doctor.query.count()
    total_patients     = Patient.query.count()
    total_appointments = Appointment.query.count()
    booked_count       = Appointment.query.filter_by(status='booked').count()
    completed_count    = Appointment.query.filter_by(status='completed').count()
    return jsonify({
        'total_doctors':      total_doctors,
        'total_patients':     total_patients,
        'total_appointments': total_appointments,
        'booked_count':       booked_count,
        'completed_count':    completed_count,
    })


@admin_bp.route('/doctors', methods=['GET'])
@token_required
@roles_required('admin')
def list_doctors(current_user):
    return jsonify([d.to_dict() for d in Doctor.query.all()])


@admin_bp.route('/doctors', methods=['POST'])
@token_required
@roles_required('admin')
def add_doctor(current_user):
    data = request.get_json()

    if User.query.filter_by(username=data.get('username')).first():
        return jsonify({'message': 'Username already exists'}), 400
    if User.query.filter_by(email=data.get('email')).first():
        return jsonify({'message': 'Email already exists'}), 400

    # Auto-generate roll number
    last_doc = Doctor.query.order_by(Doctor.id.desc()).first()
    next_num = (last_doc.id + 1) if last_doc else 1
    roll_no  = f'DOC-{next_num:04d}'

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
        department_id=data.get('department_id'),
        profile_description=data.get('profile_description', ''),
    )
    db.session.add(new_doctor)
    db.session.commit()
    return jsonify({'message': 'Doctor added successfully', 'doctor': new_doctor.to_dict()}), 201


@admin_bp.route('/doctors/<int:id>', methods=['PUT'])
@token_required
@roles_required('admin')
def update_doctor(current_user, id):
    data   = request.get_json()
    doctor = Doctor.query.get_or_404(id)

    doctor.name                = data.get('name', doctor.name)
    doctor.specialization      = data.get('specialization', doctor.specialization)
    doctor.experience_years    = data.get('experience_years', doctor.experience_years)
    doctor.department_id       = data.get('department_id', doctor.department_id)
    doctor.profile_description = data.get('profile_description', doctor.profile_description)

    if 'status' in data:
        doctor.user.status = data['status']

    db.session.commit()
    return jsonify({'message': 'Doctor updated', 'doctor': doctor.to_dict()})


@admin_bp.route('/doctors/<int:id>', methods=['DELETE'])
@token_required
@roles_required('admin')
def delete_doctor(current_user, id):
    doctor = Doctor.query.get_or_404(id)
    user   = doctor.user
    db.session.delete(doctor)
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'Doctor deleted'})


@admin_bp.route('/doctors/<int:id>/blacklist', methods=['PUT'])
@token_required
@roles_required('admin')
def blacklist_doctor(current_user, id):
    doctor = Doctor.query.get_or_404(id)
    data   = request.get_json()
    doctor.user.status = data.get('status', 'blacklisted')
    db.session.commit()
    return jsonify({'message': f'Doctor status set to {doctor.user.status}'})


@admin_bp.route('/patients', methods=['GET'])
@token_required
@roles_required('admin')
def list_patients(current_user):
    return jsonify([p.to_dict() for p in Patient.query.all()])


@admin_bp.route('/patients/<int:id>/status', methods=['PUT'])
@token_required
@roles_required('admin')
def change_patient_status(current_user, id):
    patient = Patient.query.get_or_404(id)
    data    = request.get_json()
    patient.user.status = data.get('status', 'active')
    db.session.commit()
    return jsonify({'message': f'Patient status set to {patient.user.status}'})


@admin_bp.route('/appointments', methods=['GET'])
@token_required
@roles_required('admin')
def get_all_appointments(current_user):
    appts = Appointment.query.order_by(Appointment.appointment_date.desc()).all()
    return jsonify([a.to_dict() for a in appts])


@admin_bp.route('/search', methods=['GET'])
@token_required
@roles_required('admin')
def search(current_user):
    type_  = request.args.get('type')
    query  = request.args.get('query', '')

    if type_ == 'doctor':
        doctors = Doctor.query.filter(
            (Doctor.name.ilike(f'%{query}%')) |
            (Doctor.specialization.ilike(f'%{query}%')) |
            (Doctor.roll_no.ilike(f'%{query}%'))
        ).all()
        return jsonify([d.to_dict() for d in doctors])
    elif type_ == 'patient':
        patients = Patient.query.filter(Patient.name.ilike(f'%{query}%')).all()
        return jsonify([p.to_dict() for p in patients])
    return jsonify([])


@admin_bp.route('/patient-history/<int:id>', methods=['GET'])
@token_required
@roles_required('admin')
def view_patient_history(current_user, id):
    patient = Patient.query.get_or_404(id)
    appts   = Appointment.query.filter_by(patient_id=id) \
                .order_by(Appointment.appointment_date.desc()).all()
    history = []
    for i, appt in enumerate(appts):
        t = appt.treatment
        history.append({
            'visit_number':     len(appts) - i,
            'appointment_date': appt.appointment_date.isoformat(),
            'appointment_time': appt.appointment_time,
            'doctor_name':      appt.doctor_rel.name if appt.doctor_rel else None,
            'doctor_roll_no':   appt.doctor_rel.roll_no if appt.doctor_rel else None,
            'status':           appt.status,
            'diagnosis':        t.diagnosis if t else None,
            'prescription':     t.prescription if t else None,
            'doctor_notes':     t.doctor_notes if t else None,
            'next_visit_date':  t.next_visit_date.isoformat() if t and t.next_visit_date else None,
        })
    return jsonify({'patient': patient.to_dict(), 'history': history})


@admin_bp.route('/data', methods=['GET'])
@token_required
@roles_required('admin')
def get_all_data(current_user):
    return jsonify({
        'doctors':     [d.to_dict() for d in Doctor.query.all()],
        'patients':    [p.to_dict() for p in Patient.query.all()],
        'departments': [dep.to_dict() for dep in Department.query.all()],
    })


@admin_bp.route('/export/patients', methods=['POST'])
@token_required
@roles_required('admin')
def export_all_patients(current_user):
    patients = Patient.query.all()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        'patient_id', 'patient_name', 'email', 'phone', 'date_of_birth',
        'status', 'doctor_name', 'doctor_roll_no', 'appointment_date',
        'appointment_time', 'appt_status', 'diagnosis', 'prescription',
        'doctor_notes', 'next_visit'
    ])
    writer.writeheader()
    for patient in patients:
        appts = Appointment.query.filter_by(patient_id=patient.id).order_by(Appointment.appointment_date.desc()).all()
        if not appts:
            writer.writerow({
                'patient_id': patient.id, 'patient_name': patient.name,
                'email': patient.user.email if patient.user else '',
                'phone': patient.phone or '', 'date_of_birth': patient.date_of_birth.isoformat() if patient.date_of_birth else '',
                'status': patient.user.status if patient.user else '',
                'doctor_name': '', 'doctor_roll_no': '', 'appointment_date': '',
                'appointment_time': '', 'appt_status': '', 'diagnosis': '',
                'prescription': '', 'doctor_notes': '', 'next_visit': ''
            })
        for appt in appts:
            t = appt.treatment
            writer.writerow({
                'patient_id':       patient.id,
                'patient_name':     patient.name,
                'email':            patient.user.email if patient.user else '',
                'phone':            patient.phone or '',
                'date_of_birth':    patient.date_of_birth.isoformat() if patient.date_of_birth else '',
                'status':           patient.user.status if patient.user else '',
                'doctor_name':      appt.doctor_rel.name if appt.doctor_rel else '',
                'doctor_roll_no':   appt.doctor_rel.roll_no if appt.doctor_rel else '',
                'appointment_date': appt.appointment_date.isoformat(),
                'appointment_time': appt.appointment_time,
                'appt_status':      appt.status,
                'diagnosis':        t.diagnosis if t else '',
                'prescription':     t.prescription if t else '',
                'doctor_notes':     t.doctor_notes if t else '',
                'next_visit':       t.next_visit_date.isoformat() if t and t.next_visit_date else '',
            })
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=all_patients_history.csv'}
    )


@admin_bp.route('/export/doctors', methods=['POST'])
@token_required
@roles_required('admin')
def export_all_doctors(current_user):
    doctors = Doctor.query.all()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        'doctor_id', 'doctor_name', 'roll_no', 'specialization', 'department',
        'experience_years', 'status', 'patient_name', 'appointment_date',
        'appointment_time', 'appt_status', 'diagnosis', 'prescription',
        'doctor_notes', 'next_visit'
    ])
    writer.writeheader()
    for doctor in doctors:
        appts = Appointment.query.filter_by(doctor_id=doctor.id).order_by(Appointment.appointment_date.desc()).all()
        if not appts:
            writer.writerow({
                'doctor_id': doctor.id, 'doctor_name': doctor.name,
                'roll_no': doctor.roll_no, 'specialization': doctor.specialization,
                'department': doctor.department.name if doctor.department else '',
                'experience_years': doctor.experience_years,
                'status': doctor.user.status if doctor.user else '',
                'patient_name': '', 'appointment_date': '', 'appointment_time': '',
                'appt_status': '', 'diagnosis': '', 'prescription': '',
                'doctor_notes': '', 'next_visit': ''
            })
        for appt in appts:
            t = appt.treatment
            writer.writerow({
                'doctor_id':        doctor.id,
                'doctor_name':      doctor.name,
                'roll_no':          doctor.roll_no,
                'specialization':   doctor.specialization,
                'department':       doctor.department.name if doctor.department else '',
                'experience_years': doctor.experience_years,
                'status':           doctor.user.status if doctor.user else '',
                'patient_name':     appt.patient_rel.name if appt.patient_rel else '',
                'appointment_date': appt.appointment_date.isoformat(),
                'appointment_time': appt.appointment_time,
                'appt_status':      appt.status,
                'diagnosis':        t.diagnosis if t else '',
                'prescription':     t.prescription if t else '',
                'doctor_notes':     t.doctor_notes if t else '',
                'next_visit':       t.next_visit_date.isoformat() if t and t.next_visit_date else '',
            })
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=all_doctors_history.csv'}
    )


@admin_bp.route('/export/patient/<int:patient_id>', methods=['POST'])
@token_required
@roles_required('admin')
def export_single_patient(current_user, patient_id):
    patient = Patient.query.get_or_404(patient_id)
    appts = Appointment.query.filter_by(patient_id=patient_id).order_by(Appointment.appointment_date.desc()).all()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        'patient_id', 'patient_name', 'email', 'phone',
        'doctor_name', 'doctor_roll_no', 'appointment_date', 'appointment_time',
        'status', 'diagnosis', 'prescription', 'doctor_notes', 'next_visit'
    ])
    writer.writeheader()
    for appt in appts:
        t = appt.treatment
        writer.writerow({
            'patient_id':       patient.id,
            'patient_name':     patient.name,
            'email':            patient.user.email if patient.user else '',
            'phone':            patient.phone or '',
            'doctor_name':      appt.doctor_rel.name if appt.doctor_rel else '',
            'doctor_roll_no':   appt.doctor_rel.roll_no if appt.doctor_rel else '',
            'appointment_date': appt.appointment_date.isoformat(),
            'appointment_time': appt.appointment_time,
            'status':           appt.status,
            'diagnosis':        t.diagnosis if t else '',
            'prescription':     t.prescription if t else '',
            'doctor_notes':     t.doctor_notes if t else '',
            'next_visit':       t.next_visit_date.isoformat() if t and t.next_visit_date else '',
        })
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename=patient_{patient_id}_history.csv'}
    )

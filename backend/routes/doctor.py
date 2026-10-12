from flask import Blueprint, request, jsonify, Response
from datetime import datetime, timedelta
from backend.extensions import db, cache
from backend.models import Doctor, Appointment, Treatment, DoctorAvailability
from backend.routes.auth import token_required, roles_required
import csv, io

doctor_bp = Blueprint('doctor', __name__)


@doctor_bp.route('/dashboard', methods=['GET'])
@token_required
@roles_required('doctor')
def get_dashboard(current_user):
    doctor = current_user.doctor_profile
    if not doctor:
        return jsonify({'message': 'Profile not found'}), 404

    today = datetime.now().date()
    end_of_week = today + timedelta(days=7)

    upcoming = Appointment.query.filter(
        Appointment.doctor_id == doctor.id,
        Appointment.appointment_date >= today,
        Appointment.appointment_date <= end_of_week,
        Appointment.status == 'booked'
    ).order_by(Appointment.appointment_date.asc()).all()

    # Unique patients
    seen = set()
    patients = []
    for appt in Appointment.query.filter_by(doctor_id=doctor.id).all():
        if appt.patient_rel and appt.patient_rel.id not in seen:
            seen.add(appt.patient_rel.id)
            patients.append(appt.patient_rel.to_dict())

    return jsonify({
        'doctor': doctor.to_dict(),
        'upcoming_appointments': [a.to_dict() for a in upcoming],
        'assigned_patients': patients
    })


@doctor_bp.route('/appointments', methods=['GET'])
@token_required
@roles_required('doctor')
def get_appointments(current_user):
    doctor = current_user.doctor_profile
    if not doctor:
        return jsonify({'message': 'Profile not found'}), 404

    date_str = request.args.get('date')
    if date_str:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        appts = Appointment.query.filter_by(
            doctor_id=doctor.id, appointment_date=date_obj
        ).all()
    else:
        appts = Appointment.query.filter_by(doctor_id=doctor.id) \
            .order_by(Appointment.appointment_date.desc()).all()

    return jsonify([a.to_dict() for a in appts])


@doctor_bp.route('/complete-appointment', methods=['POST'])
@token_required
@roles_required('doctor')
def complete_appointment(current_user):
    data = request.get_json()
    appt_id = data.get('appointment_id')

    appt = Appointment.query.get_or_404(appt_id)
    if appt.doctor_rel.user_id != current_user.id:
        return jsonify({'message': 'Unauthorized'}), 403

    appt.status = 'completed'
    db.session.commit()
    return jsonify({'message': 'Appointment marked as completed', 'appointment': appt.to_dict()})


@doctor_bp.route('/cancel-appointment/<int:id>', methods=['DELETE'])
@token_required
@roles_required('doctor')
def cancel_appointment(current_user, id):
    appt = Appointment.query.get_or_404(id)
    if appt.doctor_rel.user_id != current_user.id:
        return jsonify({'message': 'Unauthorized'}), 403

    appt.status = 'cancelled'
    db.session.commit()
    return jsonify({'message': 'Appointment cancelled'})


@doctor_bp.route('/update-treatment', methods=['POST'])
@token_required
@roles_required('doctor')
def update_treatment(current_user):
    data = request.get_json()
    appt_id = data.get('appointment_id')

    appt = Appointment.query.get_or_404(appt_id)
    if appt.doctor_rel.user_id != current_user.id:
        return jsonify({'message': 'Unauthorized'}), 403

    next_date_str = data.get('next_visit_date')
    next_date = datetime.strptime(next_date_str, '%Y-%m-%d').date() if next_date_str else None

    treatment = Treatment.query.filter_by(appointment_id=appt_id).first()
    if not treatment:
        treatment = Treatment(appointment_id=appt_id)
        db.session.add(treatment)

    treatment.diagnosis = data.get('diagnosis', treatment.diagnosis)
    treatment.prescription = data.get('prescription', treatment.prescription)
    treatment.doctor_notes = data.get('doctor_notes', treatment.doctor_notes)
    treatment.next_visit_date = next_date

    # Mark appointment as completed when treatment is entered
    appt.status = 'completed'

    db.session.commit()
    return jsonify({'message': 'Treatment updated successfully', 'treatment': treatment.to_dict()})


@doctor_bp.route('/availability', methods=['GET', 'POST'])
@token_required
@roles_required('doctor')
def availability(current_user):
    doctor = current_user.doctor_profile
    if not doctor:
        return jsonify({'message': 'Profile not found'}), 404

    if request.method == 'GET':
        today = datetime.now().date()
        avails = DoctorAvailability.query.filter(
            DoctorAvailability.doctor_id == doctor.id,
            DoctorAvailability.date >= today
        ).order_by(DoctorAvailability.date.asc()).all()
        return jsonify([a.to_dict() for a in avails])

    # POST — set availability for next 7 days
    data = request.get_json()
    for av in data.get('availabilities', []):
        date_obj = datetime.strptime(av['date'], '%Y-%m-%d').date()
        existing = DoctorAvailability.query.filter_by(
            doctor_id=doctor.id, date=date_obj
        ).first()
        if existing:
            existing.morning_slot_available = av.get('morning_slot_available',
                                                      existing.morning_slot_available)
            existing.evening_slot_available = av.get('evening_slot_available',
                                                      existing.evening_slot_available)
        else:
            new_av = DoctorAvailability(
                doctor_id=doctor.id,
                date=date_obj,
                morning_slot_available=av.get('morning_slot_available', True),
                evening_slot_available=av.get('evening_slot_available', True)
            )
            db.session.add(new_av)

    db.session.commit()
    cache.delete(f'doctor_avail_{doctor.id}')  # Invalidate cache
    return jsonify({'message': 'Availability updated'})


@doctor_bp.route('/patient-history/<int:patient_id>', methods=['GET'])
@token_required
@roles_required('doctor')
def get_patient_history(current_user, patient_id):
    doctor = current_user.doctor_profile
    appts = Appointment.query.filter_by(
        doctor_id=doctor.id if doctor else 0,
        patient_id=patient_id
    ).all()
    history = []
    for appt in appts:
        t = appt.treatment
        history.append({
            'appointment_date': appt.appointment_date.isoformat(),
            'status': appt.status,
            'diagnosis': t.diagnosis if t else None,
            'prescription': t.prescription if t else None,
            'doctor_notes': t.doctor_notes if t else None,
            'next_visit_date': t.next_visit_date.isoformat() if t and t.next_visit_date else None
        })
    return jsonify(history)


@doctor_bp.route('/export-history', methods=['POST'])
@token_required
@roles_required('doctor')
def export_history(current_user):
    doctor = current_user.doctor_profile
    if not doctor:
        return jsonify({'message': 'Doctor profile not found'}), 404

    appts = Appointment.query.filter_by(doctor_id=doctor.id).order_by(Appointment.appointment_date.desc()).all()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        'doctor_id', 'doctor_name', 'doctor_roll_no', 'specialization',
        'patient_name', 'appointment_date', 'appointment_time',
        'status', 'diagnosis', 'prescription', 'doctor_notes', 'next_visit'
    ])
    writer.writeheader()
    for appt in appts:
        t = appt.treatment
        writer.writerow({
            'doctor_id':        doctor.id,
            'doctor_name':      doctor.name,
            'doctor_roll_no':   doctor.roll_no,
            'specialization':   doctor.specialization,
            'patient_name':     appt.patient_rel.name if appt.patient_rel else '',
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
        headers={'Content-Disposition': f'attachment; filename=doctor_{doctor.id}_appointments.csv'}
    )

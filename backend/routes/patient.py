from flask import Blueprint, request, jsonify, Response
from datetime import datetime
from sqlalchemy import and_
from backend.extensions import db, cache
from backend.models import Department, Doctor, Appointment, Treatment, Patient, DoctorAvailability
from backend.routes.auth import token_required, roles_required
import csv, io

patient_bp = Blueprint('patient', __name__)


@patient_bp.route('/dashboard', methods=['GET'])
@token_required
@roles_required('patient')
def get_dashboard(current_user):
    patient = current_user.patient_profile
    if not patient:
        return jsonify({'message': 'Profile not found'}), 404

    # Upcoming booked appointments
    today = datetime.now().date()
    upcoming = Appointment.query.filter(
        Appointment.patient_id == patient.id,
        Appointment.appointment_date >= today,
        Appointment.status == 'booked'
    ).order_by(Appointment.appointment_date.asc()).limit(5).all()

    return jsonify({
        'user': patient.to_dict(),
        'upcoming_appointments': [a.to_dict() for a in upcoming],
    })


@patient_bp.route('/departments', methods=['GET'])
@cache.cached(timeout=300)
def get_departments():
    return jsonify([d.to_dict() for d in Department.query.all()])


@patient_bp.route('/doctors', methods=['GET'])
@cache.cached(timeout=300, query_string=True)
def get_doctors():
    dept_id = request.args.get('department_id')
    if dept_id:
        doctors = Doctor.query.filter_by(department_id=dept_id).all()
    else:
        doctors = Doctor.query.all()
    return jsonify([d.to_dict() for d in doctors])


@patient_bp.route('/book-appointment', methods=['POST'])
@token_required
@roles_required('patient')
def book_appointment(current_user):
    data      = request.get_json()
    patient   = current_user.patient_profile
    doc_id    = data.get('doctor_id')
    date_str  = data.get('appointment_date')
    time_slot = data.get('appointment_time')   # 'Morning' or 'Evening'

    if not all([doc_id, date_str, time_slot]):
        return jsonify({'message': 'Missing required fields'}), 400

    date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
    doctor   = Doctor.query.get_or_404(doc_id)

    # Doctor must be active
    if doctor.user.status == 'blacklisted':
        return jsonify({'message': 'This doctor is no longer available'}), 400

    # Prevent double booking — same doctor, same date, same slot, still booked
    existing = Appointment.query.filter(
        and_(
            Appointment.doctor_id        == doc_id,
            Appointment.appointment_date == date_obj,
            Appointment.appointment_time == time_slot,
            Appointment.status           == 'booked',
        )
    ).first()
    if existing:
        return jsonify({'message': 'This slot is already booked. Please choose another slot.'}), 400

    # Check doctor's explicit availability settings
    avail = DoctorAvailability.query.filter_by(doctor_id=doc_id, date=date_obj).first()
    if avail:
        if time_slot == 'Morning' and not avail.morning_slot_available:
            return jsonify({'message': 'Doctor is not available in the morning on this date'}), 400
        if time_slot == 'Evening' and not avail.evening_slot_available:
            return jsonify({'message': 'Doctor is not available in the evening on this date'}), 400

    new_appt = Appointment(
        patient_id       = patient.id,
        doctor_id        = doc_id,
        department_id    = doctor.department_id,
        appointment_date = date_obj,
        appointment_time = time_slot,
        status           = 'booked',
    )
    db.session.add(new_appt)
    db.session.commit()

    # Invalidate availability cache so doctor dashboard refreshes
    cache.delete(f'doctor_avail_{doc_id}')

    return jsonify({'message': 'Appointment booked successfully!', 'appointment': new_appt.to_dict()}), 201


@patient_bp.route('/cancel-appointment/<int:id>', methods=['DELETE'])
@token_required
@roles_required('patient')
def cancel_appointment(current_user, id):
    patient = current_user.patient_profile
    appt    = Appointment.query.get_or_404(id)

    if appt.patient_id != patient.id:
        return jsonify({'message': 'Unauthorized'}), 403
    if appt.status != 'booked':
        return jsonify({'message': 'Only booked appointments can be cancelled'}), 400

    appt.status = 'cancelled'
    db.session.commit()
    cache.delete(f'doctor_avail_{appt.doctor_id}')
    return jsonify({'message': 'Appointment cancelled'})


@patient_bp.route('/reschedule-appointment/<int:id>', methods=['PUT'])
@token_required
@roles_required('patient')
def reschedule_appointment(current_user, id):
    patient  = current_user.patient_profile
    appt     = Appointment.query.get_or_404(id)

    if appt.patient_id != patient.id:
        return jsonify({'message': 'Unauthorized'}), 403
    if appt.status != 'booked':
        return jsonify({'message': 'Only booked appointments can be rescheduled'}), 400

    data     = request.get_json()
    new_date = datetime.strptime(data['appointment_date'], '%Y-%m-%d').date()
    new_time = data.get('appointment_time', appt.appointment_time)

    existing = Appointment.query.filter(
        and_(
            Appointment.doctor_id        == appt.doctor_id,
            Appointment.appointment_date == new_date,
            Appointment.appointment_time == new_time,
            Appointment.status           == 'booked',
            Appointment.id               != id,
        )
    ).first()
    if existing:
        return jsonify({'message': 'That slot is already taken. Choose another.'}), 400

    appt.appointment_date = new_date
    appt.appointment_time = new_time
    db.session.commit()
    cache.delete(f'doctor_avail_{appt.doctor_id}')
    return jsonify({'message': 'Appointment rescheduled', 'appointment': appt.to_dict()})


@patient_bp.route('/history', methods=['GET'])
@token_required
@roles_required('patient')
def get_history(current_user):
    patient = current_user.patient_profile
    if not patient:
        return jsonify({'message': 'Profile not found'}), 404

    appts = Appointment.query.filter_by(patient_id=patient.id) \
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
            'department_name':  appt.doctor_rel.department.name if appt.doctor_rel and appt.doctor_rel.department else None,
            'status':           appt.status,
            'diagnosis':        t.diagnosis if t else None,
            'prescription':     t.prescription if t else None,
            'doctor_notes':     t.doctor_notes if t else None,
            'next_visit_date':  t.next_visit_date.isoformat() if t and t.next_visit_date else None,
            'appointment_id':   appt.id,
        })
    return jsonify(history)


@patient_bp.route('/export-history', methods=['POST'])
@token_required
@roles_required('patient')
def export_history(current_user):
    patient = current_user.patient_profile
    try:
        from backend.tasks import export_csv_job
        task = export_csv_job.delay(patient.id)
        return jsonify({'message': 'Export started. You will be notified when complete.', 'task_id': task.id})
    except Exception:
        appts  = Appointment.query.filter_by(patient_id=patient.id).all()
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=[
            'patient_id', 'patient_name', 'doctor_name', 'doctor_roll_no',
            'appointment_date', 'appointment_time', 'diagnosis', 'treatment', 'next_visit'
        ])
        writer.writeheader()
        for appt in appts:
            t = appt.treatment
            writer.writerow({
                'patient_id':       patient.id,
                'patient_name':     patient.name,
                'doctor_name':      appt.doctor_rel.name if appt.doctor_rel else '',
                'doctor_roll_no':   appt.doctor_rel.roll_no if appt.doctor_rel else '',
                'appointment_date': appt.appointment_date.isoformat(),
                'appointment_time': appt.appointment_time,
                'diagnosis':        t.diagnosis if t else '',
                'treatment':        t.prescription if t else '',
                'next_visit':       t.next_visit_date.isoformat() if t and t.next_visit_date else '',
            })
        output.seek(0)
        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename=patient_{patient.id}_history.csv'}
        )


@patient_bp.route('/doctor-availability/<int:doctor_id>', methods=['GET'])
def get_doctor_availability(doctor_id):
    """Returns availability + already-booked slots so frontend can grey them out."""
    cache_key = f'doctor_avail_{doctor_id}'
    cached    = cache.get(cache_key)
    if cached:
        return jsonify(cached)

    today = datetime.now().date()

    # Fetch explicit availability settings
    avails = {}
    for av in DoctorAvailability.query.filter(
        DoctorAvailability.doctor_id == doctor_id,
        DoctorAvailability.date      >= today
    ).all():
        avails[av.date.isoformat()] = av.to_dict()

    # Fetch already booked slots for next 7 days
    from datetime import timedelta
    end_date = today + timedelta(days=7)
    booked = Appointment.query.filter(
        Appointment.doctor_id        == doctor_id,
        Appointment.appointment_date >= today,
        Appointment.appointment_date <= end_date,
        Appointment.status           == 'booked',
    ).all()

    booked_map = {}   # date -> {'Morning': bool, 'Evening': bool}
    for appt in booked:
        key = appt.appointment_date.isoformat()
        if key not in booked_map:
            booked_map[key] = {'Morning': False, 'Evening': False}
        booked_map[key][appt.appointment_time] = True

    # Build 7-day result
    result = []
    for i in range(7):
        from datetime import timedelta
        d     = today + timedelta(days=i)
        dstr  = d.isoformat()
        av    = avails.get(dstr, {})
        bk    = booked_map.get(dstr, {})

        morning_avail = av.get('morning_slot_available', True)
        evening_avail = av.get('evening_slot_available', True)

        result.append({
            'date':                    dstr,
            'morning_slot_available':  morning_avail and not bk.get('Morning', False),
            'evening_slot_available':  evening_avail and not bk.get('Evening', False),
            'morning_booked':          bk.get('Morning', False),
            'evening_booked':          bk.get('Evening', False),
            'morning_set_unavailable': not morning_avail,
            'evening_set_unavailable': not evening_avail,
        })

    cache.set(cache_key, result, timeout=60)   # short TTL so bookings show fast
    return jsonify(result)


@patient_bp.route('/profile', methods=['PUT'])
@token_required
@roles_required('patient')
def update_profile(current_user):
    patient = current_user.patient_profile
    if not patient:
        return jsonify({'message': 'Profile not found'}), 404

    data           = request.get_json()
    patient.name   = data.get('name',    patient.name)
    patient.phone  = data.get('phone',   patient.phone)
    patient.address = data.get('address', patient.address)
    if data.get('date_of_birth'):
        patient.date_of_birth = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date()

    db.session.commit()
    return jsonify({'message': 'Profile updated', 'patient': patient.to_dict()})

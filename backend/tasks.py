from backend.celery_worker import celery_app
from backend.models import db, Patient, Appointment, Doctor, Treatment
from celery.schedules import crontab
from datetime import datetime
import csv
import os

@celery_app.task(name='export_csv_job')
def export_csv_job(patient_id):
    patient = Patient.query.get(patient_id)
    if not patient:
        return {'status': 'failed', 'message': 'Patient not found'}
        
    appointments = Appointment.query.filter_by(patient_id=patient_id).all()
    
    # We will save the CSV in static folder for download
    filename = f"patient_{patient_id}_history.csv"
    filepath = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', filename)
    
    with open(filepath, 'w', newline='') as csvfile:
        fieldnames = ['patient_id', 'patient_name', 'doctor_name', 'appointment_date', 'diagnosis', 'treatment', 'next_visit']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        for appt in appointments:
            t = appt.treatment
            writer.writerow({
                'patient_id': patient.id,
                'patient_name': patient.name,
                'doctor_name': appt.doctor_rel.name,
                'appointment_date': appt.appointment_date.isoformat(),
                'diagnosis': t.diagnosis if t else '',
                'treatment': t.prescription if t else '',
                'next_visit': t.next_visit_date.isoformat() if t and t.next_visit_date else ''
            })
            
    # Normally we would send notification, here we just return the filepath
    return {'status': 'success', 'file': f'/static/{filename}'}

@celery_app.task(name='daily_reminder_job')
def daily_reminder_job():
    today = datetime.now().date()
    # Check for patients with appointments scheduled that day
    appointments = Appointment.query.filter_by(appointment_date=today, status='booked').all()
    for appt in appointments:
        patient = appt.patient_rel
        doctor = appt.doctor_rel
        message = f"You have an appointment today at {appt.appointment_time} with Dr. {doctor.name}."
        # Printing as a mock for email/Google Chat webhook
        print(f"Notification to {patient.user.email}: {message}")
        
@celery_app.task(name='monthly_doctor_activity_report')
def monthly_doctor_activity_report():
    doctors = Doctor.query.all()
    for doctor in doctors:
        total_appointments = Appointment.query.filter_by(doctor_id=doctor.id, status='completed').count()
        # count treatments
        # simplistic query for the report
        print(f"Sending report to {doctor.user.email}: Total Appointments: {total_appointments}")

# Setup periodic tasks
celery_app.conf.beat_schedule = {
    'daily-reminder-morning': {
        'task': 'daily_reminder_job',
        'schedule': crontab(hour=8, minute=0),
    },
    'monthly-doctor-report': {
        'task': 'monthly_doctor_activity_report',
        'schedule': crontab(day_of_month=1, hour=0, minute=0),
    }
}

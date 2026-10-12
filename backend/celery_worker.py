"""Celery worker initializer. Run with:
    celery -A backend.celery_worker.celery_app worker --loglevel=info
    celery -A backend.celery_worker.celery_app beat   --loglevel=info
"""
from celery import Celery


def make_celery(flask_app):
    celery = Celery(
        flask_app.import_name,
        backend=flask_app.config.get('CELERY_RESULT_BACKEND',
                                     flask_app.config.get('CACHE_REDIS_URL', 'redis://localhost:6379/0')),
        broker=flask_app.config.get('CELERY_BROKER_URL',
                                    flask_app.config.get('CACHE_REDIS_URL', 'redis://localhost:6379/0'))
    )
    celery.conf.update(flask_app.config)

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with flask_app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask
    return celery


# Lazy import so this module can be imported without a running app
from backend.app import app
celery_app = make_celery(app)

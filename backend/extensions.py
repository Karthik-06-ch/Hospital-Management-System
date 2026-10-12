"""
Shared Flask extensions — initialized here to avoid circular imports.
Import these from routes instead of from app.py.
"""
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_caching import Cache

db = SQLAlchemy()
bcrypt = Bcrypt()
cache = Cache()

"""Temporary SQLite settings for local migration execution."""
from config.settings import *

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}
SECRET_KEY = "temp-only-for-migrations"

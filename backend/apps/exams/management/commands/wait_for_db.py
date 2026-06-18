"""Management command: wait for database to be ready."""

import time
from django.core.management.base import BaseCommand
from django.db import OperationalError, connections


class Command(BaseCommand):
    help = "Wait for the database to be available"

    def handle(self, *args, **options):
        self.stdout.write("Waiting for database...")
        for attempt in range(1, 31):
            try:
                connections["default"].ensure_connection()
                self.stdout.write(self.style.SUCCESS(f"Database available (attempt {attempt})"))
                return
            except OperationalError:
                self.stdout.write(f"  Attempt {attempt}/30 — not ready, retrying in 2s...")
                time.sleep(2)
        self.stderr.write(self.style.ERROR("Database not available after 30 attempts"))
        raise SystemExit(1)

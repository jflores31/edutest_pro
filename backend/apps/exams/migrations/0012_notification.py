import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("exams", "0011_exam_max_attempts"),
    ]

    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("type", models.CharField(
                    choices=[
                        ("attempt_finished", "Attempt Finished"),
                        ("low_score", "Low Score"),
                        ("proctoring_alert", "Proctoring Alert"),
                        ("daily_summary", "Daily Summary"),
                        ("system", "System"),
                    ],
                    db_index=True,
                    max_length=30,
                )),
                ("title", models.CharField(max_length=255)),
                ("body", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                (
                    "organization",
                    models.ForeignKey(
                        db_index=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notifications",
                        to="exams.organization",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]

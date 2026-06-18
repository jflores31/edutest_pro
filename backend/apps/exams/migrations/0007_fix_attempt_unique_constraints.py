from django.db import migrations


class Migration(migrations.Migration):
    """
    This migration is a no-op: 0006 was fixed to directly create the correct
    unique_in_progress_user_attempt and unique_in_progress_student_attempt
    constraints, so there is nothing left to do here.
    """

    dependencies = [
        ('exams', '0006_add_multi_tenant_constraints_and_indexes'),
    ]

    operations = []

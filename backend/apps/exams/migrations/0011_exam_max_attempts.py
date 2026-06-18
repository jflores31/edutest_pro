# Generated manually

from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('exams', '0010_student_unique_constraint'),
    ]

    operations = [
        migrations.AddField(
            model_name='exam',
            name='max_attempts',
            field=models.PositiveIntegerField(
                blank=True, null=True,
                validators=[django.core.validators.MinValueValidator(1)],
                help_text='Max attempts per student. Null = unlimited.',
            ),
        ),
    ]

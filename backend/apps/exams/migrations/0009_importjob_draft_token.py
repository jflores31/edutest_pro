from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('exams', '0008_add_attempt_extra_time'),
    ]

    operations = [
        migrations.AddField(
            model_name='importjob',
            name='draft_token',
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
    ]

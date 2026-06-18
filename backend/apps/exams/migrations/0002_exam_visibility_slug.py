from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("exams", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="exam",
            name="show_score",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="exam",
            name="show_answers",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="exam",
            name="show_explanations",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="exam",
            name="slug",
            field=models.SlugField(blank=True, max_length=255, null=True, unique=True),
        ),
    ]

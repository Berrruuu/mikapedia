from django.db import connection
with connection.cursor() as c:
    c.execute("DELETE FROM django_migrations WHERE app IN ('signals', 'compliance')")
    print("Cleared signals and compliance migration records from DB")

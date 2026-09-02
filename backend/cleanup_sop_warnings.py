from compliance.models import SOPWarning
from django.db.models import Count

# Find all (user, compliance_result, violation_type) combinations with duplicates
duplicates = SOPWarning.objects.values('user', 'compliance_result', 'violation_type').annotate(count=Count('id')).filter(count__gt=1)

print(f"Found {duplicates.count()} (user, compliance_result, violation_type) groups with duplicates")

deleted_count = 0
for pair in duplicates:
    warnings = SOPWarning.objects.filter(
        user=pair['user'], 
        compliance_result=pair['compliance_result'],
        violation_type=pair['violation_type']
    ).order_by('-created_at')
    
    # Keep only the most recent one, delete the rest
    to_delete = warnings[1:]
    for w in to_delete:
        w.delete()
    deleted_count += len(to_delete)

print(f"Deleted {deleted_count} duplicate records!")
print(f"Cleanup complete! Remaining SOPWarning records: {SOPWarning.objects.count()}")

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from .models import OutboxEvent

def claim_events(limit=100):
    with transaction.atomic():
        events = list(OutboxEvent.objects.select_for_update(skip_locked=True).filter(published_at__isnull=True).order_by('created_at')[:limit])
        OutboxEvent.objects.filter(id__in=[event.id for event in events]).update(attempts=F('attempts') + 1)
    return events

def mark_published(event_id):
    OutboxEvent.objects.filter(id=event_id, published_at__isnull=True).update(published_at=timezone.now())

from django.core.management.base import BaseCommand
from django.utils import timezone
from notifications.models import NotificationIntent
from notifications.delivery import process_intent


class Command(BaseCommand):
    help = 'Process due notification intents (pending first-attempts and scheduled retries)'

    def handle(self, *args, **options):
        # Pick up intents that are pending (never attempted) OR due for retry
        due_intents = NotificationIntent.objects.filter(
            status__in=['pending', 'retry'],
        ).exclude(
            channel='in_app',  # in_app doesn't need external delivery
        ).filter(
            # Either never attempted (next_attempt_at is NULL) or due now
            next_attempt_at__lte=timezone.now(),
        ).values_list('id', flat=True)[:100]

        # Also pick up pending intents that have never been scheduled
        unscheduled = NotificationIntent.objects.filter(
            status='pending',
            next_attempt_at__isnull=True,
        ).exclude(
            channel='in_app',
        ).values_list('id', flat=True)[:100]

        all_ids = list(set(due_intents) | set(unscheduled))

        processed = 0
        for intent_id in all_ids:
            try:
                process_intent(intent_id)
                processed += 1
            except Exception as exc:
                self.stderr.write(self.style.ERROR(f'Failed to process intent {intent_id}: {exc}'))

        self.stdout.write(self.style.SUCCESS(f'Processed {processed} notification intents'))

import logging
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from .models import NotificationIntent, NotificationDelivery
from .providers import deliver_email, deliver_whatsapp, ProviderNotConfigured

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5


@transaction.atomic
def process_intent(intent_id):
    """
    Process a single notification intent: attempt delivery via the appropriate
    provider and record the result. Supports retry with exponential backoff.
    """
    intent = NotificationIntent.objects.select_for_update().get(id=intent_id)

    # Skip if already delivered/failed permanently or exhausted retries
    if intent.status in ('delivered', 'acknowledged'):
        return intent
    if intent.status not in ('pending', 'processing', 'retry'):
        return intent
    if intent.attempts >= MAX_ATTEMPTS:
        intent.status = 'failed'
        intent.save(update_fields=['status'])
        return intent

    intent.attempts += 1
    result = None

    try:
        if intent.channel == 'email':
            payload = intent.payload
            result = deliver_email(
                recipient=payload.get('recipient', ''),
                subject=payload.get('subject', intent.notification_type),
                body=payload.get('body', str(payload)),
                html_body=payload.get('html_body'),
            )
        elif intent.channel == 'whatsapp':
            payload = intent.payload
            result = deliver_whatsapp(
                recipient=payload.get('recipient', ''),
                template=intent.notification_type,
                variables=payload,
            )
        elif intent.channel == 'in_app':
            # In-app notifications are "delivered" simply by existing in the DB
            # (the frontend polls for them). Mark delivered immediately.
            intent.status = 'delivered'
            intent.save(update_fields=['attempts', 'status'])
            NotificationDelivery.objects.create(
                intent=intent,
                status='delivered',
                response={'provider': 'in_app'},
            )
            return intent
        else:
            logger.warning("Unknown channel '%s' for intent %s", intent.channel, intent.id)
            intent.status = 'failed'
            intent.save(update_fields=['attempts', 'status'])
            return intent

        # Evaluate the provider result
        if result and result.accepted:
            intent.status = 'delivered'
            NotificationDelivery.objects.create(
                intent=intent,
                provider_message_id=result.external_id or '',
                status='delivered',
                response={'provider': result.provider},
            )
            logger.info("Intent %s delivered via %s", intent.id, result.provider)
        else:
            error_msg = result.error if result else 'No result returned'
            intent.status = 'retry' if intent.attempts < MAX_ATTEMPTS else 'failed'
            NotificationDelivery.objects.create(
                intent=intent,
                status='failed',
                response={'provider': result.provider if result else 'unknown', 'error': error_msg},
            )
            logger.warning("Intent %s delivery failed (attempt %d): %s", intent.id, intent.attempts, error_msg)

    except ProviderNotConfigured as exc:
        intent.status = 'failed' if intent.attempts >= MAX_ATTEMPTS else 'retry'
        NotificationDelivery.objects.create(
            intent=intent,
            status='unconfigured',
            response={'error': str(exc)},
        )
        logger.warning("Provider not configured for intent %s: %s", intent.id, exc)

    except Exception as exc:
        # Catch network timeouts, API errors, etc.
        intent.status = 'retry' if intent.attempts < MAX_ATTEMPTS else 'failed'
        NotificationDelivery.objects.create(
            intent=intent,
            status='failed',
            response={'error': str(exc)},
        )
        logger.error("Unexpected error processing intent %s: %s", intent.id, exc, exc_info=True)

    # Schedule retry with exponential backoff
    if intent.status == 'retry':
        backoff_minutes = min(30, 2 ** intent.attempts)
        intent.next_attempt_at = timezone.now() + timedelta(minutes=backoff_minutes)
        logger.info("Intent %s scheduled for retry at %s", intent.id, intent.next_attempt_at)

    intent.save(update_fields=['attempts', 'status', 'next_attempt_at'])
    return intent

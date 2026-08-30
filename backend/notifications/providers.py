import os
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DeliveryResult:
    accepted: bool
    provider: str
    external_id: str | None = None
    error: str | None = None


class ProviderNotConfigured(Exception):
    pass


def deliver_email(*, recipient: str, subject: str, body: str, html_body: str = None) -> DeliveryResult:
    """
    Deliver an email using Django's SMTP backend (configured in settings.py).
    Raises ProviderNotConfigured if SMTP credentials are missing.
    """
    from django.conf import settings

    smtp_user = getattr(settings, 'EMAIL_HOST_USER', None)
    smtp_pass = getattr(settings, 'EMAIL_HOST_PASSWORD', None)

    if not smtp_user or not smtp_pass:
        raise ProviderNotConfigured(
            'Email provider is not configured: SMTP_USER or SMTP_PASS missing in environment'
        )

    try:
        from django.core.mail import EmailMultiAlternatives

        msg = EmailMultiAlternatives(
            subject=subject,
            body=body,
            from_email=smtp_user,
            to=[recipient] if isinstance(recipient, str) else recipient,
        )
        if html_body:
            msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)
        logger.info("Email delivered to %s — subject: %s", recipient, subject)
        return DeliveryResult(accepted=True, provider='smtp')
    except Exception as exc:
        logger.error("Email delivery failed to %s: %s", recipient, exc)
        return DeliveryResult(accepted=False, provider='smtp', error=str(exc))


def deliver_whatsapp(*, recipient: str, template: str, variables: dict) -> DeliveryResult:
    """
    Deliver a WhatsApp message via the Twilio API.
    Raises ProviderNotConfigured if Twilio credentials are missing.
    """
    account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
    from_number = os.environ.get('TWILIO_WHATSAPP_FROM', '+14155238886')

    if not account_sid or not auth_token:
        raise ProviderNotConfigured(
            'WhatsApp provider is not configured: TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN missing'
        )

    # Build the message body from template + variables
    body = variables.get('message', '')
    if not body:
        body = f"{template}: {variables}"

    try:
        from twilio.rest import Client

        client = Client(account_sid, auth_token)

        # WhatsApp numbers must be prefixed with 'whatsapp:'
        to_whatsapp = f"whatsapp:{recipient}" if not recipient.startswith('whatsapp:') else recipient
        from_whatsapp = f"whatsapp:{from_number}" if not from_number.startswith('whatsapp:') else from_number

        message = client.messages.create(
            body=body,
            from_=from_whatsapp,
            to=to_whatsapp,
        )
        logger.info("WhatsApp delivered to %s — SID: %s", recipient, message.sid)
        return DeliveryResult(accepted=True, provider='twilio', external_id=message.sid)
    except Exception as exc:
        logger.error("WhatsApp delivery failed to %s: %s", recipient, exc)
        return DeliveryResult(accepted=False, provider='twilio', error=str(exc))

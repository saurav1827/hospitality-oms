import os
import logging
import threading
from django.db import IntegrityError

from .models import NotificationIntent

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Default channels per notification event
# ---------------------------------------------------------------------------
EVENT_CHANNELS = {
    'new_order':       ['in_app', 'email', 'whatsapp'],
    'order_ready':     ['in_app', 'whatsapp'],
    'order_settled':   ['in_app', 'email', 'whatsapp'],
}


from venue_platform.models import Property

def _get_property_details(property_id):
    try:
        return Property.objects.get(id=property_id)
    except Property.DoesNotExist:
        return None

def _build_email_payload(event_type: str, order) -> dict:
    """Build rich email content for a given event type."""
    property_obj = _get_property_details(order.property_id)
    property_name = property_obj.name if property_obj else "Tableline Property"
    currency = property_obj.currency if property_obj else "INR"
    
    # Base CSS for beautiful emails
    base_style = """
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.6;
        color: #333333;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background-color: #f9f9f9;
        border-radius: 8px;
    """
    card_style = """
        background: #ffffff;
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        border: 1px solid #eaeaea;
    """
    header_style = "color: #10b981; margin-top: 0; font-size: 24px; font-weight: 700; text-align: center;"
    prop_style = "color: #6b7280; font-size: 14px; text-align: center; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;"
    table_style = "width: 100%; border-collapse: collapse; margin-top: 20px;"
    th_style = "text-align: left; padding: 12px 8px; border-bottom: 2px solid #f3f4f6; color: #4b5563; font-size: 14px;"
    td_style = "padding: 12px 8px; border-bottom: 1px solid #f3f4f6; color: #1f2937;"
    total_style = "text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; color: #111827; padding-top: 15px; border-top: 2px solid #e5e7eb;"
    
    items_html = f"<table style='{table_style}'><thead><tr><th style='{th_style}'>Item</th><th style='{th_style}' style='text-align:center;'>Qty</th><th style='{th_style}' style='text-align:right;'>Price</th></tr></thead><tbody>"
    for item in order.items.all():
        items_html += f"<tr><td style='{td_style}'>{item.name_snapshot}</td><td style='{td_style}' style='text-align:center;'>{item.quantity}</td><td style='{td_style}' style='text-align:right;'>{currency} {item.unit_price_snapshot}</td></tr>"
    items_html += "</tbody></table>"

    if event_type == 'new_order':
        subject = f"🆕 New Order #{order.number} at {property_name}"
        body = f"A new order #{order.number} has been placed at {property_name}.\n\nTotal: {currency} {order.total}\nNotes: {order.notes}\n\n"
        html_body = f"""
        <div style="{base_style}">
            <div style="{card_style}">
                <h1 style="{header_style}">New Order Received!</h1>
                <div style="{prop_style}">{property_name}</div>
                <p style="font-size: 16px; margin-bottom: 20px; text-align: center;">Order <strong>#{order.number}</strong> has just been placed.</p>
                {items_html}
                <div style="{total_style}">Total: {currency} {order.total}</div>
                {"<p style='background: #fef3c7; padding: 15px; border-radius: 8px; color: #92400e; margin-top: 20px;'><strong>Notes:</strong> " + order.notes + "</p>" if order.notes else ""}
            </div>
        </div>
        """
        return {'subject': subject, 'body': body, 'html_body': html_body}

    elif event_type == 'order_ready':
        subject = f"🔔 Order #{order.number} Ready — {property_name}"
        body = f"Kitchen has marked order #{order.number} as ready for dispatch at {property_name}."
        html_body = f"""
        <div style="{base_style}">
            <div style="{card_style}">
                <h1 style="{header_style}; color: #3b82f6;">Order Ready for Dispatch</h1>
                <div style="{prop_style}">{property_name}</div>
                <p style="font-size: 16px; text-align: center;">The kitchen has marked Order <strong>#{order.number}</strong> as ready!</p>
                <div style="text-align: center; margin-top: 30px;">
                    <span style="background: #eff6ff; color: #2563eb; padding: 10px 20px; border-radius: 20px; font-weight: 600;">Action Required: Please serve immediately.</span>
                </div>
            </div>
        </div>
        """
        return {'subject': subject, 'body': body, 'html_body': html_body}

    elif event_type == 'order_settled':
        subject = f"✅ Order #{order.number} Settled — {property_name}"
        body = f"Order #{order.number} has been settled for {currency} {order.total} at {property_name}."
        html_body = f"""
        <div style="{base_style}">
            <div style="{card_style}">
                <h1 style="{header_style}; color: #8b5cf6;">Payment Settled Successfully</h1>
                <div style="{prop_style}">{property_name}</div>
                <p style="font-size: 16px; text-align: center; margin-bottom: 20px;">Order <strong>#{order.number}</strong> has been fully paid.</p>
                {items_html}
                <div style="{total_style}; color: #8b5cf6;">Total Paid: {currency} {order.total}</div>
            </div>
        </div>
        """
        return {'subject': subject, 'body': body, 'html_body': html_body}

    return {'subject': event_type, 'body': str(event_type), 'html_body': None}


def _build_whatsapp_message(event_type: str, order) -> str:
    """Build a WhatsApp-friendly message string."""
    if event_type == 'new_order':
        return f"🆕 *New Order #{order.number}*\nTotal: ₹{order.total}\nNotes: {order.notes}"
    elif event_type == 'order_ready':
        return f"🔔 *Order #{order.number} Ready for Dispatch*\nKitchen has marked order #{order.number} as ready!"
    elif event_type == 'order_settled':
        return f"✅ *Order #{order.number} Settled*\nTotal: ₹{order.total}\nNotes: {order.notes}"
    return f"📋 {event_type}: Order #{order.number}"


def _deliver_in_background(intent_id):
    """
    Process a notification intent in a background thread so the API response
    is not blocked by slow SMTP / Twilio calls.
    """
    import django
    django.setup()
    try:
        from .delivery import process_intent
        process_intent(intent_id)
    except Exception as exc:
        logger.error("Background delivery failed for intent %s: %s", intent_id, exc)


def create_notification(*, event_type: str, property_id, event_id, payload: dict,
                        channels: list[str] | None = None):
    """
    Fan-out: create a NotificationIntent for each channel and dispatch
    email/whatsapp intents asynchronously via a background thread.

    Args:
        event_type: e.g. 'new_order', 'order_ready', 'order_settled'
        property_id: UUID of the property
        event_id: UUID of the event (usually order ID)
        payload: dict with notification data (message, subject, body, etc.)
        channels: list of channels to notify. Defaults to EVENT_CHANNELS mapping.
    """
    if channels is None:
        channels = EVENT_CHANNELS.get(event_type, ['in_app'])

    created_intents = []

    for channel in channels:
        dedupe_key = f"{event_type}_{channel}_{event_id}"
        try:
            intent = NotificationIntent.objects.create(
                property_id=property_id,
                event_id=event_id,
                notification_type=event_type,
                channel=channel,
                payload=payload.get(channel, payload),
                status='pending',
                dedupe_key=dedupe_key,
            )
            created_intents.append(intent)
            logger.info("Created %s notification intent %s for event %s", channel, intent.id, event_type)
        except IntegrityError:
            # Deduplicated — this notification was already created
            logger.info("Deduplicated %s notification for event %s (key=%s)", channel, event_type, dedupe_key)
            continue

    # Dispatch email and whatsapp intents in background threads
    for intent in created_intents:
        if intent.channel in ('email', 'whatsapp'):
            thread = threading.Thread(
                target=_deliver_in_background,
                args=(intent.id,),
                daemon=True,
            )
            thread.start()
        elif intent.channel == 'in_app':
            # Broadcast the in-app notification via WebSockets
            try:
                from channels.layers import get_channel_layer
                from asgiref.sync import async_to_sync
                channel_layer = get_channel_layer()
                if channel_layer:
                    async_to_sync(channel_layer.group_send)(
                        f"property_{property_id}",
                        {
                            "type": "event_notification",
                            "payload": {
                                "type": "new_notification",
                                "notification": {
                                    "id": str(intent.id),
                                    "notificationType": intent.notification_type,
                                    "payload": intent.payload,
                                    "status": intent.status,
                                    "createdAt": intent.created_at.isoformat(),
                                }
                            }
                        }
                    )
            except Exception as e:
                logger.error(f"Failed to broadcast in_app notification: {e}")

    return created_intents


# ---------------------------------------------------------------------------
# High-level notification helpers (called from API views)
# ---------------------------------------------------------------------------

def notify_new_order(order):
    """Called when a new order is submitted."""
    admin_email = os.environ.get('ADMIN_EMAIL', '')
    admin_whatsapp = os.environ.get('ADMIN_WHATSAPP_TO', '')
    email_payload = _build_email_payload('new_order', order)
    whatsapp_msg = _build_whatsapp_message('new_order', order)

    payload = {
        'in_app': {'message': f'New order #{order.number} received — ₹{order.total}'},
        'email': {
            'recipient': admin_email,
            'subject': email_payload['subject'],
            'body': email_payload['body'],
            'html_body': email_payload.get('html_body'),
        },
        'whatsapp': {
            'recipient': admin_whatsapp,
            'message': whatsapp_msg,
        },
    }
    create_notification(
        event_type='new_order',
        property_id=order.property_id,
        event_id=order.id,
        payload=payload,
    )


def notify_order_ready(order):
    """Called when the kitchen marks an order as ready."""
    admin_whatsapp = os.environ.get('ADMIN_WHATSAPP_TO', '')
    whatsapp_msg = _build_whatsapp_message('order_ready', order)

    payload = {
        'in_app': {'message': f'Order #{order.number} is ready for dispatch'},
        'whatsapp': {
            'recipient': admin_whatsapp,
            'message': whatsapp_msg,
        },
    }
    create_notification(
        event_type='order_ready',
        property_id=order.property_id,
        event_id=order.id,
        payload=payload,
    )


def notify_order_settled(order):
    """Called when a payment is processed and order is settled."""
    admin_email = os.environ.get('ADMIN_EMAIL', '')
    admin_whatsapp = os.environ.get('ADMIN_WHATSAPP_TO', '')
    email_payload = _build_email_payload('order_settled', order)
    whatsapp_msg = _build_whatsapp_message('order_settled', order)

    payload = {
        'in_app': {'message': f'Order #{order.number} settled — ₹{order.total}'},
        'email': {
            'recipient': admin_email,
            'subject': email_payload['subject'],
            'body': email_payload['body'],
            'html_body': email_payload.get('html_body'),
        },
        'whatsapp': {
            'recipient': admin_whatsapp,
            'message': whatsapp_msg,
        },
    }
    create_notification(
        event_type='order_settled',
        property_id=order.property_id,
        event_id=order.id,
        payload=payload,
    )

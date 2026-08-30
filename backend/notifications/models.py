import uuid
from django.db import models

class NotificationIntent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    property_id = models.UUIDField()
    event_id = models.UUIDField()
    notification_type = models.CharField(max_length=100)
    recipient_id = models.UUIDField(null=True, blank=True)
    channel = models.CharField(max_length=30, choices=[('in_app', 'In app'), ('email', 'Email'), ('whatsapp', 'WhatsApp')])
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=20, default='pending')
    dedupe_key = models.CharField(max_length=255, unique=True)
    attempts = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    next_attempt_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=['property_id', 'status']), models.Index(fields=['recipient_id', 'status'])]

class NotificationDelivery(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    intent = models.ForeignKey(NotificationIntent, on_delete=models.CASCADE, related_name='deliveries')
    provider_message_id = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=30, default='queued')
    response = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

import uuid
from django.db import models

class Room(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    property_id = models.UUIDField(db_index=True)
    number = models.CharField(max_length=20)
    occupied = models.BooleanField(default=False)
    guest_name = models.CharField(max_length=160, blank=True)
    folio_reference = models.CharField(max_length=120, blank=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['property_id','number'], name='unique_property_room')]

class DeliveryAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_id = models.UUIDField(db_index=True)
    room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name='deliveries')
    runner_id = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=[('ready','Ready'),('assigned','Assigned'),('delivered','Delivered'),('no_answer','No answer'),('returned','Returned')], default='ready')
    assigned_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    evidence = models.JSONField(default=dict)

import uuid
from django.core.validators import MinValueValidator
from django.db import models


class LocationSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    property_id = models.UUIDField(db_index=True)
    location_id = models.UUIDField(db_index=True)
    status = models.CharField(max_length=20, choices=[('open', 'Open'), ('closed', 'Closed')], default='open')
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=['property_id', 'location_id', 'status'])]


class Order(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    number = models.PositiveIntegerField()
    property_id = models.UUIDField(db_index=True)
    session = models.ForeignKey(LocationSession, on_delete=models.PROTECT, related_name='orders')
    status = models.CharField(max_length=24, choices=[('submitted', 'Submitted'), ('preparing', 'Preparing'), ('ready', 'Ready'), ('served', 'Served'), ('cancelled', 'Cancelled'), ('paid', 'Paid')], default='submitted')
    payment_status = models.CharField(max_length=20, choices=[('pending', 'Pending'), ('paid', 'Paid'), ('failed', 'Failed')], default='pending')
    currency = models.CharField(max_length=3, default='INR')
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    tax_total = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    total = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    notes = models.TextField(blank=True)
    razorpay_order_id = models.CharField(max_length=100, blank=True, null=True)
    razorpay_payment_id = models.CharField(max_length=100, blank=True, null=True)
    razorpay_signature = models.CharField(max_length=200, blank=True, null=True)
    idempotency_key = models.CharField(max_length=128, unique=True)
    ready_by_name = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['property_id', 'number'], name='unique_property_order_number')]
        indexes = [models.Index(fields=['property_id', 'status', '-created_at'])]


class OrderItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    menu_item_id = models.UUIDField()
    name_snapshot = models.CharField(max_length=200)
    unit_price_snapshot = models.DecimalField(max_digits=12, decimal_places=2)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    modifiers_snapshot = models.JSONField(default=list)
    status = models.CharField(max_length=20, choices=[('queued', 'Queued'), ('preparing', 'Preparing'), ('ready', 'Ready'), ('served', 'Served'), ('cancelled', 'Cancelled')], default='queued')
    note = models.CharField(max_length=500, blank=True)


class KitchenTicket(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='tickets')
    station = models.CharField(max_length=80, default='main')
    status = models.CharField(max_length=20, choices=[('new', 'New'), ('acknowledged', 'Acknowledged'), ('preparing', 'Preparing'), ('ready', 'Ready'), ('recalled', 'Recalled')], default='new')
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    ready_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)  # <-- ADD THIS LINE
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=['station', 'status', 'created_at'])]
        ordering = ['created_at']


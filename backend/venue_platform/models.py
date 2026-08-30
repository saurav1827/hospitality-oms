import uuid
from django.conf import settings
from django.db import models

class Property(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160)
    timezone = models.CharField(max_length=64, default='Asia/Kolkata')
    currency = models.CharField(max_length=3, default='INR')
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=5)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

class PropertyMembership(models.Model):
    ROLE_CHOICES = [('manager','Manager'),('kitchen','Kitchen'),('waiter','Waiter'),('cashier','Cashier'),('front_desk','Front desk'),('runner','Runner'),('admin','Admin')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='property_memberships')
    role = models.CharField(max_length=24, choices=ROLE_CHOICES)
    active = models.BooleanField(default=True)
    last_seen = models.DateTimeField(null=True, blank=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['property','user'], name='unique_property_member')]

class ServiceLocation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='locations')
    label = models.CharField(max_length=120)
    kind = models.CharField(max_length=24, choices=[('table','Table'),('room','Room'),('counter','Counter')])
    qr_token = models.CharField(max_length=96, unique=True)
    active = models.BooleanField(default=True)
    capacity = models.PositiveIntegerField(default=2)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['property','label'], name='unique_location_label')]

class AuditEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    property_id = models.UUIDField(db_index=True)
    actor_id = models.IntegerField(null=True, blank=True)
    action = models.CharField(max_length=120)
    entity_type = models.CharField(max_length=80)
    entity_id = models.CharField(max_length=96)
    payload = models.JSONField(default=dict)
    correlation_id = models.CharField(max_length=96, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

class OutboxEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    topic = models.CharField(max_length=120)
    aggregate_id = models.CharField(max_length=96)
    payload = models.JSONField(default=dict)
    published_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        indexes = [models.Index(fields=['published_at','created_at'])]

class IdempotencyRecord(models.Model):
    key = models.CharField(max_length=160, primary_key=True)
    property_id = models.UUIDField(db_index=True)
    response = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

class MenuItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='menu_items')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.CharField(max_length=100)
    sub_category = models.CharField(max_length=100, blank=True, null=True)
    dietary_preference = models.CharField(max_length=20, choices=[('veg', 'Veg'), ('non_veg', 'Non-Veg'), ('vegan', 'Vegan')], default='veg')
    image_url = models.URLField(max_length=500, blank=True, null=True)
    available = models.BooleanField(default=True)
    is_bestseller = models.BooleanField(default=False)
    preparation_time = models.IntegerField(null=True, blank=True, help_text="Time in minutes")
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=5.00)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    stock_quantity = models.IntegerField(null=True, blank=True)
    ingredients = models.TextField(blank=True)
    spice_level = models.IntegerField(null=True, blank=True, help_text="1 to 5")
    prep_station = models.CharField(max_length=80, default='main')
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        indexes = [models.Index(fields=['property','available','category'])]

class ApprovalRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    property_id = models.UUIDField(db_index=True)
    kind = models.CharField(max_length=60)
    entity_id = models.CharField(max_length=96)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    status = models.CharField(max_length=20, choices=[('pending','Pending'),('approved','Approved'),('rejected','Rejected')], default='pending')
    reason = models.TextField()
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by_id = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

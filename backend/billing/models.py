import uuid
from decimal import Decimal
from django.core.validators import MinValueValidator
from django.db import models

class Bill(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    property_id = models.UUIDField(db_index=True)
    order = models.OneToOneField('orders.Order', on_delete=models.PROTECT, related_name='bill')
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0'))])
    tax_total = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0'))])
    total = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0'))])
    status = models.CharField(max_length=20, choices=[('open','Open'),('paid','Paid'),('void','Void')], default='open')
    created_at = models.DateTimeField(auto_now_add=True)

class Payment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bill = models.ForeignKey(Bill, on_delete=models.PROTECT, related_name='payments')
    method = models.CharField(max_length=20, choices=[('cash','Cash'),('card','Card'),('upi','UPI'),('razorpay','Razorpay')])
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    status = models.CharField(max_length=20, choices=[('pending','Pending'),('confirmed','Confirmed'),('failed','Failed'),('ambiguous','Ambiguous')], default='pending')
    idempotency_key = models.CharField(max_length=160, unique=True)
    provider_reference = models.CharField(max_length=180, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

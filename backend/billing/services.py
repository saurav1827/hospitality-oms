from decimal import Decimal
from django.db import transaction
from .models import Bill, Payment
from orders.models import Order

@transaction.atomic
def settle_order(*, order_id, method: str, amount: Decimal, idempotency_key: str) -> Payment:
    order = Order.objects.select_for_update().get(id=order_id)
    if amount != order.total:
        raise ValueError('Payment amount does not match the server-calculated order total')
    bill, _ = Bill.objects.get_or_create(order=order, defaults={'property_id': order.property_id, 'subtotal': order.subtotal, 'tax_total': order.tax_total, 'total': order.total})
    payment, created = Payment.objects.get_or_create(idempotency_key=idempotency_key, defaults={'bill': bill, 'method': method, 'amount': amount, 'status': 'confirmed' if method in {'cash','card','upi'} else 'pending'})
    if not created and payment.amount != amount:
        raise ValueError('Idempotency key was already used with a different amount')
    if payment.status == 'confirmed':
        bill.status = 'paid'; bill.save(update_fields=['status'])
        order.status = 'paid'; order.payment_status = 'paid'; order.save(update_fields=['status', 'payment_status'])
    return payment

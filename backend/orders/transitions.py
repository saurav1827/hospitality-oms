from django.db import transaction
from django.utils import timezone
from .models import Order, KitchenTicket, OrderItem
from venue_platform.models import OutboxEvent

ORDER_TRANSITIONS = {'submitted': {'preparing','cancelled'}, 'preparing': {'ready','cancelled'}, 'ready': {'served','preparing'}, 'served': {'paid'}, 'paid': set(), 'cancelled': set()}
TICKET_TRANSITIONS = {'new': {'acknowledged','recalled'}, 'acknowledged': {'preparing','recalled'}, 'preparing': {'ready','recalled'}, 'ready': {'recalled'}, 'recalled': {'acknowledged'}}

@transaction.atomic
def transition_order(order_id, target, *, actor_id=None):
    order = Order.objects.select_for_update().get(id=order_id)
    if target not in ORDER_TRANSITIONS.get(order.status, set()):
        raise ValueError(f'Invalid order transition: {order.status} -> {target}')
    order.status = target
    order.save(update_fields=['status','updated_at'])
    OutboxEvent.objects.create(topic=f'order.{target}', aggregate_id=str(order.id), payload={'order_id': str(order.id), 'order_number': order.number, 'actor_id': actor_id})
    return order

@transaction.atomic
def transition_ticket(ticket_id, target, *, actor_id=None):
    ticket = KitchenTicket.objects.select_for_update().get(id=ticket_id)
    if target not in TICKET_TRANSITIONS.get(ticket.status, set()):
        raise ValueError(f'Invalid ticket transition: {ticket.status} -> {target}')
    ticket.status = target
    if target == 'acknowledged': ticket.acknowledged_at = timezone.now()
    if target == 'ready': ticket.ready_at = timezone.now()
    ticket.save()
    OutboxEvent.objects.create(topic=f'kitchen.ticket.{target}', aggregate_id=str(ticket.id), payload={'ticket_id': str(ticket.id), 'order_id': str(ticket.order_id), 'actor_id': actor_id})
    return ticket

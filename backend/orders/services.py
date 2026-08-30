import uuid
from decimal import Decimal
from django.db import transaction
from django.db.models import Max
from .models import KitchenTicket, LocationSession, Order, OrderItem


class OrderError(Exception):
    def __init__(self, code, message):
        self.code = code
        super().__init__(message)


@transaction.atomic
def submit_order(*, property_id, location_id, idempotency_key, items, notes=''):
    existing = Order.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        return existing, False
    from venue_platform.models import Property, MenuItem
    # Lock the property to serialize order inserts and prevent IntegrityError on 'number'
    prop = Property.objects.select_for_update().get(id=property_id)
    
    menu_item_ids = [item['menu_item_id'] for item in items]
    menu_items = {mi.id: mi for mi in MenuItem.objects.filter(id__in=menu_item_ids, property_id=property_id)}
    
    validated_items = []
    for item in items:
        mi = menu_items.get(item['menu_item_id'])
        if not mi:
            raise OrderError('INVALID_ITEM', "Menu item is invalid or unavailable.")
        if not mi.available:
            raise OrderError('ITEM_UNAVAILABLE', f"Menu item {mi.name} is currently unavailable.")
        item['unit_price'] = mi.price
        item['name'] = mi.name
        validated_items.append(item)
    items = validated_items
    
    session = LocationSession.objects.select_for_update().filter(property_id=property_id, location_id=location_id, status='open').first()
    if not session:
        session = LocationSession.objects.create(property_id=property_id, location_id=location_id)
    if not items:
        raise OrderError('EMPTY_ORDER', 'At least one item is required.')
    number = (Order.objects.filter(property_id=property_id).aggregate(max_number=Max('number'))['max_number'] or 0) + 1
    subtotal = sum((Decimal(str(item['unit_price'])) * int(item['quantity']) for item in items), Decimal('0'))
    tax_total = subtotal * (prop.tax_rate / Decimal('100'))
    order = Order.objects.create(property_id=property_id, session=session, number=number, subtotal=subtotal, tax_total=tax_total, total=subtotal + tax_total, notes=notes, idempotency_key=idempotency_key)
    OrderItem.objects.bulk_create([OrderItem(order=order, menu_item_id=item['menu_item_id'], name_snapshot=item['name'], unit_price_snapshot=item['unit_price'], quantity=item['quantity'], modifiers_snapshot=item.get('modifiers', []), note=item.get('note', '')) for item in items])
    KitchenTicket.objects.create(order=order)
    return order, True

@transaction.atomic
def update_order(*, order_id, items, notes=''):
    order = Order.objects.select_for_update().get(id=order_id)
    if not items:
        raise OrderError('EMPTY_ORDER', 'At least one item is required.')
    
    from venue_platform.models import Property, MenuItem
    prop = Property.objects.get(id=order.property_id)
    
    menu_item_ids = [item['menu_item_id'] for item in items]
    menu_items = {mi.id: mi for mi in MenuItem.objects.filter(id__in=menu_item_ids, property_id=order.property_id)}
    
    validated_items = []
    for item in items:
        mi = menu_items.get(item['menu_item_id'])
        if not mi:
            raise OrderError('INVALID_ITEM', "Menu item is invalid or unavailable.")
        if not mi.available:
            raise OrderError('ITEM_UNAVAILABLE', f"Menu item {mi.name} is currently unavailable.")
        item['unit_price'] = mi.price
        item['name'] = mi.name
        validated_items.append(item)
    items = validated_items
    
    # Smart merge to preserve OrderItem IDs (Bug #5 Fix)
    existing_items = list(order.items.all())
    existing_items_dict = {str(i.menu_item_id): i for i in existing_items}
    
    items_to_create = []
    items_to_update = []
    processed_menu_item_ids = set()
    
    for item in items:
        mi_id = str(item['menu_item_id'])
        processed_menu_item_ids.add(mi_id)
        
        if mi_id in existing_items_dict:
            existing = existing_items_dict[mi_id]
            existing.quantity = item['quantity']
            existing.unit_price_snapshot = item['unit_price']
            existing.note = item.get('note', '')
            items_to_update.append(existing)
        else:
            items_to_create.append(OrderItem(
                order=order,
                menu_item_id=item['menu_item_id'],
                name_snapshot=item['name'],
                unit_price_snapshot=item['unit_price'],
                quantity=item['quantity'],
                modifiers_snapshot=item.get('modifiers', []),
                note=item.get('note', '')
            ))
            
    # Delete removed items
    items_to_delete_ids = [i.id for mi_id, i in existing_items_dict.items() if mi_id not in processed_menu_item_ids]
    if items_to_delete_ids:
        order.items.filter(id__in=items_to_delete_ids).delete()
        
    if items_to_update:
        from django.db.models import F
        # Use bulk_update to save DB queries
        OrderItem.objects.bulk_update(items_to_update, ['quantity', 'unit_price_snapshot', 'note'])
        
    if items_to_create:
        OrderItem.objects.bulk_create(items_to_create)
    
    # Calculate new totals
    subtotal = sum((Decimal(str(item['unit_price'])) * int(item['quantity']) for item in items), Decimal('0'))
    tax_total = subtotal * (prop.tax_rate / Decimal('100'))
    
    # Update order
    order.subtotal = subtotal
    order.tax_total = tax_total
    order.total = subtotal + tax_total
    if notes:
        order.notes = notes
    order.save()
    
    # Sync Kitchen Ticket (Bug #6 Fix)
    ticket = order.tickets.first()
    if ticket and ticket.status not in ['ready', 'recalled']:
        ticket.status = 'new'
        ticket.save(update_fields=['status'])
    
    return order
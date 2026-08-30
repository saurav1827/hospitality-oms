import uuid
import strawberry
from .models import Room, DeliveryAssignment

@strawberry.type
class RoomType:
    id: strawberry.ID
    number: str
    occupied: bool
    guest_name: str
    folio_reference: str

@strawberry.type
class DeliveryType:
    id: strawberry.ID
    order_id: strawberry.ID
    room_number: str
    status: str
    runner_id: int | None

@strawberry.type
class HotelQuery:
    @strawberry.field
    def rooms(self, property_id: strawberry.ID) -> list[RoomType]:
        return [RoomType(id=str(room.id), number=room.number, occupied=room.occupied, guest_name=room.guest_name, folio_reference=room.folio_reference) for room in Room.objects.filter(property_id=property_id)]

    @strawberry.field
    def deliveries(self, property_id: strawberry.ID, status: str | None = None) -> list[DeliveryType]:
        query = DeliveryAssignment.objects.filter(room__property_id=property_id).select_related('room')
        if status:
            query = query.filter(status=status)
        return [DeliveryType(id=str(item.id), order_id=str(item.order_id), room_number=item.room.number, status=item.status, runner_id=item.runner_id) for item in query]

@strawberry.type
class HotelMutation:
    @strawberry.mutation
    def assign_delivery(self, delivery_id: strawberry.ID, runner_id: int) -> DeliveryType:
        delivery = DeliveryAssignment.objects.select_related('room').get(id=uuid.UUID(str(delivery_id)))
        if delivery.status not in {'ready', 'assigned'}:
            raise ValueError('Only ready deliveries can be assigned')
        delivery.runner_id = runner_id
        delivery.status = 'assigned'
        delivery.save(update_fields=['runner_id', 'status', 'assigned_at'])
        return DeliveryType(id=str(delivery.id), order_id=str(delivery.order_id), room_number=delivery.room.number, status=delivery.status, runner_id=delivery.runner_id)

    @strawberry.mutation
    def mark_delivery(self, delivery_id: strawberry.ID, status: str) -> DeliveryType:
        if status not in {'delivered', 'no_answer', 'returned'}:
            raise ValueError('Unsupported delivery status')
        delivery = DeliveryAssignment.objects.select_related('room').get(id=uuid.UUID(str(delivery_id)))
        delivery.status = status
        delivery.save(update_fields=['status', 'delivered_at'])
        return DeliveryType(id=str(delivery.id), order_id=str(delivery.order_id), room_number=delivery.room.number, status=delivery.status, runner_id=delivery.runner_id)

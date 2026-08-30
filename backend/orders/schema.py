import uuid
import strawberry
from strawberry.types import Info
from .services import submit_order, OrderError
from .models import Order, KitchenTicket
from .transitions import transition_order, transition_ticket


@strawberry.type
class OrderItemType:
    name: str
    quantity: int
    status: str


@strawberry.type
class OrderType:
    id: strawberry.ID
    number: int
    status: str
    subtotal: str
    tax_total: str
    total: str
    notes: str
    items: list[OrderItemType]

    @staticmethod
    def from_model(order: Order):
        return OrderType(id=strawberry.ID(str(order.id)), number=order.number, status=order.status, subtotal=str(order.subtotal), tax_total=str(order.tax_total), total=str(order.total), notes=order.notes, items=[OrderItemType(name=i.name_snapshot, quantity=i.quantity, status=i.status) for i in order.items.all()])


@strawberry.input
class OrderItemInput:
    menu_item_id: strawberry.ID
    name: str
    unit_price: str
    quantity: int
    modifiers: list[str] = strawberry.field(default_factory=list)
    note: str = ''


@strawberry.type
class OrderMutationPayload:
    order: OrderType | None
    code: str | None
    message: str | None


@strawberry.type
class OrderMutation:
    @strawberry.mutation
    def submit_order(self, info: Info, property_id: strawberry.ID, location_id: strawberry.ID, idempotency_key: str, items: list[OrderItemInput], notes: str = '') -> OrderMutationPayload:
        try:
            order, _ = submit_order(property_id=uuid.UUID(str(property_id)), location_id=uuid.UUID(str(location_id)), idempotency_key=idempotency_key, notes=notes, items=[{'menu_item_id': uuid.UUID(str(item.menu_item_id)), 'name': item.name, 'unit_price': item.unit_price, 'quantity': item.quantity, 'modifiers': item.modifiers, 'note': item.note} for item in items])
            return OrderMutationPayload(order=OrderType.from_model(order), code=None, message=None)
        except OrderError as error:
            return OrderMutationPayload(order=None, code=error.code, message=str(error))


@strawberry.type
class OrderMutation(OrderMutation):
    @strawberry.mutation
    def transition_order(self, order_id: strawberry.ID, target: str) -> OrderMutationPayload:
        try:
            return OrderMutationPayload(order=OrderType.from_model(transition_order(uuid.UUID(str(order_id)), target)), code=None, message=None)
        except ValueError as error:
            return OrderMutationPayload(order=None, code='INVALID_TRANSITION', message=str(error))

    @strawberry.mutation
    def transition_ticket(self, ticket_id: strawberry.ID, target: str) -> bool:
        try:
            transition_ticket(uuid.UUID(str(ticket_id)), target)
            return True
        except ValueError:
            return False

@strawberry.type
class OrderQuery:
    @strawberry.field
    def orders(self, property_id: strawberry.ID, status: str | None = None) -> list[OrderType]:
        queryset = Order.objects.prefetch_related('items').filter(property_id=uuid.UUID(str(property_id))).order_by('-created_at')
        if status:
            queryset = queryset.filter(status=status)
        return [OrderType.from_model(order) for order in queryset[:100]]

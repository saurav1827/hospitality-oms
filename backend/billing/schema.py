import uuid
import strawberry
from decimal import Decimal
from .models import Bill
from .services import settle_order
from .splits import split_bill

@strawberry.type
class PaymentType:
    id: strawberry.ID
    status: str
    amount: str
    method: str

@strawberry.type
class BillingMutation:
    @strawberry.mutation
    def settle_order(self, order_id: strawberry.ID, method: str, amount: str, idempotency_key: str) -> PaymentType:
        payment = settle_order(order_id=uuid.UUID(str(order_id)), method=method, amount=Decimal(amount), idempotency_key=idempotency_key)
        return PaymentType(id=str(payment.id), status=payment.status, amount=str(payment.amount), method=payment.method)

    @strawberry.mutation
    def split_bill(self, bill_id: strawberry.ID, amounts: list[str]) -> list[str]:
        parts = split_bill(bill_id=uuid.UUID(str(bill_id)), parts=[Decimal(value) for value in amounts])
        return [f"{part['sequence']}:{part['amount']}:{part['status']}" for part in parts]

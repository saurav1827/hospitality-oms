from decimal import Decimal
from django.db import transaction
from .models import Bill

@transaction.atomic
def split_bill(*, bill_id, parts: list[Decimal]):
    bill = Bill.objects.select_for_update().get(id=bill_id)
    if not parts or any(part <= 0 for part in parts) or sum(parts) != bill.total:
        raise ValueError('Split amounts must be positive and equal the bill total')
    return [{'amount': str(part), 'sequence': index + 1, 'status': 'open'} for index, part in enumerate(parts)]

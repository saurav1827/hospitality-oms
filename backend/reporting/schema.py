import strawberry
from django.db.models import Sum
from orders.models import Order

@strawberry.type
class RevenueSummary:
    order_count: int
    paid_count: int
    open_orders: int
    preparing_orders: int
    gross_revenue: str

@strawberry.type
class ReportingQuery:
    @strawberry.field
    def revenue_summary(self, property_id: strawberry.ID) -> RevenueSummary:
        from django.db.models import Count, Q
        qs = Order.objects.filter(property_id=property_id)
        agg = qs.aggregate(
            order_count=Count('id'),
            paid_count=Count('id', filter=Q(status='paid')),
            open_orders=Count('id', filter=Q(status__in=['submitted', 'preparing', 'ready'])),
            preparing_orders=Count('id', filter=Q(status='preparing')),
            total=Sum('total', filter=Q(status='paid'))
        )
        return RevenueSummary(
            order_count=agg['order_count'],
            paid_count=agg['paid_count'],
            open_orders=agg['open_orders'],
            preparing_orders=agg['preparing_orders'],
            gross_revenue=str(agg['total'] or 0),
        )
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Count, Sum, Q
from orders.models import Order

class RevenueSummaryView(APIView):
    def get(self, request, property_id):
        qs = Order.objects.filter(property_id=property_id)
        agg = qs.aggregate(
            order_count=Count('id'),
            paid_count=Count('id', filter=Q(status='paid')),
            open_orders=Count('id', filter=Q(status__in=['submitted', 'preparing', 'ready'])),
            preparing_orders=Count('id', filter=Q(status='preparing')),
            total=Sum('total', filter=Q(status='paid'))
        )
        
        data = {
            'orderCount': agg['order_count'],
            'paidCount': agg['paid_count'],
            'openOrders': agg['open_orders'],
            'preparingOrders': agg['preparing_orders'],
            'grossRevenue': str(agg['total'] or 0)
        }
        return Response({'revenueSummary': data})

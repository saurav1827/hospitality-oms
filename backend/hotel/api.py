import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import Room, DeliveryAssignment

class RoomListView(APIView):
    def get(self, request, property_id):
        rooms = Room.objects.filter(property_id=property_id)
        data = [{
            'id': str(r.id),
            'number': r.number,
            'occupied': r.occupied,
            'guestName': r.guest_name,
            'folioReference': r.folio_reference
        } for r in rooms]
        return Response({'rooms': data})

class DeliveryListView(APIView):
    def get(self, request, property_id):
        status_filter = request.query_params.get('status')
        query = DeliveryAssignment.objects.filter(room__property_id=property_id).select_related('room')
        if status_filter:
            query = query.filter(status=status_filter)
        
        deliveries = list(query)
        order_ids = [d.order_id for d in deliveries]
        
        from orders.models import Order
        orders = {o.id: o for o in Order.objects.filter(id__in=order_ids)}
        
        data = []
        for d in deliveries:
            order = orders.get(d.order_id)
            order_number = order.number if order else None
            order_created_at = order.created_at.isoformat() if order else None
            
            # Estimate time to ready. The order is updated when marked ready.
            # Assuming the last updated_at before delivery completion is the ready time.
            time_to_ready_ms = None
            if order and order.created_at and order.updated_at:
                diff = order.updated_at - order.created_at
                time_to_ready_ms = int(diff.total_seconds() * 1000)
                
            data.append({
                'id': str(d.id),
                'orderId': str(d.order_id),
                'orderNumber': order_number,
                'orderCreatedAt': order_created_at,
                'timeToReadyMs': time_to_ready_ms,
                'roomNumber': d.room.number,
                'status': d.status,
                'runnerId': d.runner_id
            })
        return Response({'deliveries': data})

class DeliveryAssignView(APIView):
    def post(self, request, pk):
        runner_id = request.data.get('runnerId')
        delivery = get_object_or_404(DeliveryAssignment.objects.select_related('room'), id=pk)
        
        if delivery.status not in {'ready', 'assigned'}:
            return Response({'error': 'Only ready deliveries can be assigned'}, status=status.HTTP_400_BAD_REQUEST)
        
        delivery.runner_id = runner_id
        delivery.status = 'assigned'
        delivery.save(update_fields=['runner_id', 'status', 'assigned_at'])
        
        return Response({'assignDelivery': {
            'id': str(delivery.id),
            'orderId': str(delivery.order_id),
            'roomNumber': delivery.room.number,
            'status': delivery.status,
            'runnerId': delivery.runner_id
        }})

class DeliveryCompleteView(APIView):
    def post(self, request, pk):
        from django.utils import timezone
        from venue_platform.models import PropertyMembership
        
        delivery = get_object_or_404(DeliveryAssignment.objects.select_related('room'), id=pk)
        
        membership = PropertyMembership.objects.filter(user=request.user, property_id=delivery.room.property_id, active=True).first()
        if not membership:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
        allowed_roles = {'admin', 'manager', 'front_desk'}
        if membership.role not in allowed_roles:
            if membership.user.id != delivery.runner_id:
                return Response({'error': 'Only the assigned waiter or an admin/manager can mark this delivery as completed'}, status=status.HTTP_403_FORBIDDEN)
        
        if delivery.status != 'assigned':
            return Response({'error': 'Only assigned deliveries can be completed'}, status=status.HTTP_400_BAD_REQUEST)
            
        delivery.status = 'delivered'
        delivery.delivered_at = timezone.now()
        delivery.save(update_fields=['status', 'delivered_at'])
        
        # Also update the order status
        from orders.models import Order
        Order.objects.filter(id=delivery.order_id).update(status='served')
        
        return Response({'success': True})

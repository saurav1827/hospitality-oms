from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from decimal import Decimal
import uuid

from .services import settle_order
from orders.models import Order
from venue_platform.permissions import IsPropertyStaff

class ProcessPaymentView(APIView):
    permission_classes = [IsPropertyStaff]

    def post(self, request, pk):
        # pk is the order ID
        amount_str = request.data.get('amount')
        method = request.data.get('method')
        idempotency_key = request.data.get('idempotencyKey')

        if not amount_str or not method or not idempotency_key:
            return Response({'error': 'amount, method, and idempotencyKey are required'}, status=status.HTTP_400_BAD_REQUEST)

        order = get_object_or_404(Order, id=pk)
        
        # Check permissions explicitly since property_id is not in URL kwargs
        self.check_object_permissions(request, order)

        try:
            amount = Decimal(str(amount_str))
            
            if method == 'razorpay':
                from venue_platform.razorpay_client import get_razorpay_client
                import os
                client = get_razorpay_client()
                amount_in_paise = int(amount * 100)
                
                if client and amount_in_paise > 0:
                    rzp_order = client.order.create({
                        "amount": amount_in_paise,
                        "currency": order.currency,
                        "receipt": str(order.number)
                    })
                    razorpay_order_id = rzp_order.get('id')
                    order.razorpay_order_id = razorpay_order_id
                    order.save(update_fields=['razorpay_order_id'])
                    
                    return Response({
                        'payment': {
                            'razorpayOrderId': razorpay_order_id,
                            'amount': amount_in_paise,
                            'currency': order.currency,
                            'keyId': os.environ.get('RAZORPAY_KEY_ID', '')
                        }
                    })
                return Response({'error': 'Razorpay not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            payment = settle_order(
                order_id=order.id,
                method=method,
                amount=amount,
                idempotency_key=idempotency_key
            )
            
            try:
                from notifications.services import notify_order_settled
                notify_order_settled(order)
            except Exception:
                pass
            
            try:
                from orders.api import broadcast_order_update
                broadcast_order_update(order.property_id)
            except Exception:
                pass

            return Response({
                'payment': {
                    'id': str(payment.id),
                    'status': payment.status,
                    'method': payment.method
                }
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            # If it's a razorpay auth error, surface it clearly
            if 'Authentication failed' in str(e):
                return Response({'error': 'Razorpay Authentication failed. Please check your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env and restart the backend.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response({'error': 'Failed to process payment'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class StaffPaymentVerifyView(APIView):
    permission_classes = [IsPropertyStaff]

    def post(self, request, pk):
        from venue_platform.razorpay_client import get_razorpay_client
        order = get_object_or_404(Order, id=pk)
        self.check_object_permissions(request, order)

        razorpay_payment_id = request.data.get('razorpayPaymentId')
        razorpay_order_id = request.data.get('razorpayOrderId')
        razorpay_signature = request.data.get('razorpaySignature')
        idempotency_key = request.data.get('idempotencyKey')
        
        if order.payment_status == 'paid':
            return Response({'success': True})
            
        client = get_razorpay_client()
        if client:
            try:
                client.utility.verify_payment_signature({
                    'razorpay_order_id': razorpay_order_id,
                    'razorpay_payment_id': razorpay_payment_id,
                    'razorpay_signature': razorpay_signature
                })
                
                payment = settle_order(
                    order_id=order.id,
                    method='razorpay',
                    amount=order.total,
                    idempotency_key=idempotency_key
                )
                
                order.payment_status = 'paid'
                order.razorpay_payment_id = razorpay_payment_id
                order.razorpay_signature = razorpay_signature
                order.save(update_fields=['payment_status', 'razorpay_payment_id', 'razorpay_signature'])
                
                from venue_platform.models import AuditEvent
                import uuid
                AuditEvent.objects.create(
                    property_id=order.property_id,
                    action='STAFF_PAYMENT_VERIFIED',
                    entity_type='order',
                    entity_id=str(order.id),
                    payload={'razorpay_payment_id': razorpay_payment_id, 'amount': float(order.total)},
                    correlation_id=razorpay_payment_id or str(uuid.uuid4())
                )
                
                try:
                    from notifications.services import notify_order_settled
                    notify_order_settled(order)
                except Exception:
                    pass
                
                try:
                    from orders.api import broadcast_order_update
                    broadcast_order_update(order.property_id)
                except Exception:
                    pass
                
                return Response({'success': True})
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'error': 'Razorpay not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

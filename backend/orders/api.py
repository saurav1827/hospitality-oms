import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import Order
from .services import submit_order, OrderError
from venue_platform.permissions import IsPropertyStaff

def broadcast_order_update(property_id):
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"property_{property_id}",
                {
                    "type": "event_notification",
                    "payload": {"type": "order_updated"}
                }
            )
    except Exception:
        pass

class OrderListView(APIView):
    permission_classes = [IsPropertyStaff]

    def get(self, request, property_id):
        status_filter = request.query_params.get('status')
        queryset = Order.objects.prefetch_related('items').filter(property_id=property_id).order_by('created_at') # Order by oldest first for kitchen
        if status_filter:
            statuses = status_filter.split(',')
            queryset = queryset.filter(status__in=statuses)
        
        # Limit to 100 as per original GraphQL resolver
        orders = list(queryset[:100])
        order_ids = [o.id for o in orders]
        
        # Prefetch delivery assignments to avoid N+1
        from hotel.models import DeliveryAssignment
        deliveries = {d.order_id: d for d in DeliveryAssignment.objects.filter(order_id__in=order_ids)}
        
        # Prefetch bills and payments
        # We can just rely on select_related/prefetch_related for bills, but we didn't add it to queryset.
        # Let's just fetch payments for paid orders
        paid_orders_ids = [o.id for o in orders if o.status == 'paid']
        payments_by_order = {}
        if paid_orders_ids:
            from billing.models import Payment
            payments = Payment.objects.filter(bill__order_id__in=paid_orders_ids, status='confirmed').select_related('bill')
            for p in payments:
                payments_by_order[p.bill.order_id] = p.method

        data = []
        for o in orders:
            payment_method = payments_by_order.get(o.id)
            delivery = deliveries.get(o.id)
            delivered_at = delivery.delivered_at.isoformat() if delivery and delivery.delivered_at else None
            
            data.append({
                'id': str(o.id),
                'number': o.number,
                'status': o.status,
                'subtotal': str(o.subtotal),
                'taxTotal': str(o.tax_total),
                'total': str(o.total),
                'notes': o.notes,
                'createdAt': o.created_at.isoformat(),
                'updatedAt': o.updated_at.isoformat(),
                'paymentMethod': payment_method,
                'deliveredAt': delivered_at,
                'items': [{
                    'name': i.name_snapshot,
                    'quantity': i.quantity,
                    'unitPrice': str(i.unit_price_snapshot),
                    'status': i.status
                } for i in o.items.all()]
            })
        
        return Response({'orders': data})

    def post(self, request, property_id):
        location_id = request.data.get('locationId')
        idempotency_key = request.data.get('idempotencyKey')
        items = request.data.get('items', [])
        notes = request.data.get('notes', '')

        try:
            mapped_items = [{
                'menu_item_id': uuid.UUID(str(item['menuItemId'])),
                'name': item['name'],
                'unit_price': item['unitPrice'],
                'quantity': item['quantity'],
                'modifiers': item.get('modifiers', []),
                'note': item.get('note', '')
            } for item in items]
            
            order, _ = submit_order(
                property_id=uuid.UUID(str(property_id)),
                location_id=uuid.UUID(str(location_id)),
                idempotency_key=idempotency_key,
                items=mapped_items,
                notes=notes
            )
            
            try:
                from notifications.services import notify_new_order
                notify_new_order(order)
            except Exception:
                pass
                
            broadcast_order_update(property_id)
            
            # Format to match frontend expectations: data.submitOrder.order...
            return Response({'submitOrder': {
                'order': {
                    'id': str(order.id),
                    'number': order.number,
                    'status': order.status,
                    'total': str(order.total)
                },
                'code': None,
                'message': None
            }})
        except OrderError as error:
            return Response({'submitOrder': {
                'order': None,
                'code': error.code,
                'message': str(error)
            }}, status=status.HTTP_400_BAD_REQUEST)

class OrderReadyView(APIView):
    permission_classes = [IsPropertyStaff]

    def post(self, request, pk):
        order = get_object_or_404(Order, id=pk)
        
        # In a real system, you'd check if it's already ready, but for now just update it
        order.status = 'ready'
        order.ready_by_name = request.user.get_full_name() or request.user.username
        order.save(update_fields=['status', 'ready_by_name'])
        
        # Update associated kitchen tickets
        order.tickets.update(status='ready')
        
        # Extract table number from JSON notes
        import json
        table_number = 'TBD'
        try:
            if order.notes.startswith('{'):
                notes_data = json.loads(order.notes)
                table_number = notes_data.get('tableNumber', 'TBD')
        except Exception:
            pass

        # Create a delivery record for the hotel runner
        from hotel.models import Room, DeliveryAssignment
        room, _ = Room.objects.get_or_create(
            property_id=order.property_id,
            number=table_number,
            defaults={'occupied': True, 'guest_name': 'Pending Assignment'}
        )
        
        DeliveryAssignment.objects.create(
            order_id=order.id,
            room=room
        )
        
        try:
            from notifications.services import notify_order_ready
            notify_order_ready(order)
        except Exception:
            pass
            
        broadcast_order_update(order.property_id)
        
        return Response({'success': True})

class OrderDetailView(APIView):
    permission_classes = [IsPropertyStaff]

    def patch(self, request, pk):
        from .services import update_order
        items = request.data.get('items', [])
        notes = request.data.get('notes')
        
        try:
            mapped_items = [{
                'menu_item_id': uuid.UUID(str(item['menuItemId'])),
                'name': item['name'],
                'unit_price': item['unitPrice'],
                'quantity': item['quantity'],
                'modifiers': item.get('modifiers', []),
                'note': item.get('note', '')
            } for item in items]
            
            order = update_order(
                order_id=uuid.UUID(str(pk)),
                items=mapped_items,
                notes=notes
            )
            broadcast_order_update(order.property_id)
            return Response({'updateOrder': {'id': str(order.id)}})
        except OrderError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': 'Failed to update order'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    def delete(self, request, pk):
        from rest_framework import status
        from venue_platform.models import PropertyMembership
        order = get_object_or_404(Order, id=pk)
        
        membership = PropertyMembership.objects.filter(user=request.user, property_id=order.property_id, active=True).first()
        if not membership or membership.role != 'admin':
            return Response({'error': 'Only admins can delete orders'}, status=status.HTTP_403_FORBIDDEN)
            
        # Clean up related objects that would otherwise prevent deletion due to ProtectedError
        try:
            if hasattr(order, 'bill') and order.bill:
                order.bill.payments.all().delete()
                order.bill.delete()
        except Exception:
            pass

        try:
            from hotel.models import DeliveryAssignment
            DeliveryAssignment.objects.filter(order_id=order.id).delete()
        except Exception:
            pass
            
        try:
            from notifications.models import NotificationIntent
            NotificationIntent.objects.filter(event_id=order.id).delete()
        except Exception:
            pass

        property_id = order.property_id
        order.delete()
        broadcast_order_update(property_id)
        return Response(status=status.HTTP_204_NO_CONTENT)

class GuestOrderSubmitView(APIView):
    # Public endpoint
    def post(self, request, qr_token):
        from venue_platform.models import ServiceLocation
        from venue_platform.razorpay_client import get_razorpay_client
        import os
        location = get_object_or_404(ServiceLocation, qr_token=qr_token, active=True)
        property_id = location.property.id
        
        idempotency_key = request.data.get('idempotencyKey')
        items = request.data.get('items', [])
        notes = request.data.get('notes', '')
        payment_method = request.data.get('paymentMethod', 'pay_now')

        try:
            mapped_items = [{
                'menu_item_id': uuid.UUID(str(item['menuItemId'])),
                'name': item['name'],
                'unit_price': item['unitPrice'],
                'quantity': item['quantity'],
                'modifiers': item.get('modifiers', []),
                'note': item.get('note', '')
            } for item in items]
            
            order, _ = submit_order(
                property_id=property_id,
                location_id=location.id,
                idempotency_key=idempotency_key,
                items=mapped_items,
                notes=notes
            )
            
            if payment_method == 'pay_later':
                order.payment_status = 'pending'
                order.save(update_fields=['payment_status'])
                
                try:
                    from notifications.services import notify_new_order
                    notify_new_order(order)
                except Exception:
                    pass
                broadcast_order_update(property_id)
                
                return Response({
                    'submitOrder': {
                        'order': {
                            'id': str(order.id),
                            'number': order.number,
                            'status': order.status
                        },
                        'payment': None
                    }
                })
            
            # Create razorpay order for 'pay_now'
            client = get_razorpay_client()
            razorpay_order_id = None
            amount_in_paise = int(order.total * 100)
            
            if client and amount_in_paise > 0:
                try:
                    rzp_order = client.order.create({
                        "amount": amount_in_paise,
                        "currency": order.currency,
                        "receipt": str(order.number)
                    })
                    razorpay_order_id = rzp_order.get('id')
                    order.razorpay_order_id = razorpay_order_id
                    order.save(update_fields=['razorpay_order_id'])
                except Exception as e:
                    # Fallback or log if needed, for now we will just proceed without razorpay
                    print(f"Razorpay error: {e}")
                    if 'Authentication failed' in str(e):
                        return Response({'error': 'Razorpay Authentication failed. The restaurant needs to update their API keys.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            return Response({
                'submitOrder': {
                    'order': {
                        'id': str(order.id),
                        'number': order.number,
                        'status': order.status
                    },
                    'payment': {
                        'razorpayOrderId': razorpay_order_id,
                        'amount': amount_in_paise,
                        'currency': order.currency,
                        'keyId': os.environ.get('RAZORPAY_KEY_ID', '')
                    } if razorpay_order_id else None
                }
            })
        except OrderError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': 'Failed to submit order'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GuestPaymentVerifyView(APIView):
    def post(self, request, qr_token):
        from venue_platform.razorpay_client import get_razorpay_client
        order_id = request.data.get('orderId')
        razorpay_payment_id = request.data.get('razorpayPaymentId')
        razorpay_order_id = request.data.get('razorpayOrderId')
        razorpay_signature = request.data.get('razorpaySignature')
        
        order = get_object_or_404(Order, id=order_id)
        
        # Idempotency check: If already paid, do nothing
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
                order.payment_status = 'paid'
                order.razorpay_payment_id = razorpay_payment_id
                order.razorpay_signature = razorpay_signature
                order.save(update_fields=['payment_status', 'razorpay_payment_id', 'razorpay_signature'])
                
                # Payment Auditing
                from venue_platform.models import AuditEvent
                import uuid
                AuditEvent.objects.create(
                    property_id=order.property_id,
                    action='PAYMENT_VERIFIED',
                    entity_type='order',
                    entity_id=str(order.id),
                    payload={'razorpay_payment_id': razorpay_payment_id, 'amount': float(order.total)},
                    correlation_id=razorpay_payment_id or str(uuid.uuid4())
                )
                
                # Notify kitchen now that it's paid
                try:
                    from notifications.services import notify_new_order
                    notify_new_order(order)
                except Exception:
                    pass
                broadcast_order_update(order.property_id)
                
                return Response({'success': True})
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'error': 'Razorpay not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GuestOrderTrackingView(APIView):
    def get(self, request, qr_token, order_id):
        from venue_platform.models import ServiceLocation
        from hotel.models import DeliveryAssignment
        from django.contrib.auth.models import User
        location = get_object_or_404(ServiceLocation, qr_token=qr_token, active=True)
        order = get_object_or_404(Order.objects.prefetch_related('items'), id=order_id, property_id=location.property_id)
        
        # Runner Info
        delivery = DeliveryAssignment.objects.filter(order_id=order.id).first()
        runner_name = None
        if delivery and delivery.runner_id:
            try:
                user = User.objects.get(id=delivery.runner_id)
                runner_name = f"{user.first_name} {user.last_name}".strip() or user.username
            except User.DoesNotExist:
                pass

        # Items
        items_data = [{
            'name': i.name_snapshot,
            'quantity': i.quantity,
            'unitPrice': str(i.unit_price_snapshot),
            'status': i.status
        } for i in order.items.all()]
        
        return Response({
            'id': str(order.id),
            'number': order.number,
            'status': order.status,
            'payment_status': order.payment_status,
            'total': str(order.total),
            'subtotal': str(order.subtotal),
            'tax_total': str(order.tax_total),
            'created_at': order.created_at.isoformat(),
            'items': items_data,
            'runner_name': runner_name,
            'ready_by_name': order.ready_by_name,
            'location_label': location.label
        })

class GuestOrderPayView(APIView):
    def post(self, request, qr_token, order_id):
        from venue_platform.models import ServiceLocation
        from venue_platform.razorpay_client import get_razorpay_client
        import os
        
        location = get_object_or_404(ServiceLocation, qr_token=qr_token, active=True)
        order = get_object_or_404(Order, id=order_id, property_id=location.property_id)
        
        if order.payment_status == 'paid':
            return Response({'error': 'Order is already paid'}, status=status.HTTP_400_BAD_REQUEST)
            
        client = get_razorpay_client()
        razorpay_order_id = order.razorpay_order_id
        amount_in_paise = int(order.total * 100)
        
        if not razorpay_order_id and client and amount_in_paise > 0:
            try:
                rzp_order = client.order.create({
                    "amount": amount_in_paise,
                    "currency": order.currency,
                    "receipt": str(order.number)
                })
                razorpay_order_id = rzp_order.get('id')
                order.razorpay_order_id = razorpay_order_id
                order.save(update_fields=['razorpay_order_id'])
            except Exception as e:
                return Response({'error': 'Failed to create payment gateway order'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        if not razorpay_order_id:
            return Response({'error': 'Payment gateway not configured'}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response({
            'payment': {
                'razorpayOrderId': razorpay_order_id,
                'amount': amount_in_paise,
                'currency': order.currency,
                'keyId': os.environ.get('RAZORPAY_KEY_ID', '')
            }
        })

class GuestOrderInvoiceView(APIView):
    def get(self, request, qr_token, order_id):
        from venue_platform.models import ServiceLocation, Property
        from django.http import HttpResponse
        from reportlab.pdfgen import canvas
        
        location = get_object_or_404(ServiceLocation, qr_token=qr_token, active=True)
        order = get_object_or_404(Order.objects.prefetch_related('items'), id=order_id, property_id=location.property_id)
        
        if order.payment_status != 'paid':
            return Response({'error': 'Invoice is only available for paid orders'}, status=status.HTTP_400_BAD_REQUEST)
            
        prop = Property.objects.get(id=order.property_id)
        
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Invoice_Order_{order.number}.pdf"'
        
        p = canvas.Canvas(response)
        
        # Header
        p.setFont("Helvetica-Bold", 20)
        p.drawString(50, 800, prop.name)
        p.setFont("Helvetica", 12)
        p.drawString(50, 780, f"Order #{order.number}")
        p.drawString(50, 760, f"Location: {location.label}")
        p.drawString(50, 740, f"Date: {order.created_at.strftime('%Y-%m-%d %H:%M')}")
        
        # Items Table Header
        y = 700
        p.setFont("Helvetica-Bold", 12)
        p.drawString(50, y, "Item")
        p.drawString(300, y, "Qty")
        p.drawString(380, y, "Price")
        p.drawString(480, y, "Total")
        p.line(50, y-5, 540, y-5)
        
        y -= 25
        p.setFont("Helvetica", 11)
        for item in order.items.all():
            p.drawString(50, y, item.name_snapshot[:35])
            p.drawString(300, y, str(item.quantity))
            p.drawString(380, y, f"{item.unit_price_snapshot}")
            p.drawString(480, y, f"{item.quantity * item.unit_price_snapshot}")
            y -= 20
            
        p.line(50, y, 540, y)
        y -= 25
        
        # Totals
        p.setFont("Helvetica-Bold", 12)
        p.drawString(380, y, "Subtotal:")
        p.drawString(480, y, f"{order.subtotal}")
        y -= 20
        p.drawString(380, y, "Tax:")
        p.drawString(480, y, f"{order.tax_total}")
        y -= 20
        p.drawString(380, y, "Total Paid:")
        p.drawString(480, y, f"{order.currency} {order.total}")
        
        # Footer
        p.setFont("Helvetica-Oblique", 10)
        p.drawString(50, 50, "Thank you for your visit!")
        
        p.showPage()
        p.save()
        
        return response

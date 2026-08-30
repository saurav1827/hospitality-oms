from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import NotificationIntent

class NotificationListView(APIView):
    def get(self, request, property_id):
        rows = NotificationIntent.objects.filter(
            property_id=property_id, 
            channel='in_app'
        ).order_by('-created_at')[:100]
        data = [{
            'id': str(row.id),
            'notificationType': row.notification_type,
            'channel': row.channel,
            'status': row.status,
            'payload': row.payload,
            'createdAt': row.created_at.isoformat()
        } for row in rows]
        return Response({'notifications': data})

class NotificationAcknowledgeView(APIView):
    def post(self, request, pk):
        # We assume pk is the notification ID
        # Since the original schema returned a string, we return success as a string
        # though returning boolean is better REST practice. We'll return {"acknowledgeNotification": "ok"}
        try:
            notification = get_object_or_404(NotificationIntent, id=pk)
            notification.status = 'acknowledged'
            notification.save(update_fields=['status'])
            return Response({'acknowledgeNotification': 'success'})
        except Exception:
            return Response({'acknowledgeNotification': 'failed'})

import uuid
import strawberry
from .models import NotificationIntent

@strawberry.type
class NotificationType:
    id: strawberry.ID
    notification_type: str
    channel: str
    status: str
    payload: strawberry.scalars.JSON
    created_at: str

@strawberry.type
class NotificationQuery:
    @strawberry.field
    def notifications(self, property_id: strawberry.ID) -> list[NotificationType]:
        rows = NotificationIntent.objects.filter(property_id=uuid.UUID(str(property_id))).order_by('-created_at')[:100]
        return [NotificationType(id=strawberry.ID(str(row.id)), notification_type=row.notification_type, channel=row.channel, status=row.status, payload=row.payload, created_at=row.created_at.isoformat()) for row in rows]

@strawberry.type
class NotificationMutation:
    @strawberry.mutation
    def acknowledge_notification(self, notification_id: strawberry.ID) -> bool:
        return NotificationIntent.objects.filter(id=uuid.UUID(str(notification_id))).update(status='acknowledged') == 1

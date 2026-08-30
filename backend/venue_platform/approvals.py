import hashlib
from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

class ApprovalRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=__import__('uuid').uuid4, editable=False)
    property_id = models.UUIDField(db_index=True)
    kind = models.CharField(max_length=60)
    entity_id = models.CharField(max_length=96)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    status = models.CharField(max_length=20, choices=[('pending','Pending'),('approved','Approved'),('rejected','Rejected')], default='pending')
    reason = models.TextField()
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by_id = models.IntegerField(null=True, blank=True)
    pin_digest = models.CharField(max_length=128, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

@transaction.atomic
def decide_approval(request_id, approved, *, actor_id, pin):
    request = ApprovalRequest.objects.select_for_update().get(id=request_id)
    if request.status != 'pending': raise ValueError('Approval request is already decided')
    if not pin or len(pin) < 4: raise ValueError('A manager PIN is required')
    request.status = 'approved' if approved else 'rejected'
    request.decided_by_id = actor_id
    request.decided_at = timezone.now()
    request.pin_digest = hashlib.sha256(pin.encode()).hexdigest()
    request.save(update_fields=['status','decided_by_id','decided_at','pin_digest'])
    return request

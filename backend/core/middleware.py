import json
import time
import uuid
from django.http import JsonResponse

class CorrelationIdMiddleware:
    def __init__(self, get_response): self.get_response = get_response
    def __call__(self, request):
        request.correlation_id = request.headers.get('X-Correlation-ID', str(uuid.uuid4()))
        response = self.get_response(request)
        response['X-Correlation-ID'] = request.correlation_id
        response['X-Content-Type-Options'] = 'nosniff'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        return response

class StructuredExceptionMiddleware:
    def __init__(self, get_response): self.get_response = get_response
    def __call__(self, request):
        started = time.monotonic()
        try:
            response = self.get_response(request)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({'error': {'code': 'INTERNAL_ERROR', 'message': str(e), 'correlation_id': getattr(request, 'correlation_id', None)}}, status=500)
        response['X-Response-Time-ms'] = str(round((time.monotonic() - started) * 1000, 2))
        return response

class UpdateLastSeenMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if hasattr(request, 'user') and request.user.is_authenticated:
            try:
                from django.utils import timezone
                from venue_platform.models import PropertyMembership
                
                now = timezone.now()
                last_seen_str = request.session.get('last_seen')
                
                should_update = True
                if last_seen_str:
                    try:
                        last_seen = timezone.datetime.fromisoformat(last_seen_str)
                        if (now - last_seen).total_seconds() < 60:
                            should_update = False
                    except Exception:
                        pass
                
                if should_update:
                    PropertyMembership.objects.filter(user=request.user, active=True).update(last_seen=now)
                    request.session['last_seen'] = now.isoformat()
            except Exception as e:
                import traceback
                traceback.print_exc()
                
        return self.get_response(request)

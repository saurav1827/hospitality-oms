from django.db import connection
from django.http import JsonResponse
from django.core.cache import cache

def health(request):
    try:
        with connection.cursor() as cursor: cursor.execute('SELECT 1')
        cache.set('healthcheck', 'ok', timeout=5)
        return JsonResponse({'status': 'ok', 'database': 'ready', 'redis': 'ready'})
    except Exception:
        return JsonResponse({'status': 'degraded'}, status=503)

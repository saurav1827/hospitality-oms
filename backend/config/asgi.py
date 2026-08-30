import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.core.asgi import get_asgi_application
from django.urls import re_path
from core.consumers import OperationsConsumer

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter([
            re_path(r"ws/operations/$", OperationsConsumer.as_asgi()),
        ])
    ),
})

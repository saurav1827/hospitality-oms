import urllib.parse
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class OperationsConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        params = urllib.parse.parse_qs(query_string)
        self.property_id = params.get('property_id', [None])[0]

        if not self.property_id:
            await self.close(code=4000) # Bad Request
            return

        self.group_name = f"property_{self.property_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({'type': 'connection.ready', 'data': {'replay_supported': True}})

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if content.get('type') == 'ping':
            await self.send_json({'type': 'pong'})
        else:
            await self.send_json({'type': 'error', 'error': {'code': 'UNSUPPORTED_EVENT', 'message': 'Unsupported realtime event.'}})

    async def event_notification(self, event):
        await self.send_json(event['payload'])

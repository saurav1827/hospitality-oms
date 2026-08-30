import strawberry
from django.db import connection
from orders.schema import OrderMutation, OrderQuery
from notifications.schema import NotificationMutation, NotificationQuery
from venue_platform.schema import PlatformMutation, PlatformQuery
from billing.schema import BillingMutation
from identity.schema import IdentityMutation, IdentityQuery
from reporting.schema import ReportingQuery
from hotel.schema import HotelMutation, HotelQuery

@strawberry.type
class Health:
    database: str
    realtime: str

@strawberry.type
class Query(OrderQuery, NotificationQuery, PlatformQuery, IdentityQuery, ReportingQuery, HotelQuery):
    @strawberry.field
    def health(self) -> Health:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        return Health(database='ready', realtime='channels')

@strawberry.type
class Mutation(OrderMutation, NotificationMutation, PlatformMutation, BillingMutation, IdentityMutation, HotelMutation):
    pass

schema = strawberry.Schema(query=Query, mutation=Mutation)

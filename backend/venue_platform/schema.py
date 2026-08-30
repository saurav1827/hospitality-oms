import strawberry
from decimal import Decimal
from .models import MenuItem, Property, ServiceLocation

@strawberry.type
class MenuItemType:
    id: strawberry.ID
    name: str
    description: str
    category: str
    price: Decimal
    available: bool
    prep_station: str

@strawberry.type
class LocationType:
    id: strawberry.ID
    label: str
    kind: str
    capacity: int
    active: bool

@strawberry.type
class PropertyType:
    id: strawberry.ID
    name: str
    currency: str
    tax_rate: Decimal

@strawberry.type
class PlatformQuery:
    @strawberry.field
    def properties(self) -> list[PropertyType]:
        return [PropertyType(id=str(p.id), name=p.name, currency=p.currency, tax_rate=p.tax_rate) for p in Property.objects.filter(active=True)]

    @strawberry.field
    def menu(self, property_id: strawberry.ID) -> list[MenuItemType]:
        return [MenuItemType(id=str(i.id), name=i.name, description=i.description, category=i.category, price=i.price, available=i.available, prep_station=i.prep_station) for i in MenuItem.objects.filter(property_id=property_id, available=True)]

    @strawberry.field
    def locations(self, property_id: strawberry.ID) -> list[LocationType]:
        return [LocationType(id=str(l.id), label=l.label, kind=l.kind, capacity=l.capacity, active=l.active) for l in ServiceLocation.objects.filter(property_id=property_id, active=True)]

@strawberry.input
class MenuItemInput:
    property_id: strawberry.ID
    name: str
    description: str = ''
    category: str = 'General'
    price: Decimal = Decimal('0')
    prep_station: str = 'main'

@strawberry.input
class MenuItemUpdateInput:
    id: strawberry.ID
    name: str | None = None
    description: str | None = None
    category: str | None = None
    price: Decimal | None = None
    available: bool | None = None
    prep_station: str | None = None

@strawberry.type
class PlatformMutation:
    @strawberry.mutation
    def create_menu_item(self, data: MenuItemInput) -> MenuItemType:
        if data.price < 0:
            raise ValueError('Price cannot be negative')
        item = MenuItem.objects.create(property_id=data.property_id, name=data.name.strip(), description=data.description, category=data.category, price=data.price, prep_station=data.prep_station)
        return MenuItemType(id=str(item.id), name=item.name, description=item.description, category=item.category, price=item.price, available=item.available, prep_station=item.prep_station)

    @strawberry.mutation
    def update_menu_item(self, data: MenuItemUpdateInput) -> MenuItemType:
        item = MenuItem.objects.get(id=data.id)
        if data.name is not None: item.name = data.name.strip()
        if data.description is not None: item.description = data.description
        if data.category is not None: item.category = data.category
        if data.price is not None:
            if data.price < 0: raise ValueError('Price cannot be negative')
            item.price = data.price
        if data.available is not None: item.available = data.available
        if data.prep_station is not None: item.prep_station = data.prep_station
        item.save()
        return MenuItemType(id=str(item.id), name=item.name, description=item.description, category=item.category, price=item.price, available=item.available, prep_station=item.prep_station)

    @strawberry.mutation
    def delete_menu_item(self, id: strawberry.ID) -> bool:
        MenuItem.objects.filter(id=id).delete()
        return True

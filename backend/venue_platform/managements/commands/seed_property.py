import uuid
from django.core.management.base import BaseCommand
from venue_platform.models import Property


class Command(BaseCommand):
    help = 'Seed a default Property row for local development'

    def handle(self, *args, **options):
        prop, created = Property.objects.get_or_create(
            id=uuid.UUID('00000000-0000-0000-0000-000000000001'),
            defaults={'name': 'Default Property', 'currency': 'INR', 'tax_rate': 5},
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created property: {prop.id}'))
        else:
            self.stdout.write(self.style.WARNING(f'Property already exists: {prop.id}'))
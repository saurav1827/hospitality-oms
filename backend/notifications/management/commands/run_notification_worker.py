import time
import logging
from django.core.management.base import BaseCommand
from django.core.management import call_command

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Run a continuous notification worker that processes due intents every few seconds.'

    def add_arguments(self, parser):
        parser.add_argument('--interval', type=int, default=5, help='Polling interval in seconds (default: 5)')

    def handle(self, *args, **options):
        interval = options['interval']
        self.stdout.write(self.style.SUCCESS(f'Notification worker started (polling every {interval}s)'))

        while True:
            try:
                call_command('process_notifications')
            except Exception as exc:
                logger.error("Worker loop error: %s", exc)
                self.stderr.write(self.style.ERROR(f'Error: {exc}'))
            time.sleep(interval)

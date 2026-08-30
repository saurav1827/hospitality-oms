import os
import urllib.parse
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'replace-me-in-production')
DEBUG = os.getenv('DJANGO_DEBUG', 'false').lower() == 'true'
ALLOWED_HOSTS = os.getenv('DJANGO_ALLOWED_HOSTS', '*').split(',')

INSTALLED_APPS = ['daphne', 'django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions', 'django.contrib.staticfiles', 'corsheaders', 'channels', 'core', 'notifications', 'orders', 'venue_platform', 'billing', 'hotel', 'identity', 'reporting']
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'core.middleware.CorrelationIdMiddleware',
    'core.middleware.StructuredExceptionMiddleware',
    'core.middleware.UpdateLastSeenMiddleware',
]
ROOT_URLCONF = 'config.urls'
ASGI_APPLICATION = 'config.asgi.application'

# ── Database ─────────────────────────────────────────────────────────
# Railway provides DATABASE_URL; fall back to individual env vars for local dev
DATABASE_URL = os.getenv('DATABASE_URL')
if DATABASE_URL:
    parsed = urllib.parse.urlparse(DATABASE_URL)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': parsed.path[1:],
            'USER': parsed.username,
            'PASSWORD': parsed.password,
            'HOST': parsed.hostname,
            'PORT': parsed.port or 5432,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('POSTGRES_DB', 'restaurant'),
            'USER': os.getenv('POSTGRES_USER', 'postgres'),
            'PASSWORD': os.getenv('POSTGRES_PASSWORD', 'postgres'),
            'HOST': os.getenv('POSTGRES_HOST', '127.0.0.1'),
            'PORT': os.getenv('POSTGRES_PORT', '5432')
        }
    }

# ── Channel Layers (WebSocket) ───────────────────────────────────────
# Use Redis in production (Railway auto-injects REDIS_URL), InMemory for local dev
REDIS_URL = os.getenv('REDIS_URL')
if REDIS_URL:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                "hosts": [REDIS_URL],
            },
        }
    }
else:
    CHANNEL_LAYERS = {'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}}

# ── CORS & Cookie Settings ───────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [origin for origin in os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000').split(',') if origin]
CORS_ALLOW_CREDENTIALS = True
CSRF_COOKIE_HTTPONLY = False   # JS must be able to read it to echo it back as a header
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

# Cross-domain cookie settings: in production, frontend (Vercel) and backend (Railway)
# are on different domains, so cookies must be SameSite=None + Secure
if not DEBUG:
    CSRF_COOKIE_SAMESITE = 'None'
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = 'None'
    SESSION_COOKIE_SECURE = True
else:
    CSRF_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SAMESITE = 'Lax'

SESSION_COOKIE_AGE = 31536000  # 1 year (persists until logout)

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
USE_TZ = True
TIME_ZONE = os.getenv('TIME_ZONE', 'Asia/Kolkata')

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'core.authentication.CsrfExemptSessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
    ),
}

# Use fast MD5 hasher only in local development; production uses secure PBKDF2
if DEBUG:
    PASSWORD_HASHERS = [
        'django.contrib.auth.hashers.MD5PasswordHasher',
    ]

# Email Configuration
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('SMTP_PORT', 587))
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get('SMTP_USER')
EMAIL_HOST_PASSWORD = os.environ.get('SMTP_PASS')
DEFAULT_FROM_EMAIL = EMAIL_HOST_USER

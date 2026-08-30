import uuid
import strawberry
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from strawberry.types import Info
from venue_platform.models import PropertyMembership

MIN_USERNAME_LENGTH = 3
MAX_USERNAME_LENGTH = 150


@strawberry.type
class SessionUser:
    id: int
    username: str
    is_authenticated: bool
    property_id: str | None
    role: str | None


def get_session_user(user) -> SessionUser | None:
    if not user or not user.is_authenticated:
        return None
    membership = PropertyMembership.objects.filter(user=user, active=True).select_related('property').first()
    return SessionUser(
        id=user.id,
        username=user.get_username(),
        is_authenticated=True,
        property_id=str(membership.property_id) if membership else None,
        role=membership.role if membership else None,
    )


def _clean_username(raw: str) -> str:
    username = (raw or '').strip()
    if not username:
        raise ValueError('Username is required')
    if len(username) < MIN_USERNAME_LENGTH:
        raise ValueError(f'Username must be at least {MIN_USERNAME_LENGTH} characters')
    if len(username) > MAX_USERNAME_LENGTH:
        raise ValueError(f'Username must be under {MAX_USERNAME_LENGTH} characters')
    if not username.replace('_', '').replace('.', '').replace('-', '').isalnum():
        raise ValueError('Username can only contain letters, numbers, dots, dashes and underscores')
    return username


@strawberry.type
class IdentityQuery:
    @strawberry.field
    def session(self, info: Info) -> SessionUser | None:
        return get_session_user(info.context.request.user)


@strawberry.type
class IdentityMutation:
    @strawberry.mutation
    def login(self, info: Info, username: str, password: str) -> SessionUser:
        username = (username or '').strip()
        if not username or not password:
            raise ValueError('Username and password are required')

        user = authenticate(info.context.request, username=username, password=password)
        if user is None or not user.is_active:
            # Deliberately generic — never reveal whether the username exists
            raise ValueError('Invalid username or password')

        login(info.context.request, user)
        session_user = get_session_user(user)
        if session_user is None:
            raise ValueError('Unable to establish session')
        return session_user

    @strawberry.mutation
    def signup(self, info: Info, username: str, password: str) -> SessionUser:
        username = _clean_username(username)

        try:
            validate_password(password)
        except DjangoValidationError as exc:
            raise ValueError(' '.join(exc.messages))

        from venue_platform.models import Property, ServiceLocation

        try:
            with transaction.atomic():
                if User.objects.filter(username__iexact=username).exists():
                    raise ValueError('That username is already taken')

                user = User.objects.create_user(username=username, password=password)
                property_obj = Property.objects.create(name=f"{username}'s Venue")
                PropertyMembership.objects.create(user=user, property=property_obj, role='admin')
                ServiceLocation.objects.create(
                    property=property_obj, label='Counter', kind='counter',
                    qr_token=str(uuid.uuid4()),
                )
        except IntegrityError:
            # Race: someone else grabbed the same username between check and insert
            raise ValueError('That username is already taken')

        login(info.context.request, user)
        session_user = get_session_user(user)
        if session_user is None:
            raise ValueError('Unable to establish session after signup')
        return session_user

    @strawberry.mutation
    def logout(self, info: Info) -> bool:
        logout(info.context.request)
        return True
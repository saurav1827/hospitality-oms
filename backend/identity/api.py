import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from venue_platform.models import PropertyMembership, Property, ServiceLocation
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator

MIN_USERNAME_LENGTH = 3
MAX_USERNAME_LENGTH = 150

def get_session_data(user):
    if not user or not user.is_authenticated:
        return None
    membership = PropertyMembership.objects.filter(user=user, active=True).select_related('property').first()
    return {
        'id': user.id,
        'username': user.get_username(),
        'isAuthenticated': True,
        'propertyId': str(membership.property_id) if membership else None,
        'role': membership.role if membership else None,
    }

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


@method_decorator(ensure_csrf_cookie, name='dispatch')
class SessionView(APIView):
    def get(self, request):
        data = get_session_data(request.user)
        if not data:
            return Response({'session': None})
        return Response({'session': data})

class LoginView(APIView):
    def post(self, request):
        username = (request.data.get('username') or '').strip()
        password = request.data.get('password')
        if not username or not password:
            return Response({'error': 'Username and password are required'}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(request, username=username, password=password)
        if user is None or not user.is_active:
            return Response({'error': 'Invalid username or password'}, status=status.HTTP_400_BAD_REQUEST)

        login(request, user)
        session_data = get_session_data(user)
        if session_data is None:
            return Response({'error': 'Unable to establish session'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'session': session_data})

class SignupView(APIView):
    def post(self, request):
        raw_username = request.data.get('username', '')
        password = request.data.get('password', '')

        try:
            username = _clean_username(raw_username)
            validate_password(password)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except DjangoValidationError as exc:
            return Response({'error': ' '.join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                if User.objects.filter(username__iexact=username).exists():
                    return Response({'error': 'That username is already taken'}, status=status.HTTP_400_BAD_REQUEST)

                user = User.objects.create_user(username=username, password=password)
                property_obj = Property.objects.create(name=f"{username}'s Venue")
                PropertyMembership.objects.create(user=user, property=property_obj, role='admin')
                ServiceLocation.objects.create(
                    property=property_obj, label='Counter', kind='counter',
                    qr_token=str(uuid.uuid4()),
                )
        except IntegrityError:
            return Response({'error': 'That username is already taken'}, status=status.HTTP_400_BAD_REQUEST)

        login(request, user)
        session_data = get_session_data(user)
        if session_data is None:
            return Response({'error': 'Unable to establish session after signup'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'session': session_data})

class LogoutView(APIView):
    def post(self, request):
        if request.user.is_authenticated:
            from venue_platform.models import PropertyMembership
            PropertyMembership.objects.filter(user=request.user).update(last_seen=None)
        logout(request)
        return Response({'success': True})

class PropertyRunnersView(APIView):
    def get(self, request, property_id):
        # Fetch all active members of the property
        members = PropertyMembership.objects.filter(property_id=property_id, active=True).select_related('user')
        data = [{
            'id': m.user.id,
            'name': m.user.username,
            'role': m.role
        } for m in members]
        return Response({'runners': data})

from rest_framework.permissions import IsAuthenticated
from venue_platform.permissions import IsPropertyManagerOrAdmin

class TeamMembershipListView(APIView):
    permission_classes = [IsAuthenticated, IsPropertyManagerOrAdmin]

    def get(self, request, property_id):
        from django.utils import timezone
        members = PropertyMembership.objects.filter(property_id=property_id, active=True).select_related('user')
        now = timezone.now()
        
        data = []
        for m in members:
            is_online = False
            if m.last_seen:
                if (now - m.last_seen).total_seconds() < 300: # 5 minutes
                    is_online = True
            
            data.append({
                'id': m.user.id,
                'username': m.user.username,
                'role': m.role,
                'active': m.active,
                'isOnline': is_online
            })
        return Response({'team': data})

    def post(self, request, property_id):
        # Adding a new team member
        username = request.data.get('username', '').strip()
        role = request.data.get('role', 'waiter')
        
        if not username:
            return Response({'error': 'Username is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                user = User.objects.filter(username__iexact=username).first()
                if not user:
                    # Create the user with a default password if they don't exist
                    user = User.objects.create_user(username=username, password='welcome123')
                
                # Check if they are already in the property
                membership = PropertyMembership.objects.filter(property_id=property_id, user=user).first()
                if membership:
                    if not membership.active:
                        membership.active = True
                        membership.role = role
                        membership.save()
                    else:
                        return Response({'error': 'User is already in the team'}, status=status.HTTP_400_BAD_REQUEST)
                else:
                    membership = PropertyMembership.objects.create(
                        property_id=property_id,
                        user=user,
                        role=role,
                        active=True
                    )
                
                return Response({'member': {
                    'id': user.id,
                    'username': user.username,
                    'role': membership.role,
                    'active': membership.active
                }})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class TeamMembershipDetailView(APIView):
    permission_classes = [IsAuthenticated, IsPropertyManagerOrAdmin]

    def patch(self, request, property_id, user_id):
        role = request.data.get('role')
        if not role:
            return Response({'error': 'Role is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        membership = PropertyMembership.objects.filter(property_id=property_id, user_id=user_id).first()
        if not membership:
            return Response({'error': 'Member not found in this property'}, status=status.HTTP_404_NOT_FOUND)
            
        membership.role = role
        membership.save()
        return Response({'success': True})

    def delete(self, request, property_id, user_id):
        membership = PropertyMembership.objects.filter(property_id=property_id, user_id=user_id).first()
        if not membership:
            return Response({'error': 'Member not found in this property'}, status=status.HTTP_404_NOT_FOUND)
            
        # Prevent removing oneself if admin (could be a basic safety check, but letting it slide for simplicity)
        
        # Deactivate them
        membership.active = False
        membership.save()
        return Response({'success': True})

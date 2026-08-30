from rest_framework import permissions
from .models import PropertyMembership

class IsPropertyManagerOrAdmin(permissions.BasePermission):
    """
    Checks if the user has an active membership with the 'admin' or 'manager' role
    for the property.
    """
    message = "You do not have permission to manage this property."

    def has_permission(self, request, view):
        # We only want to restrict POST, PUT, DELETE for managers/admins.
        # GET could be allowed for staff, but let's restrict it to all active members of the property for GET,
        # and admin/manager for writes.
        # Actually, let's keep it simple: admin/manager for everything in Menu & Locations management pages.
        
        property_id = view.kwargs.get('property_id')
        if not property_id:
            return True # Let has_object_permission handle it if property_id is not in URL
        
        return self._check_membership(request.user, property_id)

    def has_object_permission(self, request, view, obj):
        # obj must have a property_id attribute
        property_id = getattr(obj, 'property_id', None)
        if not property_id:
            return False
            
        return self._check_membership(request.user, property_id)

    def _check_membership(self, user, property_id):
        if not user or not user.is_authenticated:
            return False
            
        # In this project, PropertyMembership is in identity app
        return PropertyMembership.objects.filter(
            user=user, 
            property_id=property_id, 
            role__in=['admin', 'manager']
        ).exists()

class IsPropertyStaff(permissions.BasePermission):
    """
    Checks if the user has ANY active membership role for the property.
    This allows waitstaff and chefs to access operational endpoints.
    """
    message = "You must be a staff member of this property."

    def has_permission(self, request, view):
        property_id = view.kwargs.get('property_id')
        if not property_id:
            return True
        return self._check_membership(request.user, property_id)

    def has_object_permission(self, request, view, obj):
        property_id = getattr(obj, 'property_id', None)
        if not property_id:
            return False
        return self._check_membership(request.user, property_id)

    def _check_membership(self, user, property_id):
        if not user or not user.is_authenticated:
            return False
        return PropertyMembership.objects.filter(
            user=user, 
            property_id=property_id
        ).exists()

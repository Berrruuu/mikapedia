"""
Common permission classes for the application.
"""
from rest_framework import permissions


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Permission class that allows access to users with 'owner' or 'admin' role.
    Use this instead of checking `user.role == 'admin'` directly.
    """
    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and request.user.role in ['owner', 'admin']
        )


class IsAdminRole(permissions.BasePermission):
    """
    Alias for IsOwnerOrAdmin for backward compatibility.
    Allows both owner and admin roles.
    """
    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and request.user.role in ['owner', 'admin']
        )


class IsTraderOrAbove(permissions.BasePermission):
    """
    Permission class that allows access to authenticated users with any role.
    (owner, admin, or trader)
    """
    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and request.user.role in ['owner', 'admin', 'trader']
        )


class CanManageUsers(permissions.BasePermission):
    """
    Permission for user management operations.
    Only owner and admin can manage users.
    """
    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and request.user.role in ['owner', 'admin']
        )
    
    def has_object_permission(self, request, view, obj):
        # Owner and admin can do anything
        if request.user.role in ['owner', 'admin']:
            return True
        # Traders can only view/update themselves
        return obj == request.user


def is_owner_or_admin(user) -> bool:
    """
    Helper function to check if user is owner or admin.
    Use in views, services, or anywhere you need to check permissions.
    
    Example:
        if is_owner_or_admin(request.user):
            # Allow operation
    """
    return user and user.is_authenticated and user.role in ['owner', 'admin']


def is_staff_user(user) -> bool:
    """
    Alias for is_owner_or_admin.
    """
    return is_owner_or_admin(user)

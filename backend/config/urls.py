from django.urls import path
from core.health import health

# Import all new API views
from identity.api import SessionView, LoginView, SignupView, LogoutView, PropertyRunnersView, TeamMembershipListView, TeamMembershipDetailView
from venue_platform.api import PropertyListView, PropertyDetailView, LocationListView, MenuListView, MenuItemDetailView, UploadImageView, GuestContextView, LocationPosterDownloadView
from orders.api import OrderListView, OrderDetailView, OrderReadyView, GuestOrderSubmitView, GuestPaymentVerifyView, GuestOrderTrackingView, GuestOrderPayView, GuestOrderInvoiceView
from reporting.api import RevenueSummaryView
from billing.api import ProcessPaymentView, StaffPaymentVerifyView
from hotel.api import RoomListView, DeliveryListView, DeliveryAssignView, DeliveryCompleteView
from notifications.api import NotificationListView, NotificationAcknowledgeView

urlpatterns = [
    path('health/', health),
    
    # Identity / Auth
    path('api/auth/session/', SessionView.as_view()),
    path('api/auth/login/', LoginView.as_view()),
    path('api/auth/signup/', SignupView.as_view()),
    path('api/auth/logout/', LogoutView.as_view()),
    path('api/properties/<uuid:property_id>/runners/', PropertyRunnersView.as_view()),
    path('api/properties/<uuid:property_id>/team/', TeamMembershipListView.as_view()),
    path('api/properties/<uuid:property_id>/team/<int:user_id>/', TeamMembershipDetailView.as_view()),
    
    # Venue Platform
    path('api/properties/', PropertyListView.as_view()),
    path('api/properties/<uuid:property_id>/', PropertyDetailView.as_view()),
    path('api/properties/<uuid:property_id>/locations/', LocationListView.as_view()),
    path('api/properties/<uuid:property_id>/locations/<uuid:location_id>/poster/', LocationPosterDownloadView.as_view()),
    path('api/properties/<uuid:property_id>/menu/', MenuListView.as_view()),
    path('api/menu/<uuid:pk>/', MenuItemDetailView.as_view()),
    path('api/upload/', UploadImageView.as_view()),
    
    # Orders
    path('api/properties/<uuid:property_id>/orders/', OrderListView.as_view()),
    path('api/orders/<uuid:pk>/', OrderDetailView.as_view()),
    path('api/orders/<uuid:pk>/ready/', OrderReadyView.as_view()),
    
    # Guest Public Routes
    path('api/guest/<str:qr_token>/', GuestContextView.as_view()),
    path('api/guest/<str:qr_token>/submit/', GuestOrderSubmitView.as_view()),
    path('api/guest/<str:qr_token>/verify-payment/', GuestPaymentVerifyView.as_view()),
    path('api/guest/<str:qr_token>/order/<uuid:order_id>/', GuestOrderTrackingView.as_view()),
    path('api/guest/<str:qr_token>/order/<uuid:order_id>/pay/', GuestOrderPayView.as_view()),
    path('api/guest/<str:qr_token>/order/<uuid:order_id>/invoice/', GuestOrderInvoiceView.as_view()),
    
    # Reporting & Billing
    path('api/properties/<uuid:property_id>/revenue-summary/', RevenueSummaryView.as_view()),
    path('api/orders/<uuid:pk>/pay/', ProcessPaymentView.as_view()),
    path('api/orders/<uuid:pk>/verify-payment/', StaffPaymentVerifyView.as_view()),
    
    # Hotel (Deliveries & Rooms)
    path('api/properties/<uuid:property_id>/rooms/', RoomListView.as_view()),
    path('api/properties/<uuid:property_id>/deliveries/', DeliveryListView.as_view()),
    path('api/deliveries/<uuid:pk>/assign/', DeliveryAssignView.as_view()),
    path('api/deliveries/<uuid:pk>/complete/', DeliveryCompleteView.as_view()),
    
    # Notifications
    path('api/properties/<uuid:property_id>/notifications/', NotificationListView.as_view()),
    path('api/notifications/<uuid:pk>/acknowledge/', NotificationAcknowledgeView.as_view()),
]

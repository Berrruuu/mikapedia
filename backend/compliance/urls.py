from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ComplianceViewSet, SOPWarningViewSet

router = DefaultRouter()
router.register(r'warnings', SOPWarningViewSet, basename='sop-warnings')
router.register(r'', ComplianceViewSet, basename='compliance')

urlpatterns = [path('', include(router.urls))]

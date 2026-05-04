from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import FeeStructureViewSet, PaymentViewSet

router = DefaultRouter()
router.register("fee-structures", FeeStructureViewSet, basename="fee-structures")
router.register("payments", PaymentViewSet, basename="payments")

urlpatterns = [path("", include(router.urls))]

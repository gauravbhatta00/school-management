from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import SalaryPaymentViewSet

router = DefaultRouter()
router.register("salary-payments", SalaryPaymentViewSet, basename="salary-payments")

urlpatterns = [path("", include(router.urls))]

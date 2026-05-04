from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import ExamViewSet, SubjectViewSet, ResultViewSet

router = DefaultRouter()
router.register("exams", ExamViewSet, basename="exams")
router.register("subjects", SubjectViewSet, basename="subjects")
router.register("results", ResultViewSet, basename="results")

urlpatterns = [path("", include(router.urls))]

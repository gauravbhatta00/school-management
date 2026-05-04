"""
Signals for accounts app.
User profile records are created explicitly by domain APIs.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User


@receiver(post_save, sender=User)
def create_role_profile(sender, instance, created, **kwargs):
    """
    Keep user creation side-effect free.

    Student creation requires required academic fields (class, section, roll number)
    and both student/teacher profiles are created by their dedicated endpoints.
    Auto-creating profiles here can produce invalid rows or duplicate profile errors.
    """
    return

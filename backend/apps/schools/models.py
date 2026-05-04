"""
Schools model — the root tenant entity.

Architecture Decision: Every other model has a FK to School, making it
the top-level isolation boundary. Queries are always filtered by school
via the SchoolMiddleware + get_queryset() pattern.
"""

from django.db import models


class School(models.Model):
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True)
    contact = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    logo = models.ImageField(upload_to='school_logos/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'schools_school'
        verbose_name = 'School'
        verbose_name_plural = 'Schools'

    def __str__(self):
        return self.name

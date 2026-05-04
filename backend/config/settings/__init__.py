"""
Auto-selects settings module based on DJANGO_ENV environment variable.
Defaults to development if not set.
"""
import os

env = os.environ.get('DJANGO_ENV', 'dev')

if env == 'prod':
    from .prod import *
else:
    from .dev import *

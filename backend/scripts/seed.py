"""
Demo seed script.
Run: python manage.py shell < scripts/seed.py

Creates:
  - 1 School
  - 1 Admin user
  - 3 Teachers
  - 10 Students
  - Fee structures
  - Sample exam + subjects
  - Attendance records for today
"""

import os
import django
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.utils import timezone
from apps.schools.models import School
from apps.accounts.models import User
from apps.students.models import Student
from apps.teachers.models import Teacher
from apps.attendance.models import Attendance
from apps.exams.models import Exam, Subject, Result
from apps.fees.models import FeeStructure, Payment

print("🌱 Seeding demo data...")

# ── School ──────────────────────────────────────────────────────────────────
school, _ = School.objects.get_or_create(
    name="Greenwood Public School",
    defaults={
        'address': '123 Education Lane, Knowledge City',
        'contact': '+91-9876543210',
        'email': 'admin@greenwood.edu',
    }
)
print(f"  ✅ School: {school.name}")

# ── Admin ────────────────────────────────────────────────────────────────────
admin_user, created = User.objects.get_or_create(
    email='admin@greenwood.edu',
    defaults={
        'first_name': 'School',
        'last_name': 'Admin',
        'role': User.Role.ADMIN,
        'school': school,
        'is_staff': True,
    }
)
if created:
    admin_user.set_password('Admin@123')
    admin_user.save()
print(f"  ✅ Admin: {admin_user.email} / Admin@123")

# ── Teachers ─────────────────────────────────────────────────────────────────
teacher_data = [
    ('Priya', 'Sharma', 'Mathematics'),
    ('Rajesh', 'Kumar', 'Science'),
    ('Anita', 'Singh', 'English'),
]
for fname, lname, subject in teacher_data:
    email = f"{fname.lower()}.{lname.lower()}@greenwood.edu"
    user, created = User.objects.get_or_create(
        email=email,
        defaults={
            'first_name': fname, 'last_name': lname,
            'role': User.Role.TEACHER, 'school': school,
        }
    )
    if created:
        user.set_password('Teacher@123')
        user.save()
    Teacher.objects.get_or_create(
        user=user, defaults={'school': school, 'subject': subject, 'experience_years': 5}
    )
print(f"  ✅ 3 Teachers created (password: Teacher@123)")

# ── Students ─────────────────────────────────────────────────────────────────
student_data = [
    ('Aarav', 'Patel', '10', 'A', '001'),
    ('Diya', 'Mehta', '10', 'A', '002'),
    ('Arjun', 'Gupta', '10', 'B', '001'),
    ('Kavya', 'Reddy', '10', 'B', '002'),
    ('Ishaan', 'Verma', '9', 'A', '001'),
    ('Riya', 'Joshi', '9', 'A', '002'),
    ('Vihaan', 'Shah', '9', 'B', '001'),
    ('Ananya', 'Nair', '9', 'B', '002'),
    ('Aditya', 'Mishra', '8', 'A', '001'),
    ('Pooja', 'Rao', '8', 'A', '002'),
]
students = []
for fname, lname, cls, sec, roll in student_data:
    email = f"{fname.lower()}.{lname.lower()}@student.greenwood.edu"
    user, created = User.objects.get_or_create(
        email=email,
        defaults={
            'first_name': fname, 'last_name': lname,
            'role': User.Role.STUDENT, 'school': school,
        }
    )
    if created:
        user.set_password('Student@123')
        user.save()
    student, _ = Student.objects.get_or_create(
        user=user,
        defaults={
            'school': school,
            'class_name': cls,
            'section': sec,
            'roll_number': roll,
        }
    )
    students.append(student)
print(f"  ✅ {len(students)} Students created (password: Student@123)")

# ── Fee Structures ────────────────────────────────────────────────────────────
for cls, amount in [('8', 15000), ('9', 18000), ('10', 20000)]:
    FeeStructure.objects.get_or_create(
        school=school, class_name=cls, academic_year='2024-25',
        defaults={'amount': amount, 'description': f'Annual fee for Class {cls}'}
    )
print(f"  ✅ Fee structures created")

# ── Sample Payments ───────────────────────────────────────────────────────────
import random
for student in students[:6]:
    fs = FeeStructure.objects.filter(school=school, class_name=student.class_name).first()
    if fs:
        Payment.objects.get_or_create(
            school=school, student=student, fee_structure=fs,
            defaults={
                'amount': fs.amount,
                'status': random.choice(['paid', 'pending', 'partial']),
                'payment_method': random.choice(['cash', 'online']),
                'payment_date': timezone.now().date(),
                'created_by': admin_user,
            }
        )
print(f"  ✅ Sample payments created")

# ── Exams & Subjects ──────────────────────────────────────────────────────────
midterm, _ = Exam.objects.get_or_create(
    school=school, name='Midterm 2024', academic_year='2024-25',
    defaults={'start_date': '2024-09-01', 'end_date': '2024-09-10'}
)
subjects = {}
for name, code in [('Mathematics', 'MATH'), ('Science', 'SCI'), ('English', 'ENG')]:
    subj, _ = Subject.objects.get_or_create(
        school=school, name=name, class_name='10',
        defaults={'code': code}
    )
    subjects[name] = subj

# Results for class 10 students
import decimal
for student in [s for s in students if s.class_name == '10']:
    for subj_name, subj in subjects.items():
        Result.objects.get_or_create(
            school=school, student=student, exam=midterm, subject=subj,
            defaults={
                'marks_obtained': decimal.Decimal(random.randint(55, 98)),
                'max_marks': 100,
            }
        )
print(f"  ✅ Exams, subjects & results seeded")

# ── Today's Attendance ────────────────────────────────────────────────────────
today = timezone.now().date()
for i, student in enumerate(students):
    att_status = 'present' if i % 5 != 3 else 'absent'
    Attendance.objects.get_or_create(
        school=school, student=student, date=today,
        defaults={'status': att_status, 'marked_by': admin_user}
    )
print(f"  ✅ Today's attendance marked")

print("\n🎉 Seed complete!")
print("\n📋 Login credentials:")
print("   Admin   → admin@greenwood.edu / Admin@123")
print("   Teacher → priya.sharma@greenwood.edu / Teacher@123")
print("   Student → aarav.patel@student.greenwood.edu / Student@123")

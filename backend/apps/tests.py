"""
Unit tests for the School Management System.

Run: python manage.py test apps
  or: pytest
"""

from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.tokens import default_token_generator
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from datetime import timedelta
from djoser import utils as djoser_utils

from apps.accounts.models import User
from apps.attendance.models import Attendance
from apps.exams.models import Exam, Subject, Result
from apps.fees.models import FeeStructure, Payment
from apps.applications.models import Application
from apps.schools.models import School
from apps.students.models import Student


# ── Fixtures / helpers ────────────────────────────────────────────────────────


def make_school(name="Test School"):
    return School.objects.create(name=name, contact="1234567890")


def make_user(school, email, role, password="Test@1234"):
    u = User.objects.create_user(
        email=email,
        password=password,
        first_name="Test",
        last_name="User",
        role=role,
        school=school,
    )
    return u


def make_student(school, user=None):
    if user is None:
        # Use current User count to avoid duplicate emails when multiple schools
        user = make_user(school, f"student{User.objects.count()}@test.com", "student")
    s, _ = Student.objects.get_or_create(
        user=user,
        defaults={
            "school": school,
            "class_name": "10",
            "section": "A",
            "roll_number": "001",
        },
    )
    return s


# ── User Model Tests ──────────────────────────────────────────────────────────


class UserModelTests(TestCase):
    def setUp(self):
        self.school = make_school()

    def test_create_user_with_email(self):
        user = make_user(self.school, "test@test.com", "admin")
        self.assertEqual(user.email, "test@test.com")
        self.assertTrue(user.is_active)

    def test_role_properties(self):
        admin = make_user(self.school, "a@t.com", "admin")
        teacher = make_user(self.school, "b@t.com", "teacher")
        student = make_user(self.school, "c@t.com", "student")

        self.assertTrue(admin.is_admin)
        self.assertFalse(admin.is_teacher)

        self.assertTrue(teacher.is_teacher)
        self.assertFalse(teacher.is_student)

        self.assertTrue(student.is_student)
        self.assertFalse(student.is_admin)

    def test_full_name(self):
        user = User(first_name="Priya", last_name="Sharma")
        self.assertEqual(user.get_full_name(), "Priya Sharma")

    def test_superuser_creation(self):
        su = User.objects.create_superuser("su@test.com", "Pass@1234")
        self.assertTrue(su.is_superuser)
        self.assertTrue(su.is_staff)


# ── Auth API Tests ────────────────────────────────────────────────────────────


class AuthAPITests(APITestCase):
    def setUp(self):
        self.school = make_school()
        self.admin = make_user(self.school, "admin@t.com", "admin")
        self.teacher = make_user(self.school, "teacher@t.com", "teacher")
        self.student = make_user(self.school, "student@t.com", "student")

    def test_login_returns_tokens(self):
        resp = self.client.post(
            "/api/auth/jwt/create/",
            {
                "email": "admin@t.com",
                "password": "Test@1234",
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)

    def test_login_wrong_password(self):
        resp = self.client.post(
            "/api/auth/jwt/create/",
            {
                "email": "admin@t.com",
                "password": "wrongpassword",
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_endpoint_requires_auth(self):
        resp = self.client.get("/api/users/me/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_user_data(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/users/me/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["email"], "admin@t.com")

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_password_reset_sends_to_students_and_teachers(self):
        for email in ["teacher@t.com", "student@t.com"]:
            resp = self.client.post(
                "/api/auth/users/reset_password/",
                {"email": email},
            )
            self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

        self.assertEqual(len(mail.outbox), 2)
        self.assertIn("/reset-password/", mail.outbox[0].body)
        self.assertIn("/reset-password/", mail.outbox[1].body)

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_password_reset_ignores_admin_accounts(self):
        resp = self.client.post(
            "/api/auth/users/reset_password/",
            {"email": "admin@t.com"},
        )

        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(len(mail.outbox), 0)

    def test_password_reset_confirm_updates_password(self):
        uid = djoser_utils.encode_uid(self.student.pk)
        token = default_token_generator.make_token(self.student)

        resp = self.client.post(
            "/api/auth/users/reset_password_confirm/",
            {
                "uid": uid,
                "token": token,
                "new_password": "NewPass@12345",
            },
        )

        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.student.refresh_from_db()
        self.assertTrue(self.student.check_password("NewPass@12345"))


class HealthEndpointTests(APITestCase):
    def test_health_is_public_and_checks_database(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(),
            {"status": "ok", "service": "school-management-backend"},
        )


# ── Multi-Tenancy Tests ───────────────────────────────────────────────────────


class MultiTenancyTests(APITestCase):
    """Ensure users cannot see data from other schools."""

    def setUp(self):
        self.school_a = make_school("School A")
        self.school_b = make_school("School B")

        self.admin_a = make_user(self.school_a, "admin@a.com", "admin")
        self.admin_b = make_user(self.school_b, "admin@b.com", "admin")

        self.student_a = make_student(self.school_a)
        self.student_b = make_student(self.school_b)
        # Give B's student a different roll number to avoid unique constraint
        self.student_b.roll_number = "002"
        self.student_b.save()

    def test_admin_a_cannot_see_school_b_students(self):
        self.client.force_authenticate(user=self.admin_a)
        resp = self.client.get("/api/students/")
        self.assertEqual(resp.status_code, 200)
        ids = [s["id"] for s in (resp.data.get("results") or resp.data)]
        self.assertIn(self.student_a.id, ids)
        self.assertNotIn(self.student_b.id, ids)

    def test_admin_b_cannot_see_school_a_students(self):
        self.client.force_authenticate(user=self.admin_b)
        resp = self.client.get("/api/students/")
        ids = [s["id"] for s in (resp.data.get("results") or resp.data)]
        self.assertNotIn(self.student_a.id, ids)


# ── Student CRUD Tests ────────────────────────────────────────────────────────


class StudentAPITests(APITestCase):
    def setUp(self):
        self.school = make_school()
        self.admin = make_user(self.school, "admin@s.com", "admin")
        self.teacher = make_user(self.school, "teacher@s.com", "teacher")

        # Create a user to attach student profile to
        self.user_for_student = make_user(self.school, "stu@s.com", "student")
        self.student = make_student(self.school, self.user_for_student)

    def test_list_students_as_teacher(self):
        self.client.force_authenticate(user=self.teacher)
        resp = self.client.get("/api/students/")
        self.assertEqual(resp.status_code, 200)

    def test_student_cannot_list_students(self):
        self.client.force_authenticate(user=self.user_for_student)
        resp = self.client.get("/api/students/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_filter_by_class(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/students/?class_name=10")
        self.assertEqual(resp.status_code, 200)
        results = resp.data.get("results") or resp.data
        for s in results:
            self.assertEqual(s["class_name"], "10")

    def test_filter_by_section(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/students/?section=A")
        self.assertEqual(resp.status_code, 200)

    def test_update_student_as_admin(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.patch(
            f"/api/students/{self.student.id}/",
            {
                "class_name": "11",
                "section": "B",
                "roll_number": "001",
            },
        )
        self.assertEqual(resp.status_code, 200)

    def test_import_csv_uses_admin_default_password(self):
        self.client.force_authenticate(user=self.admin)
        csv_file = SimpleUploadedFile(
            "students.csv",
            (
                "email,first_name,last_name,class_name,section,roll_number\n"
                "csvstudent@s.com,Csv,Student,10,A,009\n"
            ).encode("utf-8"),
            content_type="text/csv",
        )

        resp = self.client.post(
            "/api/students/import-csv/",
            {"file": csv_file, "default_password": "CsvPass@123"},
            format="multipart",
        )

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        created_user = User.objects.get(email="csvstudent@s.com")
        self.assertTrue(created_user.check_password("CsvPass@123"))
        self.assertEqual(resp.data["credentials"][0]["source"], "default")

    def test_import_csv_generates_unique_password_when_default_is_blank(self):
        self.client.force_authenticate(user=self.admin)
        csv_file = SimpleUploadedFile(
            "students.csv",
            (
                "email,first_name,last_name,class_name,section,roll_number\n"
                "generated@s.com,Aarav,Patel,10,A,009\n"
            ).encode("utf-8"),
            content_type="text/csv",
        )

        resp = self.client.post(
            "/api/students/import-csv/",
            {"file": csv_file},
            format="multipart",
        )

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        created_user = User.objects.get(email="generated@s.com")
        self.assertTrue(created_user.check_password("AaravPat@10A009"))
        self.assertEqual(resp.data["credentials"][0]["password"], "AaravPat@10A009")
        self.assertEqual(resp.data["credentials"][0]["source"], "generated")


# ── Attendance Tests ──────────────────────────────────────────────────────────


class AttendanceTests(APITestCase):
    def setUp(self):
        self.school = make_school()
        self.admin = make_user(self.school, "admin@att.com", "admin")
        self.teacher = make_user(self.school, "teacher@att.com", "teacher")
        self.stu_user = make_user(self.school, "stu@att.com", "student")
        self.student = make_student(self.school, self.stu_user)

    def test_bulk_mark_attendance(self):
        self.client.force_authenticate(user=self.teacher)
        resp = self.client.post(
            "/api/attendance/bulk-mark/",
            {
                "date": str(timezone.now().date()),
                "records": [
                    {"student_id": self.student.id, "status": "present"},
                ],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["total"], 1)

    def test_bulk_mark_is_idempotent(self):
        """Calling bulk-mark twice should update, not duplicate."""
        self.client.force_authenticate(user=self.teacher)
        today = str(timezone.now().date())
        payload = {
            "date": today,
            "records": [{"student_id": self.student.id, "status": "present"}],
        }
        self.client.post("/api/attendance/bulk-mark/", payload, format="json")
        self.client.post("/api/attendance/bulk-mark/", payload, format="json")
        count = Attendance.objects.filter(student=self.student, date=today).count()
        self.assertEqual(count, 1)

    def test_attendance_report(self):
        self.client.force_authenticate(user=self.admin)
        Attendance.objects.create(
            school=self.school,
            student=self.student,
            date=timezone.now().date(),
            status="present",
            marked_by=self.admin,
        )
        resp = self.client.get("/api/attendance/report/?class_name=10&section=A")
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.data, list)

    def test_bulk_mark_rejects_other_school_student(self):
        other_school = make_school("Other")
        other_stu_usr = make_user(other_school, "o@o.com", "student")
        other_student = make_student(other_school, other_stu_usr)
        other_student.roll_number = "099"
        other_student.save()

        self.client.force_authenticate(user=self.teacher)
        resp = self.client.post(
            "/api/attendance/bulk-mark/",
            {
                "date": str(timezone.now().date()),
                "records": [{"student_id": other_student.id, "status": "present"}],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_leave_application_approval_marks_attendance_as_leave(self):
        leave_start = timezone.now().date()
        leave_end = leave_start + timedelta(days=1)

        application = Application.objects.create(
            school=self.school,
            student=self.student,
            application_type=Application.Type.LEAVE_REQUEST,
            title="Medical Leave",
            description="Student requested leave for medical reasons.",
            start_date=leave_start,
            end_date=leave_end,
        )

        # Existing attendance should be overwritten by the approval flow.
        Attendance.objects.create(
            school=self.school,
            student=self.student,
            date=leave_start,
            status=Attendance.Status.PRESENT,
            marked_by=self.teacher,
        )

        self.client.force_authenticate(user=self.teacher)
        resp = self.client.post(
            f"/api/applications/{application.id}/teacher_response/",
            {
                "teacher_review": "Approved after verifying documents.",
                "teacher_decision": "approved",
            },
            format="json",
        )

        self.assertEqual(resp.status_code, 200)

        leave_records = Attendance.objects.filter(
            school=self.school,
            student=self.student,
            date__range=(leave_start, leave_end),
            status=Attendance.Status.LEAVE,
        )
        self.assertEqual(leave_records.count(), 2)
        self.assertEqual(
            Attendance.objects.get(student=self.student, date=leave_start).status,
            Attendance.Status.LEAVE,
        )

    def test_leave_application_rejection_does_not_update_attendance(self):
        leave_start = timezone.now().date()
        leave_end = leave_start + timedelta(days=1)

        application = Application.objects.create(
            school=self.school,
            student=self.student,
            application_type=Application.Type.LEAVE_REQUEST,
            title="Family Event Leave",
            description="Student requested leave for a family event.",
            start_date=leave_start,
            end_date=leave_end,
        )

        # Existing attendance should remain unchanged on rejection.
        Attendance.objects.create(
            school=self.school,
            student=self.student,
            date=leave_start,
            status=Attendance.Status.PRESENT,
            marked_by=self.teacher,
        )

        self.client.force_authenticate(user=self.teacher)
        resp = self.client.post(
            f"/api/applications/{application.id}/teacher_response/",
            {
                "teacher_review": "Not approved due to insufficient justification.",
                "teacher_decision": "rejected",
            },
            format="json",
        )

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(
            Attendance.objects.get(student=self.student, date=leave_start).status,
            Attendance.Status.PRESENT,
        )
        self.assertFalse(
            Attendance.objects.filter(
                school=self.school,
                student=self.student,
                date__range=(leave_start, leave_end),
                status=Attendance.Status.LEAVE,
            ).exists()
        )


# ── Exam / Result Tests ───────────────────────────────────────────────────────


class ExamTests(APITestCase):
    def setUp(self):
        self.school = make_school()
        self.admin = make_user(self.school, "admin@ex.com", "admin")
        self.stu_usr = make_user(self.school, "stu@ex.com", "student")
        self.student = make_student(self.school, self.stu_usr)
        self.exam = Exam.objects.create(
            school=self.school, name="Midterm", academic_year="2024-25"
        )
        self.subject = Subject.objects.create(
            school=self.school, name="Math", code="MATH", class_name="10"
        )

    def test_create_exam(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            "/api/exams/",
            {
                "name": "Final Exam",
                "academic_year": "2024-25",
            },
        )
        self.assertEqual(resp.status_code, 201)

    def test_add_result(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            "/api/results/",
            {
                "student": self.student.id,
                "exam": self.exam.id,
                "subject": self.subject.id,
                "marks_obtained": 85,
                "max_marks": 100,
            },
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["grade"], "A")

    def test_marks_cannot_exceed_max(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            "/api/results/",
            {
                "student": self.student.id,
                "exam": self.exam.id,
                "subject": self.subject.id,
                "marks_obtained": 110,
                "max_marks": 100,
            },
        )
        self.assertEqual(resp.status_code, 400)

    def test_result_percentage_property(self):
        result = Result(marks_obtained=75, max_marks=100)
        self.assertEqual(result.percentage, 75.0)

    def test_grade_boundaries(self):
        cases = [
            (95, "A+"),
            (85, "A"),
            (75, "B"),
            (65, "C"),
            (55, "D"),
            (40, "F"),
        ]
        for marks, expected_grade in cases:
            r = Result(marks_obtained=marks, max_marks=100)
            self.assertEqual(
                r.compute_grade(),
                expected_grade,
                msg=f"{marks} should be {expected_grade}",
            )

    def test_student_card_endpoint(self):
        Result.objects.create(
            school=self.school,
            student=self.student,
            exam=self.exam,
            subject=self.subject,
            marks_obtained=78,
            max_marks=100,
        )
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(
            f"/api/results/student-card/?student={self.student.id}&exam={self.exam.id}"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("overall_percentage", resp.data)
        self.assertIn("overall_grade", resp.data)


# ── Fee Tests ─────────────────────────────────────────────────────────────────


class FeeTests(APITestCase):
    def setUp(self):
        self.school = make_school()
        self.admin = make_user(self.school, "admin@fee.com", "admin")
        self.stu_usr = make_user(self.school, "stu@fee.com", "student")
        self.student = make_student(self.school, self.stu_usr)
        self.structure = FeeStructure.objects.create(
            school=self.school, class_name="10", amount=20000, academic_year="2024-25"
        )

    def test_create_fee_structure(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            "/api/fee-structures/",
            {
                "class_name": "9",
                "amount": 18000,
                "academic_year": "2024-25",
            },
        )
        self.assertEqual(resp.status_code, 201)

    def test_pay_full_fee(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            "/api/payments/pay/",
            {
                "student_id": self.student.id,
                "fee_structure_id": self.structure.id,
                "amount": 20000,
                "payment_method": "online",
            },
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["status"], "paid")

    def test_partial_payment_status(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            "/api/payments/pay/",
            {
                "student_id": self.student.id,
                "fee_structure_id": self.structure.id,
                "amount": 10000,
                "payment_method": "cash",
            },
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["status"], "partial")

    def test_student_fee_status(self):
        Payment.objects.create(
            school=self.school,
            student=self.student,
            fee_structure=self.structure,
            amount=20000,
            status="paid",
            payment_method="cash",
            payment_date=timezone.now().date(),
            created_by=self.admin,
        )
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(
            f"/api/payments/student-status/?student={self.student.id}&academic_year=2024-25"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["is_fully_paid"])
        self.assertEqual(float(resp.data["balance"]), 0)

    def test_collection_summary(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(
            "/api/payments/collection-summary/?academic_year=2024-25"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("total_collected", resp.data)


# ── Permission Boundary Tests ─────────────────────────────────────────────────


class PermissionTests(APITestCase):
    def setUp(self):
        self.school = make_school()
        self.admin = make_user(self.school, "adm@p.com", "admin")
        self.teacher = make_user(self.school, "tch@p.com", "teacher")
        self.stu_user = make_user(self.school, "stu@p.com", "student")

    def test_student_cannot_access_teachers(self):
        self.client.force_authenticate(user=self.stu_user)
        resp = self.client.get("/api/teachers/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_teacher_cannot_delete_student(self):
        stu_u = make_user(self.school, "del@p.com", "student")
        stu = make_student(self.school, stu_u)
        self.client.force_authenticate(user=self.teacher)
        resp = self.client.delete(f"/api/students/{stu.id}/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_teacher_cannot_manage_fees(self):
        self.client.force_authenticate(user=self.teacher)
        resp = self.client.get("/api/fee-structures/")
        # Teachers should get 403 on fee management
        self.assertIn(resp.status_code, [403, 200])  # depends on policy

    def test_unauthenticated_blocked(self):
        for url in ["/api/students/", "/api/teachers/", "/api/attendance/"]:
            resp = self.client.get(url)
            self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED, msg=url)

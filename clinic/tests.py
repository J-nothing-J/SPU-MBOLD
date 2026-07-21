from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from .models import AppUser, Bed, Case, Medicine, Patient
from .services import create_case_with_medicines, delete_case_and_restore_stock


class PatientModelTests(TestCase):
	def test_patient_id_sets_type_by_length(self):
		patient = Patient.objects.create(
			student_id='65123456',
			id_type=Patient.IdType.STUDENT,
			name='Somchai',
			organization='Engineering',
			gender=Patient.Gender.MALE,
		)
		self.assertEqual(patient.id_type, Patient.IdType.STUDENT)


class CaseStockServiceTests(TestCase):
	def setUp(self):
		self.nurse = AppUser.objects.create_user(
			username='nurse_case',
			password='nurse1234',
			role=AppUser.Role.NURSE,
			status=AppUser.Status.ACTIVE,
		)
		self.patient = Patient.objects.create(
			student_id='65123457',
			id_type=Patient.IdType.STUDENT,
			name='Suda',
			organization='Business',
			gender=Patient.Gender.FEMALE,
		)
		self.medicine = Medicine.objects.create(
			id='MED-TST',
			name='Test Medicine',
			category='General',
			unit='Tablet',
			stock=30,
		)

	def test_create_and_delete_case_updates_stock(self):
		case = create_case_with_medicines(
			patient=self.patient,
			nurse=self.nurse,
			symptoms='Headache',
			symptom_types=['Pain'],
			medicines_payload=[{'medicine_id': self.medicine.id, 'quantity': 6}],
			needs_ward=False,
		)

		self.medicine.refresh_from_db()
		self.assertEqual(self.medicine.stock, 24)

		delete_case_and_restore_stock(case)

		self.medicine.refresh_from_db()
		self.assertEqual(self.medicine.stock, 30)


class KioskLoginFlowTests(TestCase):
	def setUp(self):
		self.client = Client()
		self.nurse = AppUser.objects.create_user(
			username='nurse_login',
			password='nurse1234',
			role=AppUser.Role.NURSE,
			status=AppUser.Status.ACTIVE,
		)

	def test_nurse_kiosk_login_redirects_to_dashboard(self):
		response = self.client.post(reverse('nurse_login'), {'username': self.nurse.username})

		self.assertEqual(response.status_code, 302)
		self.assertEqual(response.url, reverse('dashboard'))


class NewCaseViewFlowTests(TestCase):
	def setUp(self):
		self.client = Client()
		self.nurse = AppUser.objects.create_user(
			username='nurse_new_case',
			password='nurse1234',
			role=AppUser.Role.NURSE,
			status=AppUser.Status.ACTIVE,
		)
		self.medicine = Medicine.objects.create(
			id='MED-NEW-001',
			name='Paracetamol',
			category='Pain Relief',
			unit='Tablet',
			stock=40,
		)

	def test_new_case_submission_creates_records_and_deducts_stock(self):
		self.client.force_login(self.nurse)
		payload = {
			'student_id': '65123458',
			'name': 'Mali',
			'organization': 'คณะวิศวกรรมศาสตร์',
			'gender': Patient.Gender.FEMALE,
			'occurred_at': timezone.localtime().strftime('%Y-%m-%dT%H:%M'),
			'symptom_types': 'Fever, Headache',
			'symptoms': 'High fever and fatigue',
			'needs_ward': '',
			'medicine_id': [self.medicine.id],
			'medicine_quantity': ['5'],
		}

		response = self.client.post(reverse('new_case'), payload)

		self.assertEqual(response.status_code, 302)
		self.assertEqual(response.url, reverse('cases'))
		self.assertTrue(Patient.objects.filter(student_id='65123458').exists())
		self.assertEqual(Case.objects.count(), 1)

		self.medicine.refresh_from_db()
		self.assertEqual(self.medicine.stock, 35)

	def test_employee_id_accepts_employee_department(self):
		self.client.force_login(self.nurse)
		payload = {
			'student_id': '1234567',
			'name': 'Staff One',
			'organization': 'สำนักงานบุคคล',
			'gender': Patient.Gender.MALE,
			'occurred_at': timezone.localtime().strftime('%Y-%m-%dT%H:%M'),
			'symptom_types': 'General',
			'symptoms': 'Routine check',
			'needs_ward': '',
			'medicine_id': [self.medicine.id],
			'medicine_quantity': ['2'],
		}

		response = self.client.post(reverse('new_case'), payload)

		self.assertEqual(response.status_code, 302)
		self.assertEqual(response.url, reverse('cases'))
		self.assertTrue(Patient.objects.filter(student_id='1234567').exists())

	def test_employee_id_rejects_student_organization(self):
		self.client.force_login(self.nurse)
		payload = {
			'student_id': '1234567',
			'name': 'Wrong Org',
			'organization': 'คณะวิศวกรรมศาสตร์',
			'gender': Patient.Gender.MALE,
			'occurred_at': timezone.localtime().strftime('%Y-%m-%dT%H:%M'),
			'symptom_types': 'General',
			'symptoms': 'Routine check',
			'needs_ward': '',
			'medicine_id': [self.medicine.id],
			'medicine_quantity': ['2'],
		}

		response = self.client.post(reverse('new_case'), payload)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(Case.objects.count(), 0)
		self.assertContains(response, 'หน่วยงานที่เลือกไม่ตรงกับประเภทรหัส')


class InventoryAndBedFlowTests(TestCase):
	def setUp(self):
		self.client = Client()
		self.nurse = AppUser.objects.create_user(
			username='nurse_ops',
			password='nurse1234',
			role=AppUser.Role.NURSE,
			status=AppUser.Status.ACTIVE,
		)
		self.patient = Patient.objects.create(
			student_id='65123459',
			id_type=Patient.IdType.STUDENT,
			name='Anan',
			organization='Law',
			gender=Patient.Gender.MALE,
		)

	def test_inventory_save_then_bed_assign_discharge(self):
		self.client.force_login(self.nurse)

		inv_response = self.client.post(
			reverse('inventory'),
			{
				'action': 'save_medicine',
				'edit_id': '',
				'id': 'MED-OPS-001',
				'name': 'ORS',
				'category': 'Hydration',
				'unit': 'Sachet',
				'stock': 10,
			},
		)
		self.assertEqual(inv_response.status_code, 302)
		self.assertTrue(Medicine.objects.filter(pk='MED-OPS-001').exists())

		bed_create_response = self.client.post(
			reverse('beds'),
			{
				'action': 'save_bed',
				'edit_id': '',
				'id': 'BED-TST-01',
				'room': 1,
				'number': 1,
				'gender_rule': Bed.GenderRule.MALE,
			},
		)
		self.assertEqual(bed_create_response.status_code, 302)

		assign_response = self.client.post(
			reverse('beds'),
			{
				'action': 'assign_bed',
				'bed_id': 'BED-TST-01',
				'patient_id': self.patient.student_id,
				'notes': 'Observation',
			},
		)
		self.assertEqual(assign_response.status_code, 302)

		bed = Bed.objects.get(pk='BED-TST-01')
		self.assertEqual(bed.status, Bed.Status.OCCUPIED)
		self.assertEqual(bed.patient_id, self.patient.id)

		discharge_response = self.client.post(
			reverse('beds'),
			{
				'action': 'discharge_bed',
				'bed_id': 'BED-TST-01',
			},
		)
		self.assertEqual(discharge_response.status_code, 302)

		bed.refresh_from_db()
		self.assertEqual(bed.status, Bed.Status.AVAILABLE)
		self.assertIsNone(bed.patient)


class UserManagementFlowTests(TestCase):
	def setUp(self):
		self.client = Client()
		self.admin = AppUser.objects.create_user(
			username='admin_ops',
			password='admin1234',
			role=AppUser.Role.ADMIN,
			status=AppUser.Status.ACTIVE,
			is_staff=True,
		)
		self.nurse = AppUser.objects.create_user(
			username='nurse_basic',
			password='nurse1234',
			role=AppUser.Role.NURSE,
			status=AppUser.Status.ACTIVE,
		)

	def test_admin_can_create_user_from_users_page(self):
		self.client.force_login(self.admin)
		response = self.client.post(
			reverse('user_management'),
			{
				'action': 'save_user',
				'edit_username': '',
				'username': 'new_staff',
				'first_name': 'New',
				'last_name': 'Staff',
				'role': AppUser.Role.NURSE,
				'status': AppUser.Status.ACTIVE,
				'password': 'newpass123',
			},
		)

		self.assertEqual(response.status_code, 302)
		created = AppUser.objects.get(username='new_staff')
		self.assertEqual(created.role, AppUser.Role.NURSE)
		self.assertEqual(created.status, AppUser.Status.ACTIVE)
		self.assertTrue(created.check_password('newpass123'))

	def test_non_admin_cannot_access_users_page(self):
		self.client.force_login(self.nurse)
		response = self.client.get(reverse('user_management'))
		self.assertEqual(response.status_code, 302)

	def test_admin_can_create_nurse_without_password(self):
		self.client.force_login(self.admin)
		response = self.client.post(
			reverse('user_management'),
			{
				'action': 'save_user',
				'edit_username': '',
				'username': 'nurse_no_password',
				'first_name': 'NoPass',
				'last_name': 'Nurse',
				'role': AppUser.Role.NURSE,
				'status': AppUser.Status.ACTIVE,
				'password': '',
			},
		)

		self.assertEqual(response.status_code, 302)
		created = AppUser.objects.get(username='nurse_no_password')
		self.assertEqual(created.role, AppUser.Role.NURSE)
		self.assertFalse(created.has_usable_password())

	def test_admin_create_admin_without_password_is_rejected(self):
		self.client.force_login(self.admin)
		response = self.client.post(
			reverse('user_management'),
			{
				'action': 'save_user',
				'edit_username': '',
				'username': 'admin_no_password',
				'first_name': 'NoPass',
				'last_name': 'Admin',
				'role': AppUser.Role.ADMIN,
				'status': AppUser.Status.ACTIVE,
				'password': '',
			},
		)

		self.assertEqual(response.status_code, 200)
		self.assertFalse(AppUser.objects.filter(username='admin_no_password').exists())
		self.assertContains(response, 'กรอกรหัสผ่านสำหรับผู้ใช้ Admin ใหม่')


class AccessibilityMarkupTests(TestCase):
	def setUp(self):
		self.client = Client()
		self.nurse = AppUser.objects.create_user(
			username='nurse_a11y',
			password='nurse1234',
			role=AppUser.Role.NURSE,
			status=AppUser.Status.ACTIVE,
		)
		Medicine.objects.create(
			id='MED-A11Y-001',
			name='A11Y Test Medicine',
			category='General',
			unit='Tablet',
			stock=20,
		)

	def test_login_page_contains_skip_link_and_main_target(self):
		response = self.client.get(reverse('login'))

		self.assertEqual(response.status_code, 200)
		self.assertContains(response, 'href="#main-content"')
		self.assertContains(response, 'Skip to main content')
		self.assertContains(response, 'id="main-content"')

	def test_new_case_template_uses_live_regions_and_avoids_alert_calls(self):
		self.client.force_login(self.nurse)
		response = self.client.get(reverse('new_case'))

		self.assertEqual(response.status_code, 200)
		self.assertContains(response, 'id="new-case-live-status"')
		self.assertContains(response, 'id="new-case-live-alert"')
		self.assertContains(response, 'aria-label="ค้นหาประวัติผู้ป่วย"')
		self.assertNotContains(response, 'alert(')

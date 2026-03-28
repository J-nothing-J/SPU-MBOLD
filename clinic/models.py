import uuid

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


def generate_case_id() -> str:
	timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
	suffix = uuid.uuid4().hex[:6].upper()
	return f'CASE-{timestamp}-{suffix}'


class TimeStampedModel(models.Model):
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		abstract = True


class AppUser(AbstractUser):
	class Role(models.TextChoices):
		NURSE = 'Nurse', 'Nurse'
		ADMIN = 'Admin', 'Admin'

	class Status(models.TextChoices):
		ACTIVE = 'Active', 'Active'
		INACTIVE = 'Inactive', 'Inactive'

	role = models.CharField(max_length=16, choices=Role.choices, default=Role.NURSE)
	status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)

	def __str__(self) -> str:
		return self.get_full_name() or self.username


class Patient(TimeStampedModel):
	class IdType(models.TextChoices):
		STUDENT = 'student', 'Student ID - 8 digits'
		EMPLOYEE = 'employee', 'Employee ID - 7 digits'

	class Gender(models.TextChoices):
		MALE = 'male', 'Male'
		FEMALE = 'female', 'Female'
		OTHER = 'other', 'Other'

	student_id = models.CharField(max_length=8, unique=True)
	id_type = models.CharField(max_length=16, choices=IdType.choices)
	name = models.CharField(max_length=200)
	organization = models.CharField(max_length=200)
	gender = models.CharField(max_length=16, choices=Gender.choices)

	@staticmethod
	def detect_id_type(student_id: str) -> str:
		if len(student_id) == 8:
			return Patient.IdType.STUDENT
		if len(student_id) == 7:
			return Patient.IdType.EMPLOYEE
		raise ValidationError('Patient ID must contain exactly 7 or 8 digits.')

	def clean(self) -> None:
		super().clean()
		normalized = (self.student_id or '').strip()
		if not normalized.isdigit():
			raise ValidationError({'student_id': 'Patient ID must be numeric.'})

		detected = self.detect_id_type(normalized)
		if self.id_type and self.id_type != detected:
			raise ValidationError({'id_type': 'ID type does not match entered patient ID length.'})

		self.student_id = normalized
		self.id_type = detected

	def save(self, *args, **kwargs):
		self.full_clean()
		return super().save(*args, **kwargs)

	def __str__(self) -> str:
		return f'{self.student_id} - {self.name}'


class Medicine(TimeStampedModel):
	id = models.CharField(max_length=50, primary_key=True)
	name = models.CharField(max_length=200)
	category = models.CharField(max_length=100)
	unit = models.CharField(max_length=32)
	stock = models.PositiveIntegerField(default=0)

	def __str__(self) -> str:
		return f'{self.name} ({self.stock})'


class Bed(TimeStampedModel):
	class Status(models.TextChoices):
		AVAILABLE = 'available', 'Available'
		OCCUPIED = 'occupied', 'Occupied'

	class GenderRule(models.TextChoices):
		MALE = 'male', 'Male'
		FEMALE = 'female', 'Female'
		ANY = 'any', 'Any'

	id = models.CharField(max_length=50, primary_key=True)
	number = models.PositiveIntegerField()
	room = models.PositiveIntegerField()
	gender_rule = models.CharField(max_length=16, choices=GenderRule.choices, default=GenderRule.ANY)
	status = models.CharField(max_length=16, choices=Status.choices, default=Status.AVAILABLE)
	patient = models.ForeignKey(
		Patient,
		on_delete=models.SET_NULL,
		related_name='beds',
		null=True,
		blank=True,
	)
	admission_date = models.DateTimeField(null=True, blank=True)
	notes = models.TextField(blank=True)

	class Meta:
		ordering = ['room', 'number']

	def clean(self) -> None:
		super().clean()
		if self.status == Bed.Status.OCCUPIED and not self.patient:
			raise ValidationError({'patient': 'An occupied bed must have a patient.'})
		if self.status == Bed.Status.AVAILABLE:
			self.patient = None
			self.admission_date = None

	def save(self, *args, **kwargs):
		self.full_clean()
		return super().save(*args, **kwargs)

	def __str__(self) -> str:
		return f'Room {self.room} / Bed {self.number}'


class Case(TimeStampedModel):
	class Status(models.TextChoices):
		ACTIVE = 'Active', 'Active'
		DISCHARGED = 'Discharged', 'Discharged'

	case_id = models.CharField(max_length=64, unique=True, default=generate_case_id)
	patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='cases')
	occurred_at = models.DateTimeField(default=timezone.now)
	symptoms = models.TextField()
	symptom_types = models.JSONField(default=list, blank=True)
	nurse = models.ForeignKey(
		AppUser,
		on_delete=models.SET_NULL,
		related_name='cases',
		null=True,
		blank=True,
	)
	needs_ward = models.BooleanField(default=False)
	status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)

	class Meta:
		ordering = ['-occurred_at']

	def __str__(self) -> str:
		return self.case_id


class CaseMedicine(models.Model):
	case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name='prescribed_medicines')
	medicine = models.ForeignKey(Medicine, on_delete=models.PROTECT, related_name='case_links')
	quantity = models.PositiveIntegerField()

	class Meta:
		constraints = [
			models.UniqueConstraint(fields=['case', 'medicine'], name='uniq_case_medicine_pair'),
		]

	def __str__(self) -> str:
		return f'{self.case.case_id}: {self.medicine_id} x {self.quantity}'

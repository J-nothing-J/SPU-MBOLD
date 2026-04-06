from __future__ import annotations

import datetime
from itertools import chain
from operator import attrgetter
from urllib.parse import urlencode

from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required, user_passes_test
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone

from .forms import (
	AdminLoginForm,
	BedForm,
	CaseEditForm,
	EMPLOYEE_ORGANIZATION_CHOICES,
	MedicineForm,
	NewCaseForm,
	PatientEditForm,
	STUDENT_ORGANIZATION_CHOICES,
	UserManagementForm,
)
from .models import AppUser, Bed, Case, CaseMedicine, Medicine, Patient
from .services import create_case_with_medicines, delete_case_and_restore_stock


def _serialize_organization_choices(choices):
	return [
		{
			'value': value,
			'label': label,
		}
		for value, label in choices
		if value
	]


def _redirect_with_query(url_name: str, **params):
	clean_params = {key: value for key, value in params.items() if value}
	target = reverse(url_name)
	if not clean_params:
		return redirect(target)
	return redirect(f'{target}?{urlencode(clean_params)}')


def _extract_medicine_rows(post_data):
	medicine_ids = post_data.getlist('medicine_id')
	quantities = post_data.getlist('medicine_quantity')
	row_count = max(len(medicine_ids), len(quantities))

	rows = []
	for idx in range(row_count):
		medicine_id = (medicine_ids[idx] if idx < len(medicine_ids) else '').strip()
		quantity = (quantities[idx] if idx < len(quantities) else '').strip()
		if not medicine_id and not quantity:
			continue
		rows.append({'medicine_id': medicine_id, 'quantity': quantity})

	return rows


def _build_medicine_payload(rows):
	payload = []
	for index, row in enumerate(rows, start=1):
		medicine_id = row.get('medicine_id', '').strip()
		quantity_raw = row.get('quantity', '').strip()

		if not medicine_id:
			raise ValidationError(f'กรอกข้อมูลยาแถวที่ {index} ไม่ครบถ้วน')
		if not quantity_raw.isdigit() or int(quantity_raw) < 1:
			raise ValidationError(f'จำนวนยาของแถวที่ {index} ไม่ถูกต้อง')

		payload.append({'medicine_id': medicine_id, 'quantity': int(quantity_raw)})

	return payload


def root_redirect(request):
	if request.user.is_authenticated:
		return redirect('dashboard')
	return redirect('login')


def login_view(request):
	if request.user.is_authenticated:
		return redirect('dashboard')

	nurses = AppUser.objects.filter(
		role=AppUser.Role.NURSE,
		status=AppUser.Status.ACTIVE,
		is_active=True,
	).order_by('username')
	return render(
		request,
		'clinic/login.html',
		{
			'nurses': nurses,
			'admin_form': AdminLoginForm(),
		},
	)


def nurse_login_view(request):
	if request.method != 'POST':
		return redirect('login')

	username = (request.POST.get('username') or '').strip()
	nurse = AppUser.objects.filter(
		username=username,
		role=AppUser.Role.NURSE,
		status=AppUser.Status.ACTIVE,
		is_active=True,
	).first()

	if nurse is None:
		messages.error(request, 'ไม่พบผู้ใช้พยาบาลที่ใช้งานได้')
		return redirect('login')

	login(request, nurse, backend='django.contrib.auth.backends.ModelBackend')
	return redirect('dashboard')


def admin_login_view(request):
	if request.method != 'POST':
		return redirect('login')

	form = AdminLoginForm(request.POST)
	if not form.is_valid():
		messages.error(request, 'กรอกข้อมูลผู้ดูแลให้ครบถ้วน')
		return redirect('login')

	username = form.cleaned_data['username']
	password = form.cleaned_data['password']
	user = authenticate(request, username=username, password=password)

	if user is None:
		messages.error(request, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
		return redirect('login')

	if user.role != AppUser.Role.ADMIN or user.status != AppUser.Status.ACTIVE:
		messages.error(request, 'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ')
		return redirect('login')

	login(request, user)
	return redirect('dashboard')


@login_required
def logout_view(request):
	logout(request)
	return redirect('login')


@login_required
def dashboard_view(request):
	today = timezone.localdate()
	active_beds = (
		Bed.objects.filter(status=Bed.Status.OCCUPIED)
		.select_related('patient')
		.order_by('-admission_date', 'id')
	)
	occupied_beds = active_beds.count()
	total_beds = Bed.objects.count()

	context = {
		'total_patients': Patient.objects.count(),
		'occupied_beds': occupied_beds,
		'total_beds': total_beds,
		'total_medicines': Medicine.objects.count(),
		'low_stock_count': Medicine.objects.filter(stock__lte=10).count(),
		'today_cases': Case.objects.filter(occurred_at__date=today).count(),
		'active_beds': active_beds,
		'recent_cases': Case.objects.select_related('patient', 'nurse').order_by('-occurred_at')[:10],
		'low_stock_medicines': Medicine.objects.filter(stock__lte=10).order_by('stock', 'name')[:10],
	}
	return render(request, 'clinic/dashboard.html', context)


@login_required
def new_case_view(request):
	medicine_catalog = Medicine.objects.order_by('name')
	draft_rows = [{'medicine_id': '', 'quantity': '1'}]

	if request.method == 'POST':
		form = NewCaseForm(request.POST)
		draft_rows = _extract_medicine_rows(request.POST)
		if not draft_rows:
			draft_rows = [{'medicine_id': '', 'quantity': '1'}]

		if form.is_valid():
			try:
				medicines_payload = _build_medicine_payload(draft_rows)

				student_id = form.cleaned_data['student_id']
				patient_defaults = {
					'id_type': Patient.detect_id_type(student_id),
					'name': form.cleaned_data['name'],
					'organization': form.cleaned_data['organization'],
					'gender': form.cleaned_data['gender'],
				}
				patient, _ = Patient.objects.update_or_create(
					student_id=student_id,
					defaults=patient_defaults,
				)

				create_case_with_medicines(
					patient=patient,
					nurse=request.user,
					symptoms=form.cleaned_data['symptoms'],
					symptom_types=form.cleaned_data['symptom_types'],
					medicines_payload=medicines_payload,
					occurred_at=form.cleaned_data['occurred_at'],
					needs_ward=form.cleaned_data['needs_ward'],
				)
			except ValidationError as exc:
				form.add_error(None, str(exc))
			else:
				messages.success(request, 'บันทึกเคสใหม่เรียบร้อยแล้ว')
				return redirect('cases')
	else:
		form = NewCaseForm()

	context = {
		'form': form,
		'medicine_catalog': medicine_catalog,
		'draft_medicine_rows': draft_rows,
		'student_organization_options': _serialize_organization_choices(STUDENT_ORGANIZATION_CHOICES),
		'employee_organization_options': _serialize_organization_choices(EMPLOYEE_ORGANIZATION_CHOICES),
	}
	return render(request, 'clinic/new_case.html', context)


@login_required
def cases_view(request):
	selected_date = (request.GET.get('date') or '').strip()

	if request.method == 'POST':
		action = (request.POST.get('action') or '').strip()
		case_id = (request.POST.get('case_id') or '').strip()
		post_date = (request.POST.get('date') or '').strip()
		case_obj = get_object_or_404(Case, case_id=case_id)

		if action == 'delete_case':
			delete_case_and_restore_stock(case_obj)
			messages.success(request, f'ลบเคส {case_id} เรียบร้อยแล้ว')
		elif action == 'discharge_case':
			case_obj.status = Case.Status.DISCHARGED
			case_obj.save(update_fields=['status', 'updated_at'])
			Bed.objects.filter(patient=case_obj.patient, status=Bed.Status.OCCUPIED).update(
				status=Bed.Status.AVAILABLE,
				patient=None,
				admission_date=None,
				notes='',
			)
			messages.success(request, f'จำหน่ายผู้ป่วยของเคส {case_id} แล้ว')
		else:
			messages.error(request, 'ไม่รองรับคำสั่งที่ส่งมา')

		return _redirect_with_query('cases', date=post_date)

	case_qs = Case.objects.select_related('patient', 'nurse').prefetch_related(
		Prefetch('prescribed_medicines', queryset=CaseMedicine.objects.select_related('medicine')),
	)

	if selected_date:
		try:
			date_obj = datetime.date.fromisoformat(selected_date)
			case_qs = case_qs.filter(occurred_at__date=date_obj)
		except ValueError:
			messages.error(request, 'รูปแบบวันที่ไม่ถูกต้อง')
			selected_date = ''

	context = {
		'cases': case_qs,
		'selected_date': selected_date,
	}
	return render(request, 'clinic/cases.html', context)


@login_required
def case_edit_view(request, case_id):
	case_obj = get_object_or_404(
		Case.objects.select_related('patient', 'nurse').prefetch_related('prescribed_medicines__medicine'),
		case_id=case_id,
	)

	if request.method == 'POST':
		form = CaseEditForm(request.POST, instance=case_obj)
		if form.is_valid():
			form.save()
			messages.success(request, f'อัปเดตข้อมูลเคส {case_obj.case_id} แล้ว')
			return redirect('cases')
	else:
		form = CaseEditForm(instance=case_obj)

	context = {
		'form': form,
		'case_obj': case_obj,
		'medicine_links': case_obj.prescribed_medicines.select_related('medicine').all(),
	}
	return render(request, 'clinic/case_edit.html', context)


@login_required
def patients_view(request):
	search_term = (request.GET.get('q') or '').strip()
	patient_qs = Patient.objects.annotate(case_count=Count('cases')).order_by('-updated_at')

	if search_term:
		patient_qs = patient_qs.filter(
			Q(student_id__icontains=search_term)
			| Q(name__icontains=search_term)
			| Q(organization__icontains=search_term),
		)

	context = {
		'patients': patient_qs,
		'search_term': search_term,
	}
	return render(request, 'clinic/patients.html', context)


@login_required
def patient_edit_view(request, student_id):
	patient = get_object_or_404(Patient, student_id=student_id)

	if request.method == 'POST':
		form = PatientEditForm(request.POST, instance=patient)
		if form.is_valid():
			updated = form.save()
			messages.success(request, f'อัปเดตข้อมูลผู้ป่วย {updated.student_id} แล้ว')
			return redirect('patients')
	else:
		form = PatientEditForm(instance=patient)

	return render(
		request,
		'clinic/patient_edit.html',
		{
			'form': form,
			'patient': patient,
			'student_organization_options': _serialize_organization_choices(STUDENT_ORGANIZATION_CHOICES),
			'employee_organization_options': _serialize_organization_choices(EMPLOYEE_ORGANIZATION_CHOICES),
		},
	)


@login_required
def inventory_view(request):
	medicine_form = MedicineForm()
	edit_medicine = None

	if request.method == 'POST':
		action = (request.POST.get('action') or '').strip()

		if action == 'save_medicine':
			edit_id = (request.POST.get('edit_id') or '').strip()
			edit_medicine = Medicine.objects.filter(pk=edit_id).first() if edit_id else None
			medicine_form = MedicineForm(request.POST, instance=edit_medicine)
			if medicine_form.is_valid():
				if edit_medicine and medicine_form.cleaned_data['id'] != edit_medicine.id:
					medicine_form.add_error('id', 'ไม่สามารถเปลี่ยนรหัสยาเดิมได้')
				else:
					medicine_form.save()
					messages.success(request, 'บันทึกข้อมูลยาเรียบร้อยแล้ว')
					return redirect('inventory')

		elif action == 'delete_medicine':
			medicine_id = (request.POST.get('medicine_id') or '').strip()
			medicine = Medicine.objects.filter(pk=medicine_id).first()
			if medicine is None:
				messages.error(request, 'ไม่พบรายการยาที่ต้องการลบ')
			else:
				medicine.delete()
				messages.success(request, f'ลบยา {medicine_id} แล้ว')
			return redirect('inventory')

	else:
		edit_id = (request.GET.get('edit') or '').strip()
		if edit_id:
			edit_medicine = Medicine.objects.filter(pk=edit_id).first()
			if edit_medicine:
				medicine_form = MedicineForm(instance=edit_medicine)
			else:
				messages.error(request, 'ไม่พบรายการยาที่ต้องการแก้ไข')

	context = {
		'medicine_form': medicine_form,
		'edit_medicine': edit_medicine,
		'medicines': Medicine.objects.order_by('category', 'name'),
	}
	return render(request, 'clinic/inventory.html', context)


@login_required
def beds_view(request):
	def split_beds_for_layout(bed_list):
		midpoint = (len(bed_list) + 1) // 2
		return {
			'top': bed_list[:midpoint],
			'bottom': bed_list[midpoint:],
		}

	bed_form = BedForm()
	edit_bed = None
	is_admin = _is_active_admin(request.user)

	if request.method == 'POST':
		action = (request.POST.get('action') or '').strip()

		if action == 'save_bed':
			if not is_admin:
				messages.error(request, 'เฉพาะผู้ดูแลระบบเท่านั้นที่เพิ่มหรือแก้ไขเตียงได้')
				return redirect('beds')

			edit_id = (request.POST.get('edit_id') or '').strip()
			edit_bed = Bed.objects.filter(pk=edit_id).first() if edit_id else None
			bed_form = BedForm(request.POST, instance=edit_bed)

			if bed_form.is_valid():
				if edit_bed and bed_form.cleaned_data['id'] != edit_bed.id:
					bed_form.add_error('id', 'ไม่สามารถเปลี่ยนรหัสเตียงเดิมได้')
				else:
					bed_obj = bed_form.save(commit=False)
					if edit_bed:
						bed_obj.status = edit_bed.status
						bed_obj.patient = edit_bed.patient
						bed_obj.admission_date = edit_bed.admission_date
						bed_obj.notes = edit_bed.notes
					else:
						bed_obj.status = Bed.Status.AVAILABLE
					bed_obj.save()
					messages.success(request, 'บันทึกข้อมูลเตียงเรียบร้อยแล้ว')
					return redirect('beds')

		elif action == 'assign_bed':
			bed_id = (request.POST.get('bed_id') or '').strip()
			patient_id = (request.POST.get('patient_id') or '').strip()
			notes = (request.POST.get('notes') or '').strip()

			bed_obj = get_object_or_404(Bed, pk=bed_id)
			patient = get_object_or_404(Patient, student_id=patient_id)

			if bed_obj.status != Bed.Status.AVAILABLE:
				messages.error(request, 'เตียงนี้ไม่ว่างสำหรับจัดผู้ป่วยใหม่')
			elif bed_obj.gender_rule != Bed.GenderRule.ANY and patient.gender != bed_obj.gender_rule:
				messages.error(request, 'เพศของผู้ป่วยไม่ตรงกับข้อกำหนดของเตียง')
			else:
				bed_obj.status = Bed.Status.OCCUPIED
				bed_obj.patient = patient
				bed_obj.admission_date = timezone.now()
				bed_obj.notes = notes
				bed_obj.save()
				messages.success(request, f'จัดเตียง {bed_obj.id} ให้ผู้ป่วย {patient.student_id} แล้ว')
			return redirect('beds')

		elif action == 'discharge_bed':
			bed_id = (request.POST.get('bed_id') or '').strip()
			bed_obj = get_object_or_404(Bed, pk=bed_id)
			bed_obj.status = Bed.Status.AVAILABLE
			bed_obj.patient = None
			bed_obj.admission_date = None
			bed_obj.notes = ''
			bed_obj.save()
			messages.success(request, f'ปลดการใช้งานเตียง {bed_obj.id} แล้ว')
			return redirect('beds')

		elif action == 'delete_bed':
			if not is_admin:
				messages.error(request, 'เฉพาะผู้ดูแลระบบเท่านั้นที่ลบเตียงได้')
				return redirect('beds')

			bed_id = (request.POST.get('bed_id') or '').strip()
			bed_obj = get_object_or_404(Bed, pk=bed_id)
			if bed_obj.status == Bed.Status.OCCUPIED:
				messages.error(request, 'ไม่สามารถลบเตียงที่ยังมีผู้ป่วยได้')
			else:
				bed_obj.delete()
				messages.success(request, f'ลบเตียง {bed_id} แล้ว')
			return redirect('beds')

	else:
		edit_id = (request.GET.get('edit') or '').strip()
		if edit_id:
			if not is_admin:
				messages.error(request, 'เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขข้อมูลเตียงได้')
				return redirect('beds')

			edit_bed = Bed.objects.filter(pk=edit_id).first()
			if edit_bed:
				bed_form = BedForm(instance=edit_bed)
			else:
				messages.error(request, 'ไม่พบเตียงที่ต้องการแก้ไข')

	beds = list(Bed.objects.select_related('patient').order_by('room', 'number'))
	male_beds = [bed for bed in beds if bed.gender_rule == Bed.GenderRule.MALE]
	female_beds = [bed for bed in beds if bed.gender_rule == Bed.GenderRule.FEMALE]
	unisex_beds = [bed for bed in beds if bed.gender_rule == Bed.GenderRule.ANY]

	context = {
		'bed_form': bed_form,
		'edit_bed': edit_bed,
		'beds': beds,
		'male_ward': split_beds_for_layout(male_beds),
		'female_ward': split_beds_for_layout(female_beds),
		'unisex_beds': unisex_beds,
		'male_bed_count': len(male_beds),
		'female_bed_count': len(female_beds),
		'unisex_bed_count': len(unisex_beds),
		'male_occupied_count': sum(1 for bed in male_beds if bed.status == Bed.Status.OCCUPIED),
		'female_occupied_count': sum(1 for bed in female_beds if bed.status == Bed.Status.OCCUPIED),
		'unisex_occupied_count': sum(1 for bed in unisex_beds if bed.status == Bed.Status.OCCUPIED),
		'is_admin': is_admin,
		'patients': Patient.objects.order_by('student_id'),
	}
	return render(request, 'clinic/beds.html', context)


def _is_active_admin(user):
	return bool(
		user.is_authenticated
		and user.role == AppUser.Role.ADMIN
		and user.status == AppUser.Status.ACTIVE
		and user.is_active
	)


@user_passes_test(_is_active_admin)
def user_management_view(request):
	user_form = UserManagementForm()
	edit_user = None

	if request.method == 'POST':
		action = (request.POST.get('action') or '').strip()

		if action == 'save_user':
			edit_username = (request.POST.get('edit_username') or '').strip()
			edit_user = AppUser.objects.filter(username=edit_username).first() if edit_username else None
			user_form = UserManagementForm(request.POST, instance=edit_user)

			if user_form.is_valid():
				candidate = user_form.save(commit=False)

				if request.user == edit_user and (
					candidate.role != AppUser.Role.ADMIN
					or candidate.status != AppUser.Status.ACTIVE
				):
					user_form.add_error(None, 'ไม่สามารถปรับสิทธิ์หรือปิดสถานะบัญชีของตัวเองได้')
				else:
					candidate.save()
					messages.success(request, 'บันทึกข้อมูลผู้ใช้เรียบร้อยแล้ว')
					return redirect('user_management')

		elif action == 'delete_user':
			username = (request.POST.get('username') or '').strip()
			user_obj = get_object_or_404(AppUser, username=username)

			if user_obj == request.user:
				messages.error(request, 'ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้')
			elif user_obj.is_superuser:
				messages.error(request, 'ไม่อนุญาตให้ลบบัญชี Superuser')
			else:
				user_obj.delete()
				messages.success(request, f'ลบผู้ใช้ {username} แล้ว')
			return redirect('user_management')

		else:
			messages.error(request, 'คำสั่งที่ส่งมาไม่ถูกต้อง')
			return redirect('user_management')

	else:
		edit_username = (request.GET.get('edit') or '').strip()
		if edit_username:
			edit_user = AppUser.objects.filter(username=edit_username).first()
			if edit_user:
				user_form = UserManagementForm(instance=edit_user)
			else:
				messages.error(request, 'ไม่พบผู้ใช้ที่ต้องการแก้ไข')

	context = {
		'user_form': user_form,
		'edit_user': edit_user,
		'users': AppUser.objects.order_by('role', 'username'),
	}
	return render(request, 'clinic/users.html', context)

@login_required
def api_get_patient(request, student_id):
	try:
		patient = Patient.objects.get(student_id=student_id)
		data = {
			'name': patient.name,
			'organization': patient.organization,
			'gender': patient.gender,
		}
		return JsonResponse(data)
	except Patient.DoesNotExist:
		return JsonResponse({'error': 'Patient not found'}, status=404)
@user_passes_test(_is_active_admin)
def audit_logs_view(request):
	limit = 100
	action_map = {'+': 'เพิ่มข้อมูล', '~': 'แก้ไขข้อมูล', '-': 'ลบข้อมูล'}

	def _prepare(qs, model_verbose):
		logs = list(qs)
		for log in logs:
			log.model_name = model_verbose
			log.action_label = action_map.get(log.history_type, log.history_type)
			log.target_display = str(log.instance) if hasattr(log, 'instance') and log.instance else f"{model_verbose} #{log.id if hasattr(log,'id') else ''}"
		return logs

	cases = _prepare(Case.history.select_related('history_user').all()[:limit], 'เคส (Case)')
	patients = _prepare(Patient.history.select_related('history_user').all()[:limit], 'ผู้ป่วย (Patient)')
	medicines = _prepare(Medicine.history.select_related('history_user').all()[:limit], 'ยา (Medicine)')
	beds = _prepare(Bed.history.select_related('history_user').all()[:limit], 'เตียง (Bed)')
	users = _prepare(AppUser.history.select_related('history_user').all()[:limit], 'ผู้ใช้ (User)')

	all_logs = sorted(
		chain(cases, patients, medicines, beds, users),
		key=attrgetter('history_date'),
		reverse=True
	)[:limit]

	return render(request, 'clinic/audit_logs.html', {'logs': all_logs})
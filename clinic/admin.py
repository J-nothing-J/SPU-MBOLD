from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import AppUser, Bed, Case, CaseMedicine, Medicine, Patient


@admin.register(AppUser)
class AppUserAdmin(UserAdmin):
	list_display = ('username', 'email', 'role', 'status', 'is_active', 'is_staff')
	list_filter = ('role', 'status', 'is_active', 'is_staff')
	fieldsets = UserAdmin.fieldsets + (
		('Clinic Access', {'fields': ('role', 'status')}),
	)


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
	list_display = ('student_id', 'name', 'id_type', 'organization', 'gender', 'updated_at')
	search_fields = ('student_id', 'name', 'organization')
	list_filter = ('id_type', 'gender')


@admin.register(Medicine)
class MedicineAdmin(admin.ModelAdmin):
	list_display = ('id', 'name', 'category', 'unit', 'stock', 'updated_at')
	search_fields = ('id', 'name', 'category')
	list_filter = ('category',)


@admin.register(Bed)
class BedAdmin(admin.ModelAdmin):
	list_display = ('id', 'room', 'number', 'gender_rule', 'status', 'patient')
	list_filter = ('room', 'gender_rule', 'status')
	search_fields = ('id', 'patient__student_id', 'patient__name')


@admin.register(Case)
class CaseAdmin(admin.ModelAdmin):
	list_display = ('case_id', 'patient', 'nurse', 'occurred_at', 'needs_ward', 'status')
	search_fields = ('case_id', 'patient__student_id', 'patient__name')
	list_filter = ('status', 'needs_ward')


@admin.register(CaseMedicine)
class CaseMedicineAdmin(admin.ModelAdmin):
	list_display = ('case', 'medicine', 'quantity')
	search_fields = ('case__case_id', 'medicine__name', 'medicine__id')

from django import forms
from django.utils import timezone

from .models import AppUser, Bed, Case, Medicine, Patient


STUDENT_ORGANIZATION_CHOICES = [
    ('', 'เลือกคณะ'),
    ('คณะดิจิทัลมีเดีย', 'คณะดิจิทัลมีเดีย'),
    ('คณะนิเทศศาสตร์', 'คณะนิเทศศาสตร์'),
    ('คณะวิศวกรรมศาสตร์', 'คณะวิศวกรรมศาสตร์'),
    ('คณะบริหารธุรกิจ', 'คณะบริหารธุรกิจ'),
    ('คณะศิลปศาสตร์', 'คณะศิลปศาสตร์'),
    ('วิทยาลัยโลจิสติกส์และซัพพลายเชน', 'วิทยาลัยโลจิสติกส์และซัพพลายเชน'),
    ('วทบ. วิทยาลัยการบิน การท่องเที่ยวและการบริการ', 'วทบ. วิทยาลัยการบิน การท่องเที่ยวและการบริการ'),
    ('คณะบัญชี', 'คณะบัญชี'),
    ('คณะเทคโนโลยีสารสนเทศ', 'คณะเทคโนโลยีสารสนเทศ'),
    ('คณะนิติศาสตร์', 'คณะนิติศาสตร์'),
    ('คณะการออกแบบและสถาปัตยกรรมศาสตร์', 'คณะการออกแบบและสถาปัตยกรรมศาสตร์'),
    ('คณะการสร้างเจ้าของธุรกิจ', 'คณะการสร้างเจ้าของธุรกิจ'),
    ('International College', 'International College'),
    ('วิทยาลัยบัณฑิต', 'วิทยาลัยบัณฑิต'),
    ('Other', 'อื่นๆ'),
]

EMPLOYEE_ORGANIZATION_CHOICES = [
    ('', 'เลือกหน่วยงาน'),
    ('สำนักงานอธิการบดี', 'สำนักงานอธิการบดี'),
    ('สำนักงานประกันคุณภาพ', 'สำนักงานประกันคุณภาพ'),
    ('สำนักงานบุคคล', 'สำนักงานบุคคล'),
    ('สำนักงานกฎหมาย', 'สำนักงานกฎหมาย'),
    ('สำนักงานสภามหาวิทยาลัย', 'สำนักงานสภามหาวิทยาลัย'),
    ('สำนักงานผู้ตรวจสอบ', 'สำนักงานผู้ตรวจสอบ'),
    ('สำนักงานวิเทศสัมพันธ์', 'สำนักงานวิเทศสัมพันธ์'),
    ('ศูนย์สหกิจศึกษาและพัฒนาอาชีพ', 'ศูนย์สหกิจศึกษาและพัฒนาอาชีพ'),
    ('ศูนย์ส่งเสริมการวิจัยและการประกันคุณภาพการศึกษา', 'ศูนย์ส่งเสริมการวิจัยและการประกันคุณภาพการศึกษา'),
    ('สำนักหอสมุด', 'สำนักหอสมุด'),
    ('สำนักงานวิชาการ', 'สำนักงานวิชาการ'),
    ('สำนักงานทะเบียน', 'สำนักงานทะเบียน'),
    ('สำนักการจัดการศึกษาออนไลน์', 'สำนักการจัดการศึกษาออนไลน์'),
    ('ศูนย์สนับสนุนและพัฒนาการเรียนการสอน', 'ศูนย์สนับสนุนและพัฒนาการเรียนการสอน'),
    ('ศูนย์กิจกรรมพัฒนานักศึกษาและชุมชนสัมพันธ์', 'ศูนย์กิจกรรมพัฒนานักศึกษาและชุมชนสัมพันธ์'),
    ('ศูนย์ให้คำปรึกษาสุขภาวะ', 'ศูนย์ให้คำปรึกษาสุขภาวะ'),
    ('ศูนย์ศิลปวัฒนธรรม', 'ศูนย์ศิลปวัฒนธรรม'),
    ('สำนักงานการกีฬา', 'สำนักงานการกีฬา'),
    ('สำนักงานการคลัง', 'สำนักงานการคลัง'),
    ('สำนักงานพัสดุ', 'สำนักงานพัสดุ'),
    ('ศูนย์หนังสือ', 'ศูนย์หนังสือ'),
    ('สำนักวิชาศึกษาทั่วไป', 'สำนักวิชาศึกษาทั่วไป'),
    ('USR SPU', 'USR SPU'),
    ('สำนักงานรับสมัคร', 'สำนักงานรับสมัคร'),
    ('สำนักงานทุนการศึกษา', 'สำนักงานทุนการศึกษา'),
    ('สำนักงานประชาสัมพันธ์', 'สำนักงานประชาสัมพันธ์'),
    ('ศูนย์ศิษย์เก่าสัมพันธ์', 'ศูนย์ศิษย์เก่าสัมพันธ์'),
    ('งานกราฟิกและศิลปกรรม', 'งานกราฟิกและศิลปกรรม'),
    ('ศูนย์บ่มเพาะธุรกิจ', 'ศูนย์บ่มเพาะธุรกิจ'),
    ('ศูนย์วิทยบริการ', 'ศูนย์วิทยบริการ'),
    ('ศูนย์การศึกษาต่อเนื่องนานาชาติ', 'ศูนย์การศึกษาต่อเนื่องนานาชาติ'),
    ('สำนักงานอาคารและสถานที่', 'สำนักงานอาคารและสถานที่'),
    ('ศูนย์เทคโนโลยีสารสนเทศและการสื่อสาร', 'ศูนย์เทคโนโลยีสารสนเทศและการสื่อสาร'),
    ('ศูนย์มีเดีย', 'ศูนย์มีเดีย'),
    ('โรงพิมพ์', 'โรงพิมพ์'),
    ('มูลนิธิมหาวิทยาลัยศรีปทุม', 'มูลนิธิมหาวิทยาลัยศรีปทุม'),
    ('Other', 'อื่นๆ'),
]


def detect_id_type_from_value(value: str | None) -> str | None:
    normalized = ''.join(ch for ch in str(value or '') if ch.isdigit())
    if len(normalized) == 8:
        return Patient.IdType.STUDENT
    if len(normalized) == 7:
        return Patient.IdType.EMPLOYEE
    return None


def organization_choices_for_id_type(id_type: str | None):
    if id_type == Patient.IdType.EMPLOYEE:
        return EMPLOYEE_ORGANIZATION_CHOICES
    return STUDENT_ORGANIZATION_CHOICES


def append_choice_if_missing(choices, value: str | None, label_suffix: str = ''):
    normalized = (value or '').strip()
    if not normalized:
        return list(choices)

    choice_list = list(choices)
    existing_values = {choice_value for choice_value, _choice_label in choice_list}
    if normalized in existing_values:
        return choice_list

    display_label = normalized + label_suffix
    choice_list.append((normalized, display_label))
    return choice_list


class AdminLoginForm(forms.Form):
    username = forms.CharField(max_length=150)
    password = forms.CharField(widget=forms.PasswordInput)


class NurseKioskLoginForm(forms.Form):
    username = forms.CharField(max_length=150)


class NewCaseForm(forms.Form):
    student_id = forms.CharField(
        max_length=8,
        min_length=7,
        label='รหัสนักศึกษา / บุคลากร',
        widget=forms.TextInput(
            attrs={
                'inputmode': 'numeric',
                'maxlength': '8',
                'pattern': '[0-9]{7,8}',
                'autocomplete': 'off',
            }
        ),
    )
    name = forms.CharField(max_length=200, label='ชื่อผู้ป่วย')
    organization = forms.ChoiceField(choices=STUDENT_ORGANIZATION_CHOICES, label='คณะ/หน่วยงาน')
    gender = forms.ChoiceField(choices=Patient.Gender.choices, label='เพศ')
    occurred_at = forms.DateTimeField(
        label='วันเวลาเข้ารับบริการ',
        input_formats=['%Y-%m-%dT%H:%M'],
        widget=forms.DateTimeInput(attrs={'type': 'datetime-local'}),
    )
    symptom_types = forms.CharField(
        required=False,
        label='ประเภทอาการ',
        help_text='คั่นหลายค่าโดยใช้เครื่องหมายจุลภาค (,)',
    )
    symptoms = forms.CharField(widget=forms.Textarea(attrs={'rows': 3}), label='อาการ')
    needs_ward = forms.BooleanField(required=False, label='ต้องการนอนพักในหอผู้ป่วย')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        id_value = self.data.get('student_id') if self.is_bound else self.initial.get('student_id')
        id_type = detect_id_type_from_value(id_value)
        org_choices = organization_choices_for_id_type(id_type)
        if self.is_bound:
            org_choices = append_choice_if_missing(org_choices, self.data.get('organization'))
        self.fields['organization'].choices = org_choices

        if not self.is_bound:
            now_local = timezone.localtime().replace(second=0, microsecond=0)
            self.initial['occurred_at'] = now_local.strftime('%Y-%m-%dT%H:%M')

    def clean_student_id(self):
        student_id = (self.cleaned_data['student_id'] or '').strip()
        if not student_id.isdigit() or len(student_id) not in (7, 8):
            raise forms.ValidationError('รหัสนักศึกษา / บุคลากรต้องเป็นตัวเลข 7 หรือ 8 หลัก')
        return student_id

    def clean(self):
        cleaned_data = super().clean()
        student_id = cleaned_data.get('student_id')
        organization = cleaned_data.get('organization')
        id_type = detect_id_type_from_value(student_id)

        valid_values = {value for value, _label in organization_choices_for_id_type(id_type) if value}
        if organization and organization not in valid_values:
            self.add_error('organization', 'หน่วยงานที่เลือกไม่ตรงกับประเภทรหัส')

        return cleaned_data


class CaseEditForm(forms.ModelForm):
    symptom_types_text = forms.CharField(
        required=False,
        label='ประเภทอาการ',
        help_text='คั่นหลายค่าโดยใช้เครื่องหมายจุลภาค (,)',
    )

    class Meta:
        model = Case
        fields = ['occurred_at', 'symptoms', 'needs_ward', 'status']
        widgets = {
            'occurred_at': forms.DateTimeInput(attrs={'type': 'datetime-local'}),
            'symptoms': forms.Textarea(attrs={'rows': 3}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            values = self.instance.symptom_types or []
            self.fields['symptom_types_text'].initial = ', '.join(values)
            occurred_at = timezone.localtime(self.instance.occurred_at).replace(second=0, microsecond=0)
            self.initial['occurred_at'] = occurred_at.strftime('%Y-%m-%dT%H:%M')

    def clean_symptom_types_text(self):
        raw = self.cleaned_data.get('symptom_types_text') or ''
        return [part.strip() for part in raw.split(',') if part.strip()]

    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.symptom_types = self.cleaned_data.get('symptom_types_text', [])
        if commit:
            instance.save()
        return instance


class PatientEditForm(forms.ModelForm):
    organization = forms.ChoiceField(choices=STUDENT_ORGANIZATION_CHOICES, label='คณะ/หน่วยงาน')

    class Meta:
        model = Patient
        fields = ['student_id', 'name', 'organization', 'gender']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        id_value = self.data.get('student_id') if self.is_bound else getattr(self.instance, 'student_id', '')
        id_type = detect_id_type_from_value(id_value)
        org_choices = organization_choices_for_id_type(id_type)

        current_org = (self.data.get('organization') if self.is_bound else getattr(self.instance, 'organization', ''))
        current_org = (current_org or '').strip()
        label_suffix = '' if self.is_bound else ' (ข้อมูลเดิม)'
        self.fields['organization'].choices = append_choice_if_missing(org_choices, current_org, label_suffix)

    def clean_student_id(self):
        student_id = (self.cleaned_data['student_id'] or '').strip()
        if not student_id.isdigit() or len(student_id) not in (7, 8):
            raise forms.ValidationError('รหัสนักศึกษา / บุคลากรต้องเป็นตัวเลข 7 หรือ 8 หลัก')
        return student_id

    def clean(self):
        cleaned_data = super().clean()
        student_id = cleaned_data.get('student_id')
        organization = cleaned_data.get('organization')
        id_type = detect_id_type_from_value(student_id)

        valid_values = {value for value, _label in organization_choices_for_id_type(id_type) if value}
        if organization and organization not in valid_values:
            self.add_error('organization', 'หน่วยงานที่เลือกไม่ตรงกับประเภทรหัส')

        return cleaned_data

    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.id_type = Patient.detect_id_type(instance.student_id)
        if commit:
            instance.save()
        return instance


class MedicineForm(forms.ModelForm):
    class Meta:
        model = Medicine
        fields = ['id', 'name', 'category', 'unit', 'stock']


class BedForm(forms.ModelForm):
    class Meta:
        model = Bed
        fields = ['id', 'room', 'number', 'gender_rule']


class BedAssignForm(forms.Form):
    bed_id = forms.CharField(widget=forms.HiddenInput)
    patient = forms.ModelChoiceField(queryset=Patient.objects.none(), label='ผู้ป่วย')
    notes = forms.CharField(required=False, widget=forms.Textarea(attrs={'rows': 2}), label='หมายเหตุ')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['patient'].queryset = Patient.objects.order_by('student_id')


class UserManagementForm(forms.ModelForm):
    password = forms.CharField(
        required=False,
        label='รหัสผ่าน',
        widget=forms.PasswordInput(render_value=False),
    )

    class Meta:
        model = AppUser
        fields = ['username', 'first_name', 'last_name', 'role', 'status']
        labels = {
            'username': 'ชื่อผู้ใช้',
            'first_name': 'ชื่อ',
            'last_name': 'นามสกุล',
            'role': 'บทบาท',
            'status': 'สถานะ',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            self.fields['password'].help_text = 'Nurse เว้นว่างได้, Admin ควรตั้งรหัสผ่านเพื่อเข้าใช้งาน'
        else:
            self.fields['password'].required = False
            self.fields['password'].help_text = 'Admin ต้องมีรหัสผ่าน, Nurse เว้นว่างได้'

    def clean_username(self):
        username = (self.cleaned_data.get('username') or '').strip()
        if not username:
            raise forms.ValidationError('ชื่อผู้ใช้ห้ามว่าง')
        return username

    def clean(self):
        cleaned_data = super().clean()
        role = cleaned_data.get('role')
        raw_password = (cleaned_data.get('password') or '').strip()
        is_edit = bool(self.instance and self.instance.pk)

        if role == AppUser.Role.ADMIN:
            if not is_edit and not raw_password:
                self.add_error('password', 'กรอกรหัสผ่านสำหรับผู้ใช้ Admin ใหม่')
            elif is_edit and not raw_password and not self.instance.has_usable_password():
                self.add_error('password', 'บัญชี Admin นี้ยังไม่มีรหัสผ่าน กรุณาตั้งรหัสผ่าน')

        return cleaned_data

    def save(self, commit=True):
        user = super().save(commit=False)
        user.is_active = user.status == AppUser.Status.ACTIVE
        user.is_staff = user.role == AppUser.Role.ADMIN

        raw_password = self.cleaned_data.get('password')
        if raw_password:
            user.set_password(raw_password)
        elif not (self.instance and self.instance.pk):
            # New nurse accounts can be kiosk-only without password login.
            user.set_unusable_password()

        if commit:
            user.save()
        return user

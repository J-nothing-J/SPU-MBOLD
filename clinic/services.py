from __future__ import annotations

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone

from .models import Bed, Case, CaseMedicine, Medicine, Patient


def _normalize_symptom_types(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in value.split(',') if item.strip()]
    text = str(value).strip()
    return [text] if text else []


def assign_first_available_bed(patient: Patient) -> Bed | None:
    available = Bed.objects.filter(status=Bed.Status.AVAILABLE)

    if patient.gender == Patient.Gender.MALE:
        available = available.filter(Q(gender_rule=Bed.GenderRule.MALE) | Q(gender_rule=Bed.GenderRule.ANY))
    elif patient.gender == Patient.Gender.FEMALE:
        available = available.filter(Q(gender_rule=Bed.GenderRule.FEMALE) | Q(gender_rule=Bed.GenderRule.ANY))

    bed = available.order_by('room', 'number').first()
    if not bed:
        return None

    bed.status = Bed.Status.OCCUPIED
    bed.patient = patient
    bed.admission_date = timezone.now()
    bed.save()
    return bed


def create_case_with_medicines(
    *,
    patient: Patient,
    nurse,
    symptoms: str,
    symptom_types,
    medicines_payload: list[dict] | None,
    occurred_at=None,
    needs_ward: bool = False,
    status: str = Case.Status.ACTIVE,
) -> Case:
    medicines_payload = medicines_payload or []

    with transaction.atomic():
        case = Case.objects.create(
            patient=patient,
            nurse=nurse,
            symptoms=symptoms,
            symptom_types=_normalize_symptom_types(symptom_types),
            occurred_at=occurred_at or timezone.now(),
            needs_ward=needs_ward,
            status=status,
        )

        for entry in medicines_payload:
            medicine_id = str(entry.get('medicine_id') or entry.get('id') or '').strip()
            quantity = int(entry.get('quantity') or 0)

            if not medicine_id:
                raise ValidationError('Medicine id is required for every prescribed item.')
            if quantity < 1:
                raise ValidationError(f'Quantity must be positive for medicine {medicine_id}.')

            medicine = Medicine.objects.select_for_update().filter(pk=medicine_id).first()
            if medicine is None:
                raise ValidationError(f'Medicine {medicine_id} was not found.')
            if medicine.stock < quantity:
                raise ValidationError(f'Not enough stock for medicine {medicine_id}.')

            Medicine.objects.filter(pk=medicine_id).update(stock=F('stock') - quantity)
            CaseMedicine.objects.create(case=case, medicine_id=medicine_id, quantity=quantity)

        if needs_ward:
            assign_first_available_bed(patient)

        return case


def delete_case_and_restore_stock(case: Case) -> None:
    with transaction.atomic():
        linked_medicines = list(case.prescribed_medicines.all())
        for linked in linked_medicines:
            Medicine.objects.filter(pk=linked.medicine_id).update(stock=F('stock') + linked.quantity)

        case.delete()

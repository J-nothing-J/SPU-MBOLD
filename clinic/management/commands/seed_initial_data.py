from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from clinic.models import Bed, Medicine


class Command(BaseCommand):
    help = 'Seed minimal data for local development and kiosk login checks.'

    def handle(self, *args, **options):
        user_model = get_user_model()

        admin, admin_created = user_model.objects.get_or_create(
            username='admin',
            defaults={
                'role': user_model.Role.ADMIN,
                'status': user_model.Status.ACTIVE,
                'is_staff': True,
                'is_superuser': True,
                'first_name': 'System',
                'last_name': 'Admin',
            },
        )
        if admin_created:
            admin.set_password('admin1234')
            admin.save(update_fields=['password'])

        nurse_defaults = [
            ('nurse_anne', 'Anne'),
            ('nurse_bee', 'Bee'),
            ('nurse_care', 'Care'),
        ]
        for username, first_name in nurse_defaults:
            nurse, created = user_model.objects.get_or_create(
                username=username,
                defaults={
                    'role': user_model.Role.NURSE,
                    'status': user_model.Status.ACTIVE,
                    'first_name': first_name,
                },
            )
            if created:
                nurse.set_password('nurse1234')
                nurse.save(update_fields=['password'])

        medicines = [
            {'id': 'MED-001', 'name': 'Paracetamol', 'category': 'Pain Relief', 'unit': 'Tablet', 'stock': 120},
            {'id': 'MED-002', 'name': 'Amoxicillin', 'category': 'Antibiotic', 'unit': 'Capsule', 'stock': 65},
            {'id': 'MED-003', 'name': 'Oral Rehydration Salts', 'category': 'Hydration', 'unit': 'Sachet', 'stock': 18},
            {'id': 'MED-004', 'name': 'Ibuprofen', 'category': 'Anti-inflammatory', 'unit': 'Tablet', 'stock': 8},
        ]
        for medicine in medicines:
            Medicine.objects.update_or_create(id=medicine['id'], defaults=medicine)

        beds = [
            {'id': 'BED-R1-01', 'room': 1, 'number': 1, 'gender_rule': Bed.GenderRule.MALE, 'status': Bed.Status.AVAILABLE},
            {'id': 'BED-R1-02', 'room': 1, 'number': 2, 'gender_rule': Bed.GenderRule.FEMALE, 'status': Bed.Status.AVAILABLE},
            {'id': 'BED-R2-01', 'room': 2, 'number': 1, 'gender_rule': Bed.GenderRule.ANY, 'status': Bed.Status.AVAILABLE},
            {'id': 'BED-R2-02', 'room': 2, 'number': 2, 'gender_rule': Bed.GenderRule.ANY, 'status': Bed.Status.AVAILABLE},
        ]
        for bed in beds:
            Bed.objects.update_or_create(id=bed['id'], defaults=bed)

        self.stdout.write(self.style.SUCCESS('Seed completed: users, medicines, and beds are ready.'))
        self.stdout.write('Admin login: admin / admin1234')
        self.stdout.write('Nurse kiosk accounts: nurse_anne, nurse_bee, nurse_care')

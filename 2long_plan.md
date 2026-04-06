# SPU Medbay System - Development Plan

## 1. Advanced Patient & Clinical Records (EHR)
- [ ] **Comprehensive Medical History:** Add fields for allergies (critical!), underlying conditions, chronic diseases, and blood type on the database level.
- [ ] **Vital Signs Logging:** When creating a "New Case", include inputs for vital signs (Blood Pressure, Heart Rate, Temperature, O2 Saturation, Weight/Height).
- [ ] **SOAP Notes:** For medical staff, structure the case notes using the standard SOAP format (Subjective, Objective, Assessment, Plan).
- [ ] **Medical Certificate Generation:** Allow nurses/doctors to auto-generate and print PDF medical certificates directly from a patient's case record.

## 2. Enhanced Pharmacy & Inventory (คลังยา)
- [ ] **Expiry Date Tracking:** Track "Expiring Soon" using batch numbers to ensure compliance with medical standards.
- [ ] **Dispensing Logs:** Link specific inventory deductions directly to a patient's case (who received what, how much, and who prescribed it).
- [ ] **Restock/Supplier Management:** Track incoming shipments, costs, and supplier contact info.

## 3. Queue & Triage System
- [ ] **Triage Priority Levels:** Add color-coded priority tags to the "Recent Cases" table (e.g., Red = Emergency, Yellow = Urgent, Green = Routine).
- [ ] **Waiting Room Queue:** A live queue screen to show currently seen patients and those waiting, helping manage student expectations.

## 4. Smart Bed Management (จัดการเตียง)
- [ ] **Bed Status Workflow:** Implement detailed states like `Occupied`, `Available`
- [ ] **Time Tracking:** Add an automatic timer when a bed is occupied. Notify nurses if a patient exceeds a 2-3 hour observation window.

## 5. Analytics & Campus Reporting 
- [ ] **Exportable Reports:** One-click generation of Monthly/Weekly usage reports (visits per day, top medicines used) exported to Excel/CSV for management.

## 7. Compliance & Technical Standards

### Accessibility (WCAG)
- [ ] **WCAG Level AA Compliance:** Ensure the app is accessible to users with disabilities (semantic HTML, keyboard navigation, high color contrast, ARIA attributes).

### Data Privacy & Healthcare Regulations
- [ ] **Thailand PDPA (Personal Data Protection Act):** Implement explicit consent management for collecting/processing "Sensitive Personal Data" (health data).
- [ ] **National Health Act, B.E. 2550 (2007) (Section 7):** Ensure strict role-based access control (RBAC) to maintain patient record confidentiality.
- [ ] **Secure Data Handling:** Ensure data encryption at rest (database) and in transit (HTTPS/SSL).
- [ ] **Audit Logging:** Maintain strict logs of who accessed, modified, or deleted records (leveraging the existing `audit_logs.html` setup).

### Security Standards
- [ ] **OWASP Top 10:** Protect against critical web risks like Broken Access Control and Injection.
- [ ] **Django Production Security:** Enforce `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, and `CSRF_COOKIE_SECURE` in `settings.py`.

### Medical Data Interoperability (HL7 FHIR Thailand)
- [ ] **FHIR-Aligned Database Models:** Structure `models.py` to map easily to FHIR resources (e.g., `Patient` resource using the 13-digit Thai Citizen ID, `Encounter` for cases, `Location` for beds).
- [ ] **API Readiness:** Plan for future Django REST Framework (DRF) integrations to connect with Thai MoPH’s Health Data Center (HDC) or MorProm.
- [ ] **Standardized Coding Systems:** Support ICD-10-TM for diagnoses and TMT (Thai Medicines Terminology) for inventory and prescriptions instead of basic free-text entry.

### Software Architecture
- [ ] **The Twelve-Factor App:** Follow modern deployment methodologies (e.g., using environment variables for configuration and secrets).
- [ ] **PEP 8:** Adhere to Python style guidelines for code maintainability.

## 8. Ideas Dump & Future Considerations
- [ ] **Data Retention & Archiving:** Create an automated policy (e.g., `manage.py archive_graduates`) to anonymize or delete PII of graduated students after a set period, keeping only aggregated statistics for university trend reporting.
- [ ] **Backup & Disaster Recovery:** Standardize daily database backups (especially prioritizing PostgreSQL over SQLite for production). Follow the 3-2-1 backup rule.
- [ ] **SPU SCMS API Integration:** Sync student data directly from the university's Student Information System. When entering a Student ID, automatically fetch their name, faculty instead of manual entry.

IOT Intergate00

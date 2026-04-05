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
- [ ] **Bed Status Workflow:** Implement detailed states like `Occupied`, `Available`, and `Needs Cleaning`.
- [ ] **Time Tracking:** Add an automatic timer when a bed is occupied. Notify nurses if a patient exceeds a 2-3 hour observation window.

## 5. Analytics & Campus Reporting 
- [ ] **Epidemic/Trend Tracking:** Dashboards showing common symptoms over time to flag potential outbreaks (e.g., COVID, Dengue, Flu) for campus administration.
- [ ] **Exportable Reports:** One-click generation of Monthly/Weekly usage reports (visits per day, top medicines used) exported to Excel/CSV for management.

## 6. System & Security Integrations
- [x] **Audit Trail:** Track system changes (e.g., "Nurse B updated Case #1234 on April 5") using tools like `django-simple-history`.

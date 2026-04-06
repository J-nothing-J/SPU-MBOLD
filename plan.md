# SPU Medbay System - Development Plan

## 4. Smart Bed Management (จัดการเตียง)
- [ ] **Bed Status Workflow:** Implement detailed states like `Occupied`, `Available`
- [ ] **Time Tracking:** Add an automatic timer when a bed is occupied. Notify nurses if a patient exceeds a 2-3 hour observation window.

## 5. Analytics & Campus Reporting 
- [ ] **Exportable Reports:** One-click generation of Monthly/Weekly usage reports (visits per day, top medicines used) exported to Excel/CSV for management.

## 6. System & Security Integrations
- [x] **Audit Trail:** Track system changes (e.g., "Nurse B updated Case #1234 on April 5") using tools like `django-simple-history`.

## 7. Compliance & Technical Standards

### Accessibility (WCAG)
- [x] **Basic WCAG2.2 Compliance (Level AA):** Ensure semantic HTML and high contrast so the dashboard is easy to read for busy university staff (leveraging standard Bootstrap/Tailwind principles).

### Data Privacy & Healthcare Regulations
- [ ] **Thailand PDPA (Personal Data Protection Act):** Implement explicit consent management for collecting/processing "Sensitive Personal Data" (health data).
- [ ] **National Health Act, B.E. 2550 (2007) (Section 7):** Ensure strict role-based access control (RBAC) to maintain patient record confidentiality.
- [x] **Secure Data Handling:** Ensure data encryption at rest (database) and in transit (HTTPS/SSL).
- [x] **Audit Logging:** Maintain strict logs of who accessed, modified, or deleted records (leveraging the existing `audit_logs.html` setup).

### Security Standards
- [ ] **OWASP Top 10:** Protect against critical web risks like Broken Access Control and Injection.
- [ ] **Django Production Security:** Enforce `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, and `CSRF_COOKIE_SECURE` in `settings.py`.

### Software Architecture
- [ ] **The Twelve-Factor App:** Follow modern deployment methodologies (e.g., using environment variables for configuration and secrets).
- [ ] **PEP 8:** Adhere to Python style guidelines for code maintainability.

Make Flowchart

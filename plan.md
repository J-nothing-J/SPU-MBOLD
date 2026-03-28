## Plan: Full Django Migration for SPU Medbay

Replace the current static + Google Sheets stack with a Django project that preserves current behavior first, using SQLite and kiosk-style nurse login in phase 1. The approach is to migrate domain rules and page flows from existing JavaScript into Django models, views, templates, and role-based access controls, then verify parity end-to-end.

**Steps**
1. Phase 1: Baseline mapping and Django scaffold. Build a parity matrix from existing pages and functions (dashboard, new case, cases, patients, inventory, beds, users), then create a Django project scaffold with one core app, template/static settings, URL routing, and SQLite configuration; this is the foundation for all later work.
2. Phase 2: Domain modeling and service rules (*depends on 1*). Implement Django models for users/roles, patients, cases, medicines, beds, and a case-to-medicine relation that supports quantities; move core logic from JavaScript (ID-type detection, bed auto-assignment, stock decrement/restore) into model/service-layer code with validation and transactional safety.
3. Phase 3: Authentication and authorization (*depends on 1; parallel with step 2 after user model is defined*). Implement a kiosk-style nurse login flow (quick user selection for active nurses), admin password login, session management, and role guards so user-management actions remain admin-only while nurse workflows remain fast.
4. Phase 4: Backend view/controller parity (*depends on 2 and 3*). Rebuild each current feature flow as Django views/forms endpoints: case create/edit/delete, patient search/filter/edit, medicine CRUD with low-stock detection, bed assignment/discharge, and dashboard counters/recent tables.
5. Phase 5: Template and static migration (*depends on 4; page migration can run in parallel per page*). Split the monolithic HTML into base plus page templates, port CSS, and refactor JavaScript to call Django endpoints instead of Google Sheets; keep existing IDs/interaction patterns where practical to reduce regressions.
6. Phase 6: Test hardening and parity QA (*depends on 2-5*). Add model, view, and permission tests, then run a manual parity checklist for all user flows and edge cases (stock restoration on delete, ward assignment behavior, role visibility rules, date filtering, and modal workflows).
7. Phase 7: Cutover cleanup (*depends on 6*). Remove Google Sheets/App Script dependencies from runtime paths, keep legacy files only as reference until acceptance, and document local setup plus run commands.

**Relevant files**
- c:/Users/JustJay_UwU/Downloads/SPU-MD_Django/index.html - Source of all current page sections, forms, modal IDs, and navigation targets that should map to Django templates/routes.
- c:/Users/JustJay_UwU/Downloads/SPU-MD_Django/script.js - Source of business logic to migrate (authentication behavior, CRUD orchestration, inventory stock logic, bed assignment, dashboard calculations).
- c:/Users/JustJay_UwU/Downloads/SPU-MD_Django/google-sheets-config.js - Current data access abstraction; replace with Django ORM/view endpoints while preserving action-level behavior.
- c:/Users/JustJay_UwU/Downloads/SPU-MD_Django/google-apps-script.js - Existing backend contract and CRUD semantics to mirror in Django during parity migration.
- c:/Users/JustJay_UwU/Downloads/SPU-MD_Django/styles.css - Existing visual system to port into Django static assets.

**Verification**
1. Automated: run Django system checks, migrations, and unit tests for models/views/permissions; include tests for stock decrement+restore and bed auto-assignment logic.
2. Manual nurse flow: kiosk login, create case with medicines, ward toggle, confirm case, verify dashboard/cases/patients updates.
3. Manual admin flow: admin login, manage users, medicine CRUD, bed assignment/discharge, and role-based UI visibility.
4. Regression checks: delete/edit case updates stock correctly, patient search/filter behaves as before, low-stock indicators and today filters match expected counts.

**Decisions**
- Included: full Django replacement (backend + frontend templates), SQLite for initial phase, kiosk-style nurse login preserved, feature parity first.
- Excluded in phase 1: Google Sheets data import (start with empty DB), production deployment hardening, and non-parity feature expansion.
- Security note: kiosk login is intentionally preserved for parity, but should still include session timeout and audit logging to reduce misuse risk.

**Further Considerations**
1. Kiosk hardening recommendation for phase 1.5: add inactivity auto-logout and optional nurse PIN without changing the quick-login experience.
2. Data schema recommendation: use normalized case-medicine relations instead of JSON blobs to simplify validation/reporting later.
3. Rollout recommendation: migrate one page flow at a time (new case first), with acceptance checks after each page to avoid broad regressions.

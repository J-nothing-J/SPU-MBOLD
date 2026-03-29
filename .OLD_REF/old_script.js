// Data storage
let patients = [];
let medicines = [];
let beds = [];
let users = [];
let selectedMedicines = []; // Temporary storage for medicine selection in new case
let editSelectedMedicines = []; // Temporary storage for editing case medicines
let medicineSelectionContext = 'new'; // 'new' or 'edit'
let currentUser = sessionStorage.getItem('currentUser') || null;

// Normalize medicine helpers to handle mixed ID formats (string/number/case)
function normalizeMedicineId(id) {
    return String(id ?? '').trim();
}

function normalizeMedicineRecord(record = {}) {
    const stockValue = record.stock ?? record.Stock ?? record.qty ?? record.Qty ?? record.quantity ?? record.Quantity;
    const normalized = {
        ...record,
        id: normalizeMedicineId(record.id || record.ID || record.medicineId || record.MedicineID),
        name: record.name || record.Name || record.medicineName || record.MedicineName || 'Unnamed',
        category: record.category || record.Category || 'Other',
        unit: record.unit || record.Unit || 'Piece',
        stock: Number.isFinite(Number(stockValue)) ? Number(stockValue) : 0
    };
    return normalized;
}

function findMedicineById(medicineId) {
    const targetId = normalizeMedicineId(medicineId);
    return medicines.find(m => normalizeMedicineId(m.id) === targetId);
}

function findMedicineIndexById(medicineId) {
    const targetId = normalizeMedicineId(medicineId);
    return medicines.findIndex(m => normalizeMedicineId(m.id) === targetId);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async function () {
    // Initialize default users if none exist
    initializeDefaultUsers();

    // Load data from Google Sheets if enabled
    if (typeof initializeDataFromSheets === 'function') {
        await initializeDataFromSheets();
    }

    // Check if user is logged in
    if (!currentUser) {
        showLoginScreen();
    } else {
        showMainApp();
        updateUIBasedOnRole();
    }

    initializeNavigation();
    initializeForms();
    initializeModals();
    initializeLogin();
    loadData();
    updateDashboard();
});

// Initialize default users (Admin and Nurses only)
async function initializeDefaultUsers() {
    // Users will be loaded from Google Sheets
    if (typeof USE_GOOGLE_SHEETS !== 'undefined' && USE_GOOGLE_SHEETS) {
        return;
    }
}

// Login System - Kiosk Style
function initializeLogin() {
    updateKioskTime();
    setInterval(updateKioskTime, 1000);

    updateNurseGrid();

    const logoutBtn = document.getElementById('logout-btn');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const closeAdminLogin = document.getElementById('close-admin-login');
    const cancelAdminLogin = document.getElementById('cancel-admin-login');
    const adminLoginForm = document.getElementById('admin-login-form');

    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', showAdminLoginModal);
    }

    if (closeAdminLogin) {
        closeAdminLogin.addEventListener('click', hideAdminLoginModal);
    }

    if (cancelAdminLogin) {
        cancelAdminLogin.addEventListener('click', hideAdminLoginModal);
    }

    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', handleAdminLogin);
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

// Update kiosk time display
function updateKioskTime() {
    const timeElement = document.getElementById('kiosk-time');
    if (!timeElement) return;

    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    timeElement.textContent = now.toLocaleDateString('en-US', options);
}

// Update nurse grid with active nurses
function updateNurseGrid() {
    const nurseGrid = document.getElementById('nurse-grid');
    if (!nurseGrid) return;

    const activeNurses = users.filter(user => user.role === 'Nurse' && user.status === 'Active');

    if (activeNurses.length === 0) {
        nurseGrid.innerHTML = '<p style="text-align: center; color: #666; grid-column: 1/-1;">No nurses available. Please contact administrator.</p>';
        return;
    }

    nurseGrid.innerHTML = activeNurses.map(nurse => `
        <button class="nurse-button" data-username="${nurse.username}">
            <i class="fas fa-user-nurse"></i>
            <div class="nurse-name">${nurse.username}</div>
        </button>
    `).join('');

    // Attach event listeners
    document.querySelectorAll('.nurse-button').forEach(button => {
        button.addEventListener('click', function () {
            const username = this.getAttribute('data-username');
            nurseLogin(username);
        });
    });
}

// Nurse login (no password required)
function nurseLogin(username) {
    const user = users.find(u => u.username === username && u.role === 'Nurse' && u.status === 'Active');

    if (!user) {
        alert('ไม่พบบัญชีผู้ใช้หรือสถานะไม่พร้อมใช้งาน');
        return;
    }

    currentUser = user.username;
    sessionStorage.setItem('currentUser', user.username);
    sessionStorage.setItem('currentUserRole', user.role);
    document.getElementById('current-user').textContent = user.username;
    showMainApp();
    updateUIBasedOnRole();
}

// Show admin login modal
function showAdminLoginModal() {
    const modal = document.getElementById('admin-login-modal');
    const adminSelect = document.getElementById('admin-username');

    if (modal) {
        // Populate admin dropdown
        const activeAdmins = users.filter(user => user.role === 'Admin' && user.status === 'Active');
        if (adminSelect) {
            adminSelect.innerHTML = '<option value="">-- Select Admin --</option>' +
                activeAdmins.map(admin => `<option value="${admin.username}">${admin.username}</option>`).join('');
        }

        modal.classList.add('show');
        adminSelect.focus();
    }
}

// Hide admin login modal
function hideAdminLoginModal() {
    const modal = document.getElementById('admin-login-modal');
    const errorDiv = document.getElementById('admin-login-error');
    const form = document.getElementById('admin-login-form');

    if (modal) modal.classList.remove('show');
    if (errorDiv) errorDiv.style.display = 'none';
    if (form) form.reset();
}

// Handle admin login
function handleAdminLogin(e) {
    e.preventDefault();

    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;
    const errorDiv = document.getElementById('admin-login-error');

    errorDiv.style.display = 'none';

    if (!username) {
        errorDiv.textContent = 'Please select an admin user.';
        errorDiv.style.display = 'block';
        return;
    }

    if (!password) {
        errorDiv.textContent = 'Please enter the password.';
        errorDiv.style.display = 'block';
        return;
    }

    const user = users.find(u => u.username === username && u.role === 'Admin' && u.status === 'Active');

    if (!user) {
        errorDiv.textContent = 'Invalid username or user is not an administrator.';
        errorDiv.style.display = 'block';
        return;
    }

    // Check password (default to 'admin123' if not set)
    const storedPassword = user.password || '123';
    if (password !== storedPassword) {
        errorDiv.textContent = 'Invalid password.';
        errorDiv.style.display = 'block';
        return;
    }

    // Successful login
    currentUser = user.username;
    sessionStorage.setItem('currentUser', user.username);
    sessionStorage.setItem('currentUserRole', user.role);
    document.getElementById('current-user').textContent = user.username;

    hideAdminLoginModal();
    showMainApp();
    updateUIBasedOnRole();
}

// Update login options (legacy support)
function updateLoginOptions() {
    // For backward compatibility, update both old and new systems
    updateNurseGrid();
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        currentUser = null;
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('currentUserRole');
        showLoginScreen();
        updateNurseGrid(); // Refresh the nurse grid on return to login
    }
}

function showLoginScreen() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
    updateKioskTime(); // Update time when showing login screen
}

function showMainApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    if (currentUser) {
        document.getElementById('current-user').textContent = currentUser;
        // Set nurse name in the new case form
        const nurseNameField = document.getElementById('nurse-name');
        if (nurseNameField) {
            nurseNameField.value = currentUser;
        }
    }
}

// Update UI based on user role
function updateUIBasedOnRole() {
    const userRole = sessionStorage.getItem('currentUserRole');
    const adminOnlyElements = document.querySelectorAll('.admin-only');

    adminOnlyElements.forEach(element => {
        if (userRole === 'Admin') {
            element.style.display = '';
        } else {
            element.style.display = 'none';
        }
    });
}

// Navigation
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.addEventListener('click', function () {
            const page = this.getAttribute('data-page');
            switchPage(page);
        });
    });
}

function switchPage(page) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-page="${page}"]`).classList.add('active');

    // Update pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    document.getElementById(`${page}-page`).classList.add('active');

    // Update title
    const titles = {
        'dashboard': 'Dashboard',
        'new-case': 'New Case',
        'cases': 'Case Viewer',
        'patients': 'Patients',
        'inventory': 'Medicine Inventory',
        'beds': 'Bed Management',
        'user-management': 'User Management'
    };
    document.getElementById('page-title').textContent = titles[page];

    // Load patients table when switching to patients page
    if (page === 'patients') {
        loadAllPatients();
    }

    // Load cases table when switching to cases page
    if (page === 'cases') {
        setDefaultCasesDate();
        loadCasesByDate();
    }

    // Load users table when switching to user management page
    if (page === 'user-management') {
        loadUsersTable();
    }

    // Auto-fill nurse name when switching to new-case page
    if (page === 'new-case') {
        const currentUser = sessionStorage.getItem('currentUser');
        if (currentUser) {
            document.getElementById('nurse-name').value = currentUser;
        }
        updateIdTypeIndicator();
    }
}
// Forms Initialization
function initializeForms() {
    // New Case Form - Show confirmation instead of directly adding
    document.getElementById('new-case-form').addEventListener('submit', function (e) {
        e.preventDefault();
        showCaseConfirmation();
    });

    document.getElementById('new-case-form').addEventListener('reset', function () {
        // Allow the native reset to clear inputs before updating the indicator
        setTimeout(updateIdTypeIndicator, 0);
    });

    // Student Search Button
    document.getElementById('search-student-btn').addEventListener('click', function () {
        searchStudentInfo();
    });

    // Student ID Enter key support
    document.getElementById('patient-student-id').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchStudentInfo();
        }
    });

    document.getElementById('patient-student-id').addEventListener('input', updateIdTypeIndicator);
    updateIdTypeIndicator();

    // Ward checkbox toggle
    document.getElementById('patient-needs-ward').addEventListener('change', function (e) {
        const wardInfo = document.getElementById('ward-info');
        wardInfo.style.display = e.target.checked ? 'block' : 'none';
    });

    // Medicine Form
    document.getElementById('medicine-form').addEventListener('submit', function (e) {
        e.preventDefault();
        saveMedicine();
    });

    // Bed Form
    document.getElementById('bed-form').addEventListener('submit', function (e) {
        e.preventDefault();
        assignBed();
    });

    // User Form
    document.getElementById('user-form').addEventListener('submit', function (e) {
        e.preventDefault();
        saveUser();
    });

    // Add Medicine Button
    document.getElementById('add-medicine-btn').addEventListener('click', function () {
        openMedicineModal();
    });

    // Add Bed Button
    document.getElementById('add-bed-btn').addEventListener('click', function () {
        addNewBed();
    });

    // Add User Button
    document.getElementById('add-user-btn').addEventListener('click', function () {
        openUserModal();
    });

    // Add Medicine to Case Button (new case)
    document.getElementById('add-medicine-to-case-btn').addEventListener('click', function () {
        openMedicineSelectionModal('new');
    });

    // Case Viewer filters
    const casesDateFilter = document.getElementById('cases-date-filter');
    const casesTodayBtn = document.getElementById('cases-today-btn');
    if (casesDateFilter) {
        setDefaultCasesDate();
        casesDateFilter.addEventListener('change', loadCasesByDate);
    }
    if (casesTodayBtn) {
        casesTodayBtn.addEventListener('click', function () {
            setDefaultCasesDate();
            loadCasesByDate();
        });
    }

    const casesTable = document.getElementById('cases-table');
    if (casesTable) {
        casesTable.addEventListener('click', function (e) {
            const deleteBtn = e.target.closest('.case-delete-btn');
            if (deleteBtn) {
                const caseId = deleteBtn.getAttribute('data-case-id');
                deleteCaseEntry(caseId);
                return;
            }

            const editBtn = e.target.closest('.case-edit-btn');
            if (editBtn) {
                const caseId = editBtn.getAttribute('data-case-id');
                const studentId = editBtn.getAttribute('data-student-id');
                openEditPatientModal(caseId, studentId);
            }
        });
    }

    const editAddMedBtn = document.getElementById('edit-add-medicine-btn');
    if (editAddMedBtn) {
        editAddMedBtn.addEventListener('click', function () {
            openMedicineSelectionModal('edit');
        });
    }
    // Confirm Medicine Selection
    document.getElementById('confirm-medicine-selection').addEventListener('click', function () {
        addMedicineToCase();
    });

    // Confirmation Modal Buttons
    document.getElementById('confirm-add-case').addEventListener('click', function () {
        closeCaseConfirmation();
        addPatient();
    });

    document.getElementById('cancel-add-case').addEventListener('click', function () {
        closeCaseConfirmation();
    });
}

async function deleteCaseEntry(caseId) {
    if (!caseId) return;
    if (!confirm('ลบเคสนี้หรือไม่?')) return;

    try {
        const caseRecord = patients.find(p => String(p.caseId) === String(caseId));

        // Pull latest medicines before adjusting stock
        if (typeof loadMedicinesFromSheet === 'function') {
            await loadMedicinesFromSheet();
        }

        if (typeof deleteCaseFromSheet === 'function') {
            const result = await deleteCaseFromSheet(caseId);
            if (!result.success) {
                alert('เกิดข้อผิดพลาดขณะลบเคส: ' + result.message);
                return;
            }
        }

        // Restore stock for medicines used in this case
        if (caseRecord && Array.isArray(caseRecord.medicines)) {
            caseRecord.medicines.forEach(med => {
                const idx = findMedicineIndexById(med.medicineId);
                if (idx !== -1) {
                    const qty = Number(med.quantity) || 0;
                    medicines[idx].stock = (Number(medicines[idx].stock) || 0) + qty;
                    if (typeof updateMedicineInSheet === 'function') {
                        updateMedicineInSheet(medicines[idx]);
                    }
                }
            });
        }

        // Reload from Sheets to stay in sync (preserves patient records)
        if (typeof loadPatientsFromSheet === 'function') {
            await loadPatientsFromSheet();
        }

        // Refresh medicines UI after restock
        loadMedicines();

        // Refresh views
        loadCasesByDate();
        loadPatients();
        loadAllPatients();
        updateDashboard();

        alert('ลบเคสเรียบร้อยแล้ว');
    } catch (error) {
        console.error('Error deleting case:', error);
        alert('เกิดข้อผิดพลาดระหว่างลบเคส');
    }
}

// Modals
function initializeModals() {
    // Medicine Modal
    document.getElementById('close-medicine-modal').addEventListener('click', closeMedicineModal);
    document.getElementById('cancel-medicine').addEventListener('click', closeMedicineModal);

    // Bed Modal
    document.getElementById('close-bed-modal').addEventListener('click', closeBedModal);
    document.getElementById('cancel-bed').addEventListener('click', closeBedModal);

    // User Modal
    document.getElementById('close-user-modal').addEventListener('click', closeUserModal);
    document.getElementById('cancel-user').addEventListener('click', closeUserModal);

    // Patient Details Modal
    document.getElementById('close-patient-modal').addEventListener('click', closePatientModal);

    // Student Search Modal
    document.getElementById('close-student-search-modal').addEventListener('click', closeStudentSearchModal);
    document.getElementById('cancel-student-info').addEventListener('click', closeStudentSearchModal);
    document.getElementById('confirm-student-info').addEventListener('click', confirmStudentInfo);

    // Case Confirmation Modal
    document.getElementById('close-confirmation-modal').addEventListener('click', closeCaseConfirmation);

    // Medicine Selection Modal
    document.getElementById('close-medicine-selection-modal').addEventListener('click', closeMedicineSelectionModal);
    document.getElementById('cancel-medicine-selection').addEventListener('click', closeMedicineSelectionModal);

    // Edit Patient Modal
    document.getElementById('close-edit-patient-modal').addEventListener('click', closeEditPatientModal);
    document.getElementById('cancel-edit-patient').addEventListener('click', closeEditPatientModal);

    // Edit Patient Form
    document.getElementById('edit-patient-form').addEventListener('submit', function (e) {
        e.preventDefault();
        savePatientEdits();
    });

    // Patient Search
    document.getElementById('patient-search').addEventListener('input', function (e) {
        filterPatients(e.target.value);
    });

    // Close modal when clicking outside
    window.addEventListener('click', function (event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('show');
        }
    });
}

// Patient Management
function getSelectedSymptomTypes(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
}

function setSymptomTypeSelections(containerId, values = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const valueSet = new Set(values || []);
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = valueSet.has(cb.value);
    });
}

function detectIdTypeFromValue(value) {
    const cleaned = String(value || '').replace(/\D/g, '').trim();

    if (/^\d{8}$/.test(cleaned)) {
        return 'student';
    }

    if (/^\d{7}$/.test(cleaned)) {
        return 'employee';
    }

    return null;
}

function formatIdTypeLabel(idType) {
    if (idType === 'student') {
        return 'Student ID (8 หลัก)';
    }

    if (idType === 'employee') {
        return 'Employee ID (7 หลัก)';
    }

    return 'กรอก 7 หรือ 8 หลักเพื่อให้ระบบระบุประเภท';
}

const collegeOptions = [
    { value: 'SDM', label: 'คณะดิจิทัลมีเดีย' },
    { value: 'CA', label: 'คณะนิเทศศาสตร์' },
    { value: 'SOE', label: 'คณะวิศวกรรมศาสตร์' },
    { value: 'BUS', label: 'คณะบริหารธุรกิจ' },
    { value: 'SLA', label: 'คณะศิลปศาสตร์' },
    { value: 'LSC', label: 'วิทยาลัยโลจิสติกส์และซัพพลายเชน' },
    { value: 'CATH', label: 'วทบ. วิทยาลัยการบิน การท่องเที่ยวและการบริการ' },
    { value: 'ACC', label: 'คณะบัญชี' },
    { value: 'SIT', label: 'คณะเทคโนโลยีสารสนเทศ' },
    { value: 'LAW', label: 'คณะนิติศาสตร์' },
    { value: 'SODA', label: 'คณะการออกแบบและสถาปัตยกรรมศาสตร์' },
    { value: 'SE', label: 'คณะการสร้างเจ้าของธุรกิจ' },
    { value: 'SPUIC', label: 'International College' },
    { value: 'GCM', label: 'วิทยาลัยบัณฑิต' }
];

const departmentOptions = [
    { label: '-----กลุ่มอำนวยการกลาง-----' },
    { value: 'OOP', label: 'สำนักงานอธิการบดี' },
    { value: 'OQA', label: 'สำนักงานประกันคุณภาพ' },
    { value: 'OHR', label: 'สำนักงานบุคคล' },
    { value: 'OLA', label: 'สำนักงานกฎหมาย' },
    { value: 'OUC', label: 'สำนักงานสภามหาวิทยาลัย' },
    { value: 'OIA', label: 'สำนักงานผู้ตรวจสอบ' },
    { value: 'OIAA', label: 'สำนักงานวิเทศสัมพันธ์' },
    { value: 'CCECD', label: 'ศูนย์สหกิจศึกษาและพัฒนาอาชีพ' },
    { value: 'RPQA', label: 'ศูนย์ส่งเสริมการวิจัยและการประกันคุณภาพการศึกษา' },
    { value: 'LIB', label: 'สำนักหอสมุด' },
    { label: '-----กลุ่มงานมาตรฐานและบริการการศึกษา-----' },
    { value: 'OAA', label: 'สำนักงานวิชาการ' },
    { value: 'REG', label: 'สำนักงานทะเบียน' },
    { value: 'OOE', label: 'สำนักการจัดการศึกษาออนไลน์' },
    { value: 'CTLS', label: 'ศูนย์สนับสนุนและพัฒนาการเรียนการสอน' },
    { label: '-----กลุ่มงานกิจการนักศึกษา-----' },
    { value: 'SDCR', label: 'ศูนย์กิจกรรมพัฒนานักศึกษาและชุมชนสัมพันธ์' },
    { value: 'WCC', label: 'ศูนย์ให้คำปรึกษาสุขภาวะ' },
    { value: 'ACC', label: 'ศูนย์ศิลปวัฒนธรรม' },
    { value: 'OSO', label: 'สำนักงานการกีฬา' },
    { label: '-----กลุ่มงานการคลัง-----' },
    { value: 'OOF', label: 'สำนักงานการคลัง' },
    { value: 'PROC', label: 'สำนักงานพัสดุ' },
    { value: 'BKC', label: 'ศูนย์หนังสือ' },
    { label: '-----สำนักหรือหน่วยงานที่เทียบเท่าคณะ-----' },
    { value: 'OGE', label: 'สำนักวิชาศึกษาทั่วไป' },
    { value: 'USR', label: 'USR SPU' },
    { label: '-----กลุ่มงานกิจการสัมพันธ์-----' },
    { value: 'ADM', label: 'สำนักงานรับสมัคร' },
    { value: 'SCH', label: 'สำนักงานทุนการศึกษา' },    
    { value: 'OPR', label: 'สำนักงานประชาสัมพันธ์' },
    { value: 'ALU', label: 'ศูนย์ศิษย์เก่าสัมพันธ์' },
    { value: 'GAD', label: 'งานกราฟิกและศิลปกรรม' },
    { label: '-----หน่วยงานบริการวิชาแก่บุคคลภายนอก-----' },
    { value: 'BIC', label: 'ศูนย์บ่มเพาะธุรกิจ' },
    { value: 'ARC', label: 'ศูนย์วิทยบริการ' },
    { value: 'CICE', label: 'ศูนย์การศึกษาต่อเนื่องนานาชาติ' },  
    { label: '-----กลุ่มงานโครงสร้างพื้นฐาน-----' },
    { value: 'FACT', label: 'สำนักงานอาคารและสถานที่' },
    { value: 'ICT', label: 'ศูนย์เทคโนโลยีสารสนเทศและการสื่อสาร' },    
    { value: 'MEDIA', label: 'ศูนย์มีเดีย' },
    { value: 'PRINT', label: 'โรงพิมพ์' },   
    { label: '-----หน่วยงานอื่นๆ-----' },
    { value: 'SPUF', label: 'มูลนิธิมหาวิทยาลัยศรีปทุม' },
];

function populateSelectOptions(selectEl, options, placeholderText) {
    if (!selectEl) return;
    const placeholder = `<option value="">${placeholderText}</option>`;
    const body = options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');
    selectEl.innerHTML = placeholder + body;
}

function setSelectValueWithFallback(selectEl, value) {
    if (!selectEl) return;
    if (!value) {
        selectEl.value = '';
        return;
    }

    selectEl.value = String(value);
    if (selectEl.value !== String(value)) {
        const opt = document.createElement('option');
        opt.value = String(value);
        opt.textContent = String(value);
        selectEl.appendChild(opt);
        selectEl.value = String(value);
    }
}

function updateOrgFieldForIdType(idType, selectId, labelFor) {
    const selectEl = document.getElementById(selectId);
    const labelEl = document.querySelector(`label[for="${labelFor}"]`);
    if (!selectEl || !labelEl) return;

    const targetType = idType === 'employee' ? 'employee' : 'student';
    const isEmployee = targetType === 'employee';
    const placeholder = isEmployee ? 'เลือกแผนก' : 'เลือกคณะ';
    const options = isEmployee ? departmentOptions : collegeOptions;

    const prevType = selectEl.dataset.currentIdType || 'student';
    labelEl.textContent = isEmployee ? 'แผนก *' : 'คณะ *';

    // Only rebuild options when type flips to avoid losing selection unnecessarily
    if (prevType !== targetType) {
        const currentValue = selectEl.value;
        populateSelectOptions(selectEl, options, placeholder);
        selectEl.dataset.currentIdType = targetType;
        // Clear selection when switching groups
        setSelectValueWithFallback(selectEl, '');
        // Preserve value only if it exists in the new list
        if (currentValue && options.some(opt => String(opt.value) === String(currentValue))) {
            setSelectValueWithFallback(selectEl, currentValue);
        }
    }
}

function updateIdTypeIndicator() {
    const idInput = document.getElementById('patient-student-id');
    const studentFlag = document.getElementById('id-type-student');
    const employeeFlag = document.getElementById('id-type-employee');
    const hint = document.getElementById('id-type-hint');

    if (!idInput || !studentFlag || !employeeFlag) return;

    const normalized = (idInput.value || '').replace(/\D/g, '').slice(0, 8);
    if (normalized !== idInput.value) {
        idInput.value = normalized;
    }

    const idType = detectIdTypeFromValue(normalized);

    studentFlag.checked = idType === 'student';
    employeeFlag.checked = idType === 'employee';

    if (hint) {
        hint.textContent = formatIdTypeLabel(idType);
    }

    updateOrgFieldForIdType(idType, 'patient-college', 'patient-college');
}

function formatSymptomTypes(symptomTypes) {
    if (!symptomTypes) {
        return 'Not specified';
    }

    if (Array.isArray(symptomTypes)) {
        return symptomTypes.length ? symptomTypes.join(', ') : 'Not specified';
    }

    if (typeof symptomTypes === 'string') {
        const trimmed = symptomTypes.trim();
        if (!trimmed) return 'Not specified';
        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                return Array.isArray(parsed) && parsed.length ? parsed.join(', ') : 'Not specified';
            } catch (e) {
                return trimmed;
            }
        }
        return trimmed;
    }

    return 'Not specified';
}

function formatDateForInput(date) {
    const d = new Date(date);
    if (isNaN(d)) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function setDefaultCasesDate() {
    const input = document.getElementById('cases-date-filter');
    if (!input) return;
    const today = new Date();
    input.value = formatDateForInput(today);
}

function loadCasesByDate() {
    const tbody = document.getElementById('cases-table');
    const dateInput = document.getElementById('cases-date-filter');
    if (!tbody || !dateInput) return;

    const selectedDate = dateInput.value || formatDateForInput(new Date());
    if (!selectedDate) {
        tbody.innerHTML = '<tr><td colspan="9" class="no-data">เลือกวันที่เพื่อดูเคส</td></tr>';
        return;
    }

    const filtered = patients.filter(p => {
        if (!p.date) return false;
        const visitDate = formatDateForInput(p.date);
        return visitDate === selectedDate;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="no-data">ไม่มีเคสสำหรับวันที่เลือก</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(p => {
        return `
            <tr>
                <td>${p.studentId}</td>
                <td>${p.name}</td>
                <td>${p.gender}</td>
                <td>${p.college}</td>
                <td>${new Date(p.date).toLocaleString()}</td>
                <td>${formatSymptomTypes(p.symptomTypes)}</td>
                <td>${p.symptoms || '—'}</td>
                <td>${p.nurseName || '—'}</td>
                <td>${p.needsWard ? 'ใช่' : 'ไม่ใช่'}</td>
                <td>
                    <button class="btn btn-warning case-edit-btn" data-case-id="${p.caseId}" data-student-id="${p.studentId}">
                        <i class="fas fa-edit"></i> แก้ไข
                    </button>
                    <button class="btn btn-danger case-delete-btn" data-case-id="${p.caseId}">
                        <i class="fas fa-trash"></i> ลบ
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function addPatient() {
    const needsWard = document.getElementById('patient-needs-ward').checked;
    const gender = document.getElementById('patient-gender').value;
    const studentIdInput = document.getElementById('patient-student-id');
    const studentIdRaw = studentIdInput ? studentIdInput.value : '';
    const studentId = (studentIdRaw || '').replace(/\D/g, '').slice(0, 8);
    const idType = detectIdTypeFromValue(studentId);

    if (!idType) {
        alert('กรุณากรอกตัวเลข 7 หรือ 8 หลักสำหรับรหัสนักศึกษา/พนักงาน');
        updateIdTypeIndicator();
        return;
    }

    if (studentIdInput && studentIdInput.value !== studentId) {
        studentIdInput.value = studentId;
    }
    const symptomTypes = getSelectedSymptomTypes('symptom-type-group');

    const patient = {
        studentId: studentId,
        name: document.getElementById('patient-name').value,
        college: document.getElementById('patient-college').value,
        time: document.getElementById('patient-time').value,
        gender: gender,
        symptoms: document.getElementById('patient-symptoms').value,
        symptomTypes: symptomTypes,
        medicines: [...selectedMedicines], // Copy the selected medicines
        nurseName: document.getElementById('nurse-name').value,
        date: document.getElementById('patient-time').value ? new Date(document.getElementById('patient-time').value).toISOString() : new Date().toISOString(),
        status: 'Active'
    };

    // Update medicine stock
    selectedMedicines.forEach(med => {
        const medicineIndex = findMedicineIndexById(med.medicineId);
        if (medicineIndex !== -1) {
            medicines[medicineIndex].stock -= med.quantity;
        }
    });

    // Save to Google Sheets
    if (typeof savePatientToSheet === 'function') {
        savePatientToSheet(patient).then(result => {
            if (result.success) {
                // Don't push to local array - reload from sheets instead to get accurate data
                // patients.push(patient);

                // Update medicine stock in Google Sheets
                selectedMedicines.forEach(med => {
                    const medicine = findMedicineById(med.medicineId);
                    if (medicine && typeof updateMedicineInSheet === 'function') {
                        updateMedicineInSheet(medicine);
                    }
                });

                // Assign bed if ward is needed
                if (needsWard) {
                    assignBedByGender(studentId, gender);
                }

                document.getElementById('new-case-form').reset();
                
                // Restore nurse name after reset
                const nurseNameField = document.getElementById('nurse-name');
                if (nurseNameField && currentUser) {
                    nurseNameField.value = currentUser;
                }

                updateIdTypeIndicator();
                
                selectedMedicines = [];
                updateSelectedMedicinesList();
                
                // Reload patients from Google Sheets to ensure accurate data
                if (typeof loadPatientsFromSheet === 'function') {
                    loadPatientsFromSheet().then(() => {
                        loadPatients();
                        updateDashboard();
                    });
                } else {
                    loadPatients();
                    updateDashboard();
                }
                
                loadMedicines();

                alert('บันทึกเคสสำเร็จ!' + (needsWard ? ' ระบบจัดเตียงตามเพศแล้ว' : ''));
            } else {
                alert('บันทึกเคสไม่สำเร็จ: ' + result.message);
            }
        });
    }
}

// Show case confirmation modal
function showCaseConfirmation() {
    const studentId = document.getElementById('patient-student-id').value;
    const idType = detectIdTypeFromValue(studentId);
    const idTypeLabel = formatIdTypeLabel(idType);
    const name = document.getElementById('patient-name').value;
    const college = document.getElementById('patient-college').value;
    const time = document.getElementById('patient-time').value;
    const gender = document.getElementById('patient-gender').value;
    const symptoms = document.getElementById('patient-symptoms').value;
    const symptomTypes = getSelectedSymptomTypes('symptom-type-group');
    const needsWard = document.getElementById('patient-needs-ward').checked;
    const nurseName = document.getElementById('nurse-name').value;

    // Get college name from select
    const collegeSelect = document.getElementById('patient-college');
    const collegeName = collegeSelect.options[collegeSelect.selectedIndex].text;

    // Format medicines list
    let medicinesHTML = '';
    if (selectedMedicines.length > 0) {
        medicinesHTML = '<ul style="margin: 5px 0; padding-left: 20px;">';
        selectedMedicines.forEach(med => {
            const medicine = findMedicineById(med.medicineId);
            medicinesHTML += `<li>${medicine ? medicine.name : 'Unknown'} - Quantity: ${med.quantity}</li>`;
        });
        medicinesHTML += '</ul>';
    } else {
        medicinesHTML = '<p style="color: #999;">No medicines prescribed</p>';
    }

    // Format date and time
    const formattedDateTime = time ? new Date(time).toLocaleString() : 'Not specified';

    // Build confirmation content
    const confirmationHTML = `
        <div class="detail-row">
            <div class="detail-label">Student/Employee ID</div>
            <div class="detail-value">${studentId}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">ID Type</div>
            <div class="detail-value">${idTypeLabel}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Full Name</div>
            <div class="detail-value">${name}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">College</div>
            <div class="detail-value">${collegeName}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Date & Time</div>
            <div class="detail-value">${formattedDateTime}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Gender</div>
            <div class="detail-value">${gender}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Nurse Name</div>
            <div class="detail-value">${nurseName}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Chief Complaint/Symptoms</div>
            <div class="detail-value">${symptoms}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Symptom Type</div>
            <div class="detail-value">${symptomTypes.length ? symptomTypes.join(', ') : 'Not specified'}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Needs Ward</div>
            <div class="detail-value">${needsWard ? '<span style="color: #28a745;"><i class="fas fa-check"></i> Yes (Room will be assigned by gender)</span>' : '<span style="color: #999;">No</span>'}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Prescribed Medicines</div>
            <div class="detail-value">${medicinesHTML}</div>
        </div>
    `;

    document.getElementById('confirmation-details').innerHTML = confirmationHTML;
    document.getElementById('case-confirmation-modal').classList.add('show');
}

// Close case confirmation modal
function closeCaseConfirmation() {
    document.getElementById('case-confirmation-modal').classList.remove('show');
}

// Assign bed by gender - Room 1 for Male, Room 2 for Female
function assignBedByGender(patientId, gender) {
    // Determine room based on gender (Room 1 for Male, Room 2 for Female)
    let targetRoom;
    if (gender === 'Male') {
        targetRoom = 1;
    } else if (gender === 'Female') {
        targetRoom = 2;
    } else {
        // For "Other" gender, try to find any available bed
        targetRoom = null;
    }

    // Find available bed in the target room
    let availableBed;
    if (targetRoom) {
        availableBed = beds.find(bed => bed.status === 'available' && bed.room === targetRoom);
    } else {
        // For "Other" gender, find any available bed
        availableBed = beds.find(bed => bed.status === 'available');
    }

    if (!availableBed) {
        alert(`ไม่มีเตียงว่างใน${targetRoom ? 'ห้อง ' + targetRoom : 'ทุกห้อง'} กรุณาจัดเตียงด้วยตนเอง`);
        return;
    }

    // Assign the patient to the bed
    const bedIndex = beds.findIndex(b => b.id === availableBed.id);
    beds[bedIndex].status = 'occupied';
    beds[bedIndex].patient = patientId;
    beds[bedIndex].admissionDate = new Date().toISOString();
    beds[bedIndex].notes = 'ระบบจัดเตียงอัตโนมัติตามเพศ';

    // Update bed in Google Sheets
    if (typeof updateBedInSheet === 'function') {
        updateBedInSheet(beds[bedIndex]);
    }

    loadBeds();
}

// Auto-fill patient information based on Student ID
async function searchStudentInfo() {
    const idInput = document.getElementById('patient-student-id');
    const studentId = (idInput ? idInput.value : '').replace(/\D/g, '').slice(0, 8);
    const idType = detectIdTypeFromValue(studentId);

    if (idInput && idInput.value !== studentId) {
        idInput.value = studentId;
    }

    updateIdTypeIndicator();

    if (!studentId) {
        alert('กรุณากรอกหมายเลขรหัสนักศึกษา/พนักงาน');
        return;
    }

    if (!idType) {
        alert('กรุณากรอกตัวเลข 7 หรือ 8 หลัก (7 = พนักงาน, 8 = นักศึกษา)');
        return;
    }

    // Show loading indicator
    if (typeof showLoading === 'function') {
        showLoading();
    }

    try {
        // Reload data from Google Sheets to ensure we have the latest data
        if (typeof loadPatientsFromSheet === 'function') {
            await loadPatientsFromSheet();
        }

        // Find the most recent patient with this student ID
        const matchingPatients = patients.filter(p => {
            // Convert both to strings and trim whitespace for comparison
            const patientId = String(p.studentId || '').trim();
            const searchId = String(studentId).trim();
            return patientId === searchId;
        });

        const existingPatient = matchingPatients.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

        if (existingPatient) {
            // Show confirmation modal with existing information
            showStudentSearchModal(existingPatient);
        } else {
            alert('ไม่พบบันทึกสำหรับรหัสนักศึกษานี้ กรุณากรอกข้อมูลด้วยตนเอง');
        }
    } catch (error) {
        console.error('Error searching for student:', error);
        alert('เกิดข้อผิดพลาดระหว่างค้นหา กรุณาลองใหม่');
    } finally {
        // Hide loading indicator
        if (typeof hideLoading === 'function') {
            hideLoading();
        }
    }
}

function showStudentSearchModal(patient) {
    const modal = document.getElementById('student-search-modal');
    const idType = patient.idType || detectIdTypeFromValue(patient.studentId);

    // Align confirm modal org select with student/employee context
    updateOrgFieldForIdType(idType, 'confirm-student-college', 'confirm-student-college');

    // Fill the modal with existing patient information
    document.getElementById('confirm-student-name').value = patient.name || '';
    setSelectValueWithFallback(document.getElementById('confirm-student-college'), patient.college || '');
    document.getElementById('confirm-student-gender').value = patient.gender || '';

    modal.classList.add('show');
}

function closeStudentSearchModal() {
    const modal = document.getElementById('student-search-modal');
    modal.classList.remove('show');
}

function confirmStudentInfo() {
    // Get values from the confirmation modal
    const name = document.getElementById('confirm-student-name').value;
    const college = document.getElementById('confirm-student-college').value;
    const gender = document.getElementById('confirm-student-gender').value;
    const idType = detectIdTypeFromValue(document.getElementById('patient-student-id').value);

    // Validate fields
    if (!name || !college || !gender) {
        alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบ');
        return;
    }

    // Fill the main form with confirmed/edited information
    document.getElementById('patient-name').value = name;
    updateOrgFieldForIdType(idType, 'patient-college', 'patient-college');
    setSelectValueWithFallback(document.getElementById('patient-college'), college);
    document.getElementById('patient-gender').value = gender;

    // Keep the indicator in sync after autofill
    updateIdTypeIndicator();

    // Add visual feedback to show fields were filled
    const nameField = document.getElementById('patient-name');
    const collegeField = document.getElementById('patient-college');
    const genderField = document.getElementById('patient-gender');

    [nameField, collegeField, genderField].forEach(field => {
        field.style.transition = 'background-color 0.3s';
        field.style.backgroundColor = '#e8f5e9';
        setTimeout(() => {
            field.style.backgroundColor = '';
        }, 1000);
    });

    // Close the modal
    closeStudentSearchModal();
}

function loadPatients() {
    const tbody = document.getElementById('patients-table');

    if (patients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">ยังไม่มีการลงทะเบียน</td></tr>';
        return;
    }

    const recentPatients = getUniquePatients()
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10);

    tbody.innerHTML = recentPatients.map(patient => {
        const escapedStudentId = String(patient.studentId).replace(/'/g, "\\'");
        const escapedCaseId = String(patient.caseId || patient.studentId).replace(/'/g, "\\'");
        return `
        <tr>
            <td>${patient.studentId}</td>
            <td>${patient.name}</td>
            <td>${patient.gender}</td>
            <td>${new Date(patient.date).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-info" onclick="viewPatientCase('${escapedCaseId}', '${escapedStudentId}')">
                    <i class="fas fa-eye"></i> ดูรายละเอียด
                </button>
                <button class="btn btn-danger" onclick="deletePatient('${escapedStudentId}')">
                    <i class="fas fa-trash"></i> ลบ
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

// View patient case details
function viewPatientCase(caseId, studentId) {
    // Find the specific case
    const patientCase = patients.find(p => String(p.caseId) === String(caseId) && String(p.studentId) === String(studentId));
    if (!patientCase) {
        console.error('Patient case not found:', caseId, studentId);
        return;
    }

    // Get all visits for this student (all records with same studentId)
    const allVisits = patients
        .filter(p => String(p.studentId) === String(studentId))
        .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date, newest first

    // Display basic patient info
    document.getElementById('patient-basic-info').innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
            <div>
                <strong style="color: #667eea;">รหัสนักศึกษา:</strong> ${patientCase.studentId}
            </div>
            <div>
                <strong style="color: #667eea;">ชื่อ-นามสกุล:</strong> ${patientCase.name}
            </div>
            <div>
                <strong style="color: #667eea;">คณะ:</strong> ${patientCase.college}
            </div>
            <div>
                <strong style="color: #667eea;">เพศ:</strong> ${patientCase.gender}
            </div>
        </div>
    `;

    // Create tabs for each visit
    const tabsHTML = allVisits.map((visit, index) => {
        const isActive = String(visit.caseId) === String(caseId);
        const visitNumber = allVisits.length - index;
        return `
            <button class="visit-tab ${isActive ? 'active' : ''}" onclick="switchVisitTab('${visit.caseId}')">
                ครั้งที่ ${visitNumber}
                <span class="tab-date">${new Date(visit.date).toLocaleDateString()}</span>
            </button>
        `;
    }).join('');

    document.getElementById('patient-visit-tabs').innerHTML = tabsHTML;

    // Create content for each visit
    const contentHTML = allVisits.map((visit, index) => {
        const isActive = String(visit.caseId) === String(caseId);
        const visitNumber = allVisits.length - index;

        // Parse medicines
        let medicinesHTML = '<div class="no-medicines">ไม่มีรายการยาที่สั่งจ่าย</div>';
        if (visit.medicines && visit.medicines.length > 0) {
            medicinesHTML = visit.medicines.map(med => {
                const medicine = findMedicineById(med.medicineId);
                return `
                    <div class="medicine-item">
                        <strong>${medicine ? medicine.name : 'ไม่ทราบชื่อยา'}</strong>
                        <div>จำนวน: ${med.quantity}</div>
                    </div>
                `;
            }).join('');
        } else if (typeof visit.medicines === 'string') {
            // Handle string format (legacy data)
            medicinesHTML = `<div class="medicine-item">${visit.medicines}</div>`;
        }

        return `
            <div class="visit-page ${isActive ? 'active' : ''}" id="visit-${visit.caseId}">
                <h3 style="color: #667eea; margin-bottom: 20px;">รายละเอียดการมาครั้งที่ ${visitNumber}</h3>
                
                <div class="visit-detail-row">
                    <div class="visit-detail-label">วันและเวลาที่มารับบริการ</div>
                    <div class="visit-detail-value">${new Date(visit.date).toLocaleString()}</div>
                </div>
                
                <div class="visit-detail-row">
                    <div class="visit-detail-label">ชื่อพยาบาล</div>
                    <div class="visit-detail-value">${visit.nurseName || 'ไม่มีข้อมูล'}</div>
                </div>
                
                <div class="visit-detail-row">
                    <div class="visit-detail-label">ประเภทอาการ</div>
                    <div class="visit-detail-value">${formatSymptomTypes(visit.symptomTypes)}</div>
                </div>
                
                <div class="visit-detail-row">
                    <div class="visit-detail-label">อาการสำคัญ</div>
                    <div class="visit-detail-value">${visit.symptoms || 'ไม่มีข้อมูลอาการ'}</div>
                </div>
                
                <div class="visit-detail-row">
                    <div class="visit-detail-label">รายการยาที่สั่งจ่าย</div>
                    <div class="visit-detail-value">
                        ${medicinesHTML}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('patient-visit-content').innerHTML = contentHTML;
    document.getElementById('patient-details-modal').classList.add('show');
}

// Switch between visit tabs
function switchVisitTab(caseId) {
    // Remove active class from all tabs and pages
    document.querySelectorAll('.visit-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.visit-page').forEach(page => page.classList.remove('active'));

    // Add active class to selected tab and page
    const selectedTab = Array.from(document.querySelectorAll('.visit-tab')).find(tab =>
        tab.getAttribute('onclick').includes(caseId)
    );
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    const selectedPage = document.getElementById(`visit-${caseId}`);
    if (selectedPage) {
        selectedPage.classList.add('active');
    }
}

async function deletePatient(studentId) {
    if (confirm('ยืนยันลบผู้ป่วยคนนี้หรือไม่?')) {
        if (typeof deletePatientFromSheet === 'function') {
            try {
                const result = await deletePatientFromSheet(studentId);
                if (result.success) {
                    // Reload data from Google Sheets to ensure sync
                    if (typeof loadPatientsFromSheet === 'function') {
                        await loadPatientsFromSheet();
                    } else {
                        patients = patients.filter(p => p.studentId !== studentId);
                    }

                    // Refresh all patient displays
                    loadPatients();
                    loadAllPatients();
                    updateDashboard();
                    alert('ลบผู้ป่วยเรียบร้อยแล้ว');
                } else {
                    alert('ลบผู้ป่วยไม่สำเร็จ: ' + result.message);
                }
            } catch (error) {
                console.error('Error deleting patient:', error);
                alert('เกิดข้อผิดพลาดระหว่างลบผู้ป่วย');
            }
        }
    }
}

// Load all patients for Patients page
function loadAllPatients() {
    const tbody = document.getElementById('all-patients-table');

    if (patients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">ยังไม่มีการลงทะเบียน</td></tr>';
        return;
    }

    // Show unique patients (latest visit) sorted by date (newest first)
    const sortedPatients = getUniquePatients().sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = sortedPatients.map(patient => {
        const escapedStudentId = String(patient.studentId).replace(/'/g, "\\'");
        const escapedCaseId = String(patient.caseId || patient.studentId).replace(/'/g, "\\'");
        return `
        <tr>
            <td>${patient.studentId}</td>
            <td>${patient.name}</td>
            <td>${patient.college}</td>
            <td>${patient.gender}</td>
            <td>${new Date(patient.date).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-danger" onclick="deletePatient('${escapedStudentId}')">
                    <i class="fas fa-trash"></i> ลบ
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

// Filter patients based on search
function filterPatients(searchTerm) {
    const tbody = document.getElementById('all-patients-table');

    if (!searchTerm || searchTerm.trim() === '') {
        loadAllPatients();
        return;
    }

    const term = searchTerm.toLowerCase();
    const filteredPatients = getUniquePatients().filter(patient =>
        patient.studentId.toLowerCase().includes(term) ||
        patient.name.toLowerCase().includes(term) ||
        patient.college.toLowerCase().includes(term)
    );

    if (filteredPatients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">ไม่พบผู้ป่วยที่ตรงกับการค้นหา</td></tr>';
        return;
    }

    const sortedPatients = [...filteredPatients].sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = sortedPatients.map(patient => {
        const escapedStudentId = String(patient.studentId).replace(/'/g, "\\'");
        return `
        <tr>
            <td>${patient.studentId}</td>
            <td>${patient.name}</td>
            <td>${patient.college}</td>
            <td>${patient.gender}</td>
            <td>${new Date(patient.date).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-danger" onclick="deletePatient('${escapedStudentId}')">
                    <i class="fas fa-trash"></i> ลบ
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

// Open edit patient modal
function openEditPatientModal(caseId, studentId) {
    // Find the specific case
    const patientCase = patients.find(p => String(p.caseId) === String(caseId) && String(p.studentId) === String(studentId));
    if (!patientCase) {
        console.error('Patient case not found:', caseId, studentId);
        return;
    }

    // Seed edit medicine selection
    editSelectedMedicines = patientCase.medicines ? JSON.parse(JSON.stringify(patientCase.medicines)) : [];

    // Store both caseId and studentId for the save function
    document.getElementById('edit-patient-original-id').value = studentId;
    document.getElementById('edit-patient-case-id').value = caseId;
    document.getElementById('edit-patient-student-id').value = patientCase.studentId;
    document.getElementById('edit-patient-name').value = patientCase.name;
    const existingIdType = patientCase.idType || detectIdTypeFromValue(patientCase.studentId);
    updateOrgFieldForIdType(existingIdType, 'edit-patient-college', 'edit-patient-college');
    setSelectValueWithFallback(document.getElementById('edit-patient-college'), patientCase.college);
    document.getElementById('edit-patient-gender').value = patientCase.gender;
    document.getElementById('edit-patient-symptoms').value = patientCase.symptoms;
    setSymptomTypeSelections('edit-symptom-type-group', patientCase.symptomTypes);

    updateEditSelectedMedicinesList();

    document.getElementById('edit-patient-modal').classList.add('show');
}

// Close edit patient modal
function closeEditPatientModal() {
    document.getElementById('edit-patient-modal').classList.remove('show');
    document.getElementById('edit-patient-form').reset();
}

// Save patient edits
async function savePatientEdits() {
    const caseId = document.getElementById('edit-patient-case-id').value;
    const studentId = document.getElementById('edit-patient-original-id').value;
    const patientIndex = patients.findIndex(p => String(p.caseId) === String(caseId) && String(p.studentId) === String(studentId));

    if (patientIndex === -1) {
        alert('ไม่พบข้อมูลเคสของผู้ป่วย');
        return;
    }

    // Get updated values
    const updatedName = document.getElementById('edit-patient-name').value;
    const updatedCollege = document.getElementById('edit-patient-college').value;
    const updatedGender = document.getElementById('edit-patient-gender').value;
    const updatedSymptoms = document.getElementById('edit-patient-symptoms').value;
    const updatedSymptomTypes = getSelectedSymptomTypes('edit-symptom-type-group');
    const existingIdType = patientCase.idType || detectIdTypeFromValue(patientCase.studentId);

    // Preserve old medicines for stock adjustments
    const patientCase = patients[patientIndex];
    const oldMedicines = Array.isArray(patientCase.medicines) ? patientCase.medicines : [];
    const newMedicines = editSelectedMedicines;

    try {
        // Update patient basic info in Patients sheet
        const patientData = {
            studentId: studentId,
            idType: existingIdType,
            name: updatedName,
            college: updatedCollege,
            gender: updatedGender
        };

        if (typeof updatePatientInSheet === 'function') {
            const patientResult = await updatePatientInSheet(patientData);
            if (!patientResult.success) {
                alert('อัปเดตข้อมูลผู้ป่วยไม่สำเร็จ: ' + patientResult.message);
                return;
            }
        }

        // Update case symptoms in Cases sheet
        const caseData = {
            caseId: caseId,
            idType: existingIdType,
            symptoms: updatedSymptoms,
            symptomTypes: updatedSymptomTypes,
            medicines: newMedicines
        };

        if (typeof updateCaseInSheet === 'function') {
            const caseResult = await updateCaseInSheet(caseData);
            if (!caseResult.success) {
                alert('อัปเดตอาการไม่สำเร็จ: ' + caseResult.message);
                return;
            }
        }

        // Adjust medicine stock based on differences
        if (typeof loadMedicinesFromSheet === 'function') {
            await loadMedicinesFromSheet();
        }

        const diffMap = new Map();
        oldMedicines.forEach(m => {
            diffMap.set(m.medicineId, (diffMap.get(m.medicineId) || 0) - (Number(m.quantity) || 0));
        });
        newMedicines.forEach(m => {
            diffMap.set(m.medicineId, (diffMap.get(m.medicineId) || 0) + (Number(m.quantity) || 0));
        });

        for (const [medId, diffQty] of diffMap.entries()) {
            if (!diffQty) continue;
            const idx = findMedicineIndexById(medId);
            if (idx !== -1) {
                medicines[idx].stock = (Number(medicines[idx].stock) || 0) - diffQty; // subtract diff; if diff positive, reduce stock, if negative, increase
                if (typeof updateMedicineInSheet === 'function') {
                    updateMedicineInSheet(medicines[idx]);
                }
            }
        }

        // Reload data from Google Sheets to ensure sync
        if (typeof loadPatientsFromSheet === 'function') {
            await loadPatientsFromSheet();
        }

        loadMedicines();

        closeEditPatientModal();
        loadAllPatients();
        loadPatients();
        updateDashboard();
        alert('อัปเดตข้อมูลผู้ป่วยเรียบร้อยแล้ว');

    } catch (error) {
        console.error('Error updating patient:', error);
        alert('เกิดข้อผิดพลาดระหว่างอัปเดตข้อมูลผู้ป่วย');
    }
}

function closePatientModal() {
    document.getElementById('patient-details-modal').classList.remove('show');
}

// Medicine Management
function openMedicineModal(medicine = null) {
    if (medicine) {
        document.getElementById('medicine-modal-title').textContent = 'แก้ไขยา';
        document.getElementById('medicine-id').value = medicine.id;
        document.getElementById('medicine-name').value = medicine.name;
        document.getElementById('medicine-category').value = medicine.category;
        document.getElementById('medicine-unit').value = medicine.unit || 'Piece';
        document.getElementById('medicine-stock').value = medicine.stock;
    } else {
        document.getElementById('medicine-modal-title').textContent = 'เพิ่มยา';
        document.getElementById('medicine-form').reset();
        document.getElementById('medicine-id').value = '';
        document.getElementById('medicine-unit').value = '';
    }

    document.getElementById('medicine-modal').classList.add('show');
}

function closeMedicineModal() {
    document.getElementById('medicine-modal').classList.remove('show');
    document.getElementById('medicine-form').reset();
}

function saveMedicine() {
    const id = document.getElementById('medicine-id').value;
    const medicine = {
        id: id || 'M' + String(medicines.length + 1).padStart(4, '0'),
        name: document.getElementById('medicine-name').value,
        category: document.getElementById('medicine-category').value,
        unit: document.getElementById('medicine-unit').value || 'Piece',
        stock: parseInt(document.getElementById('medicine-stock').value)
    };

    if (id) {
        // Update existing medicine
        const index = findMedicineIndexById(id);
        medicines[index] = medicine;

        if (typeof updateMedicineInSheet === 'function') {
            updateMedicineInSheet(medicine).then(result => {
                if (result.success) {
                    closeMedicineModal();
                    loadMedicines();
                    updateDashboard();
                    alert('อัปเดตข้อมูลยาสำเร็จ');
                } else {
                    alert('อัปเดตข้อมูลยาไม่สำเร็จ: ' + result.message);
                }
            });
        }
    } else {
        // Add new medicine
        medicines.push(medicine);

        if (typeof saveMedicineToSheet === 'function') {
            saveMedicineToSheet(medicine).then(result => {
                if (result.success) {
                    closeMedicineModal();
                    loadMedicines();
                    updateDashboard();
                    alert('เพิ่มยาสำเร็จ');
                } else {
                    alert('เพิ่มยาไม่สำเร็จ: ' + result.message);
                }
            });
        }
    }
}

function loadMedicines() {
    const container = document.getElementById('inventory-categories');

    // Keep local cache normalized so ID comparisons remain reliable
    medicines = medicines.map(normalizeMedicineRecord);

    if (medicines.length === 0) {
        container.innerHTML = '<p class="no-data">ยังไม่มียาในคลัง</p>';
        return;
    }

    // Define category display names
    const categoryNames = {
        'Painkiller': 'ยาแก้ปวด / ลดไข้',
        'Antihistamine': 'ยาแก้แพ้ / ลดน้ำมูก',
        'ColdMedicine': 'ยาแก้หวัด',
        'Antacid': 'ยาแก้ไอ / ขับเสมหะ และยาอม',
        'Antiseptic': 'ยาขับลม',
        'Antibiotic': 'ยาแก้เวียนศีรษะ / คลื่นไส้ / อาเจียน',
        'MuscleRelaxant': 'ยาลดอาการปวดเกร็ง',
        'Antidiarrheal': 'ยาแก้ท้องเสีย',
        'Lozenge': 'ยาอม',
        'Topical': 'ยาใช้ภายนอก',
        'Dressing': 'อุปกรณ์ทำแผล',
        'Other': 'อื่นๆ'
    };

    // Group medicines by category
    const medicinesByCategory = {};
    medicines.forEach(medicine => {
        const category = medicine.category || 'Other';
        if (!medicinesByCategory[category]) {
            medicinesByCategory[category] = [];
        }
        medicinesByCategory[category].push(medicine);
    });

    // Sort categories
    const sortedCategories = Object.keys(medicinesByCategory).sort();

    // Generate HTML for each category
    container.innerHTML = sortedCategories.map(category => {
        const categoryMedicines = medicinesByCategory[category];
        const displayName = categoryNames[category] || category;

        return `
            <div class="medicine-category-section">
                <h3 class="category-header">
                    <i class="fas fa-capsules"></i> ${displayName}
                    <span class="category-count">(${categoryMedicines.length} items)</span>
                </h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Unit</th>
                                <th>Stock</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${categoryMedicines.map(medicine => {
                                const status = getStockStatus(medicine.stock);
                                return `
                                    <tr>
                                        <td>${medicine.name}</td>
                                        <td>${medicine.unit || 'Piece'}</td>
                                        <td>${formatNumber(medicine.stock)}</td>
                                        <td>
                                            <span class="status ${status.class}">
                                                ${status.text}
                                            </span>
                                        </td>
                                        <td>
                                            <button class="btn btn-info" onclick='editMedicine(${JSON.stringify(medicine)})'>
                                                <i class="fas fa-edit"></i> Edit
                                            </button>
                                            <button class="btn btn-danger" onclick="deleteMedicine('${medicine.id}')">
                                                <i class="fas fa-trash"></i> Delete
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }).join('');
}

function formatNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toLocaleString('en-US') : value;
}

function getStockStatus(stock) {
    if (stock === 0) return { text: 'หมดสต็อก', class: 'critical' };
    if (stock < 10) return { text: 'สต็อกต่ำ', class: 'low' };
    return { text: 'มีสต็อก', class: 'available' };
}

// Returns unique patients keyed by studentId, keeping the latest case
function getUniquePatients() {
    const map = new Map();
    patients.forEach(p => {
        const existing = map.get(p.studentId);
        if (!existing || new Date(p.date) > new Date(existing.date)) {
            map.set(p.studentId, p);
        }
    });
    return Array.from(map.values());
}

function editMedicine(medicine) {
    openMedicineModal(medicine);
}

function deleteMedicine(id) {
    if (confirm('Are you sure you want to delete this medicine?')) {
        if (typeof deleteMedicineFromSheet === 'function') {
            deleteMedicineFromSheet(id).then(result => {
                if (result.success) {
                    medicines = medicines.filter(m => m.id !== id);
                    loadMedicines();
                    updateDashboard();
                    alert('Medicine deleted successfully!');
                } else {
                    alert('Error deleting medicine: ' + result.message);
                }
            });
        }
    }
}

// Bed Management
function addNewBed() {
    // Prompt user to select room
    const room = prompt('Enter room number (1 or 2):');

    if (!room || (room !== '1' && room !== '2')) {
        alert('Please enter a valid room number (1 or 2)');
        return;
    }

    const bedNumber = beds.length + 1;
    const bed = {
        id: 'B' + String(bedNumber).padStart(3, '0'),
        number: bedNumber,
        room: parseInt(room),
        status: 'available',
        patient: null,
        admissionDate: null,
        notes: ''
    };

    if (typeof saveBedToSheet === 'function') {
        saveBedToSheet(bed).then(result => {
            if (result.success) {
                beds.push(bed);
                loadBeds();
                updateDashboard();
                alert('Bed added successfully!');
            } else {
                alert('Error adding bed: ' + result.message);
            }
        });
    }
}

function loadBeds() {
    const room1Grid = document.getElementById('room1-beds-grid');
    const room2Grid = document.getElementById('room2-beds-grid');

    // Filter beds by room
    const room1Beds = beds.filter(bed => bed.room === 1);
    const room2Beds = beds.filter(bed => bed.room === 2);

    // Function to generate bed cards HTML
    const generateBedsHTML = (bedsArray) => {
        if (bedsArray.length === 0) {
            return '<div class="no-data-message">No beds in this room</div>';
        }

        return bedsArray.map(bed => {
            const patient = bed.patient ? patients.find(p => p.studentId === bed.patient) : null;

            return `
                <div class="bed-card ${bed.status}">
                    <div class="bed-header">
                        <div class="bed-number">Bed ${bed.number}</div>
                        <span class="status ${bed.status}">${bed.status.toUpperCase()}</span>
                    </div>
                    <div class="bed-info">
                        ${bed.status === 'occupied' && patient ? `
                            <p><strong>Patient:</strong> ${patient.name}</p>
                            <p><strong>Student ID:</strong> ${patient.studentId}</p>
                            <p><strong>Admitted:</strong> ${new Date(bed.admissionDate).toLocaleString()}</p>
                            ${bed.notes ? `<p><strong>Notes:</strong> ${bed.notes}</p>` : ''}
                        ` : '<p>No patient assigned</p>'}
                    </div>
                    <div class="bed-actions">
                        ${bed.status === 'occupied' ? `
                            <button class="btn btn-info" onclick="viewBedPatient('${bed.patient}')">
                                <i class="fas fa-eye"></i> View
                            </button>
                            <button class="btn btn-danger" onclick="dischargeBed('${bed.id}')">
                                <i class="fas fa-sign-out-alt"></i> Discharge
                            </button>
                        ` : ''}
                        <button class="btn btn-danger" onclick="deleteBed('${bed.id}')">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    };

    // Load beds for each room
    room1Grid.innerHTML = generateBedsHTML(room1Beds);
    room2Grid.innerHTML = generateBedsHTML(room2Beds);
}

function openBedModal(bedId) {
    document.getElementById('bed-id').value = bedId;

    // Populate patient select
    const select = document.getElementById('bed-patient');
    select.innerHTML = '<option value="">Select Patient</option>' +
        patients.filter(p => p.status === 'Active').map(patient =>
            `<option value="${patient.studentId}">${patient.name} (${patient.studentId})</option>`
        ).join('');

    // Set current date and time
    const now = new Date();
    const dateString = now.toISOString().slice(0, 16);
    document.getElementById('bed-admission-date').value = dateString;

    document.getElementById('bed-modal').classList.add('show');
}

function closeBedModal() {
    document.getElementById('bed-modal').classList.remove('show');
    document.getElementById('bed-form').reset();
}

function assignBed() {
    const bedId = document.getElementById('bed-id').value;
    const patientId = document.getElementById('bed-patient').value;
    const admissionDate = document.getElementById('bed-admission-date').value;
    const notes = document.getElementById('bed-notes').value;

    const bedIndex = beds.findIndex(b => b.id === bedId);
    beds[bedIndex].status = 'occupied';
    beds[bedIndex].patient = patientId;
    beds[bedIndex].admissionDate = admissionDate;
    beds[bedIndex].notes = notes;

    if (typeof updateBedInSheet === 'function') {
        updateBedInSheet(beds[bedIndex]).then(result => {
            if (result.success) {
                closeBedModal();
                loadBeds();
                updateDashboard();
                alert('Bed assigned successfully!');
            } else {
                alert('Error assigning bed: ' + result.message);
            }
        });
    }
}

function dischargeBed(bedId) {
    if (confirm('Are you sure you want to discharge this patient?')) {
        const bedIndex = beds.findIndex(b => b.id === bedId);
        beds[bedIndex].status = 'available';
        beds[bedIndex].patient = null;
        beds[bedIndex].admissionDate = null;
        beds[bedIndex].notes = '';

        if (typeof updateBedInSheet === 'function') {
            updateBedInSheet(beds[bedIndex]).then(result => {
                if (result.success) {
                    loadBeds();
                    updateDashboard();
                    alert('Patient discharged successfully!');
                } else {
                    alert('Error discharging patient: ' + result.message);
                }
            });
        }
    }
}

function viewBedPatient(patientId) {
    // Find the patient's most recent case
    const patientCases = patients.filter(p => String(p.studentId) === String(patientId));
    if (patientCases.length > 0) {
        const mostRecentCase = patientCases.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        viewPatientCase(mostRecentCase.caseId, patientId);
    }
}

function deleteBed(bedId) {
    if (confirm('Are you sure you want to remove this bed?')) {
        if (typeof deleteBedFromSheet === 'function') {
            deleteBedFromSheet(bedId).then(result => {
                if (result.success) {
                    beds = beds.filter(b => b.id !== bedId);
                    // Renumber beds
                    beds.forEach((bed, index) => {
                        bed.number = index + 1;
                        bed.id = 'B' + String(index + 1).padStart(3, '0');
                    });

                    // Update all renumbered beds in Google Sheets
                    const updatePromises = beds.map(bed => {
                        if (typeof updateBedInSheet === 'function') {
                            return updateBedInSheet(bed);
                        }
                        return Promise.resolve({ success: true });
                    });

                    Promise.all(updatePromises).then(() => {
                        loadBeds();
                        updateDashboard();
                        alert('Bed removed successfully!');
                    });
                } else {
                    alert('Error removing bed: ' + result.message);
                }
            });
        }
    }
}

// Dashboard
function updateDashboard() {
    // Update stats
    document.getElementById('total-patients').textContent = patients.length;

    const occupiedBeds = beds.filter(b => b.status === 'occupied').length;
    document.getElementById('occupied-beds').textContent = `${occupiedBeds}/${beds.length}`;

    document.getElementById('total-medicines').textContent = medicines.length;

    const lowStock = medicines.filter(m => m.stock < 10).length;
    document.getElementById('low-stock').textContent = lowStock;

    // Calculate today's cases
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCases = patients.filter(patient => {
        const patientDate = new Date(patient.date);
        patientDate.setHours(0, 0, 0, 0);
        return patientDate.getTime() === today.getTime();
    }).length;
    document.getElementById('today-cases').textContent = todayCases;

    // Update recent patients
    const recentPatientsTable = document.getElementById('recent-patients-table');
    const recentPatients = patients.slice(-5).reverse();

    if (recentPatients.length === 0) {
        recentPatientsTable.innerHTML = '<tr><td colspan="3" class="no-data">No patients yet</td></tr>';
    } else {
        recentPatientsTable.innerHTML = recentPatients.map(patient => `
            <tr>
                <td>${patient.studentId}</td>
                <td>${patient.name}</td>
                <td>${new Date(patient.date).toLocaleDateString()}</td>
            </tr>
        `).join('');
    }

    // Update low stock medicines
    const lowStockTable = document.getElementById('low-stock-table');
    const lowStockMedicines = medicines.filter(m => m.stock < 10);

    if (lowStockMedicines.length === 0) {
        lowStockTable.innerHTML = '<tr><td colspan="3" class="no-data">All medicines in stock</td></tr>';
    } else {
        lowStockTable.innerHTML = lowStockMedicines.map(medicine => {
            const status = getStockStatus(medicine.stock);
            return `
                <tr>
                    <td>${medicine.name}</td>
                    <td>${formatNumber(medicine.stock)}</td>
                    <td><span class="status ${status.class}">${status.text}</span></td>
                </tr>
            `;
        }).join('');
    }
}

// Load all data
function loadData() {
    loadPatients();
    loadMedicines();
    loadBeds();
}

function getCategoryDisplayName(category) {
    const map = {
        Painkiller: 'ยาแก้ปวด / ลดไข้',
        Antihistamine: 'ยาแก้แพ้ / ลดน้ำมูก',
        ColdMedicine: 'ยาแก้หวัด',
        Antacid: 'ยาลดกรด / ทางเดินอาหาร / แก้ไอ',
        Antiseptic: 'ยาขับลม',
        Antibiotic: 'ยาแก้เวียนศีรษะ / คลื่นไส้ / อาเจียน',
        MuscleRelaxant: 'ยาลดอาการปวดเกร็ง',
        Antidiarrheal: 'ยาแก้ท้องเสีย',
        Lozenge: 'ยาอม',
        Topical: 'ยาใช้ภายนอก',
        Dressing: 'อุปกรณ์ทำแผล',
        Other: 'อื่นๆ'
    };
    return map[category] || category;
}

// Medicine Selection for New Case
function openMedicineSelectionModal(context = 'new') {
    medicineSelectionContext = context;
    const select = document.getElementById('select-medicine');

    // Ensure we are working with normalized records from the latest cache
    medicines = medicines.map(normalizeMedicineRecord);

    // Filter medicines that have stock
    const availableMedicines = medicines.filter(m => (Number(m.stock) || 0) > 0);

    if (availableMedicines.length === 0) {
        alert('No medicines available in inventory. Please add medicines first.');
        return;
    }

    // Group medicines by category
    const medicinesByCategory = {};
    availableMedicines.forEach(medicine => {
        if (!medicinesByCategory[medicine.category]) {
            medicinesByCategory[medicine.category] = [];
        }
        medicinesByCategory[medicine.category].push(medicine);
    });

    // Build select options with optgroups by category
    let optionsHTML = '<option value="">Select Medicine</option>';
    Object.keys(medicinesByCategory).sort().forEach(category => {
        const displayLabel = getCategoryDisplayName(category);
        optionsHTML += `<optgroup label="${displayLabel}">`;
        medicinesByCategory[category].forEach(medicine => {
            optionsHTML += `<option value="${medicine.id}">${medicine.name} (Stock: ${formatNumber(medicine.stock)})</option>`;
        });
        optionsHTML += '</optgroup>';
    });

    select.innerHTML = optionsHTML;

    document.getElementById('medicine-quantity').value = '';
    document.getElementById('medicine-selection-modal').classList.add('show');
}

function closeMedicineSelectionModal() {
    document.getElementById('medicine-selection-modal').classList.remove('show');
}

function addMedicineToCase() {
    const medicineId = document.getElementById('select-medicine').value;
    const quantity = parseInt(document.getElementById('medicine-quantity').value);

    if (!medicineId || !quantity || quantity <= 0) {
        alert('Please select a medicine and enter a valid quantity.');
        return;
    }

    const medicine = findMedicineById(medicineId);

    if (!medicine) {
        alert('Medicine not found. Please refresh the inventory.');
        return;
    }

    if (quantity > medicine.stock) {
        alert(`Not enough stock. Available: ${formatNumber(medicine.stock)}`);
        return;
    }

    const targetList = medicineSelectionContext === 'edit' ? editSelectedMedicines : selectedMedicines;

    // Check if medicine already selected
    const existingIndex = targetList.findIndex(m => m.medicineId === medicineId);
    if (existingIndex !== -1) {
        targetList[existingIndex].quantity += quantity;
    } else {
        targetList.push({
            medicineId: medicineId,
            quantity: quantity
        });
    }

    if (medicineSelectionContext === 'edit') {
        updateEditSelectedMedicinesList();
    } else {
        updateSelectedMedicinesList();
    }
    closeMedicineSelectionModal();
}

function updateSelectedMedicinesList() {
    const listContainer = document.getElementById('selected-medicines-list');

    if (selectedMedicines.length === 0) {
        listContainer.innerHTML = '<p class="no-medicine">No medicines selected</p>';
        return;
    }

    listContainer.innerHTML = selectedMedicines.map((med, index) => {
        const medicine = findMedicineById(med.medicineId);
        return `
            <div class="medicine-item">
                <div class="medicine-item-info">
                    <div class="medicine-item-name">${medicine ? medicine.name : 'Unknown'}</div>
                    <div class="medicine-item-details">
                        Quantity: ${med.quantity}
                    </div>
                </div>
                <button class="medicine-item-remove" onclick="removeMedicineFromCase(${index})">
                    <i class="fas fa-times"></i> Remove
                </button>
            </div>
        `;
    }).join('');
}

function updateEditSelectedMedicinesList() {
    const listContainer = document.getElementById('edit-prescribed-meds');

    if (!listContainer) return;

    if (!editSelectedMedicines.length) {
        listContainer.innerHTML = '<p class="no-medicine">No medicines selected</p>';
        return;
    }

    listContainer.innerHTML = editSelectedMedicines.map((med, index) => {
        const medicine = findMedicineById(med.medicineId);
        return `
            <div class="medicine-item">
                <div class="medicine-item-info">
                    <div class="medicine-item-name">${medicine ? medicine.name : 'Unknown'}</div>
                    <div class="medicine-item-details">Quantity: ${med.quantity}</div>
                </div>
                <button class="medicine-item-remove" onclick="removeMedicineFromEdit(${index})">
                    <i class="fas fa-times"></i> Remove
                </button>
            </div>
        `;
    }).join('');
}

function removeMedicineFromEdit(index) {
    editSelectedMedicines.splice(index, 1);
    updateEditSelectedMedicinesList();
}

function removeMedicineFromCase(index) {
    selectedMedicines.splice(index, 1);
    updateSelectedMedicinesList();
}

// ==================== User Management ====================

function loadUsersTable() {
    const tbody = document.getElementById('users-table-body');

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.username}</td>
            <td>
                <span class="badge badge-${user.role.toLowerCase()}">${user.role}</span>
            </td>
            <td>
                <span class="status-badge ${user.status.toLowerCase()}">${user.status}</span>
            </td>
            <td>${new Date(user.createdDate).toLocaleDateString()}</td>
            <td class="action-buttons">
                <button class="btn-icon btn-icon-edit" onclick="editUser(${user.id})" title="Edit User">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-icon-delete" onclick="deleteUser(${user.id})" title="Delete User">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openUserModal(userId = null) {
    const modal = document.getElementById('user-modal');
    const modalTitle = document.getElementById('user-modal-title');
    const form = document.getElementById('user-form');
    const roleSelect = document.getElementById('user-role');
    const passwordGroup = document.getElementById('admin-password-group');

    form.reset();
    document.getElementById('user-id').value = '';

    if (userId) {
        const user = users.find(u => u.id === userId);
        if (user) {
            modalTitle.textContent = 'Edit User';
            document.getElementById('user-id').value = user.id;
            document.getElementById('user-username').value = user.username;
            document.getElementById('user-role').value = user.role;
            document.getElementById('user-status').value = user.status;

            // Show/hide password field based on role
            if (passwordGroup) {
                passwordGroup.style.display = user.role === 'Admin' ? 'block' : 'none';
            }
        }
    } else {
        modalTitle.textContent = 'Add User';
        document.getElementById('user-status').value = 'Active';
        if (passwordGroup) {
            passwordGroup.style.display = 'none';
        }
    }

    // Add event listener for role change
    if (roleSelect && passwordGroup) {
        roleSelect.addEventListener('change', function () {
            passwordGroup.style.display = this.value === 'Admin' ? 'block' : 'none';
        });
    }

    modal.classList.add('show');
}

function closeUserModal() {
    document.getElementById('user-modal').classList.remove('show');
}

function saveUser() {
    const userId = document.getElementById('user-id').value;
    const username = document.getElementById('user-username').value;
    const role = document.getElementById('user-role').value;
    const status = document.getElementById('user-status').value;
    const password = document.getElementById('user-password').value;

    if (userId) {
        // Edit existing user
        const index = users.findIndex(u => u.id == userId);
        if (index !== -1) {
            const updatedUser = {
                ...users[index],
                username,
                role,
                status
            };

            // Update password if provided and user is Admin
            if (role === 'Admin' && password) {
                updatedUser.password = password;
            }

            users[index] = updatedUser;

            if (typeof updateUserInSheet === 'function') {
                updateUserInSheet(updatedUser).then(result => {
                    if (result.success) {
                        closeUserModal();
                        loadUsersTable();
                        updateLoginOptions();
                        alert('User updated successfully!');
                    } else {
                        alert('Error updating user: ' + result.message);
                    }
                });
            }
        }
    } else {
        // Add new user
        const newUser = {
            id: Date.now(),
            username,
            role,
            status,
            createdDate: new Date().toISOString()
        };

        // Set password for Admin users
        if (role === 'Admin') {
            newUser.password = password || 'admin123';
        }

        if (typeof saveUserToSheet === 'function') {
            saveUserToSheet(newUser).then(result => {
                if (result.success) {
                    users.push(newUser);
                    closeUserModal();
                    loadUsersTable();
                    updateLoginOptions();
                    alert('User added successfully!');
                } else {
                    alert('Error adding user: ' + result.message);
                }
            });
        }
    }
}

function editUser(userId) {
    openUserModal(userId);
}

function deleteUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (user.role === 'Admin' && users.filter(u => u.role === 'Admin').length === 1) {
        alert('Cannot delete the last Admin user!');
        return;
    }

    if (confirm(`Are you sure you want to delete user "${user.username}"?`)) {
        if (typeof deleteUserFromSheet === 'function') {
            deleteUserFromSheet(userId).then(result => {
                if (result.success) {
                    users = users.filter(u => u.id !== userId);
                    loadUsersTable();
                    updateLoginOptions();
                    alert('User deleted successfully!');
                } else {
                    alert('Error deleting user: ' + result.message);
                }
            });
        }
    }
}

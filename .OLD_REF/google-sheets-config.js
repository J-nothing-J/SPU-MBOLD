// ==================== GOOGLE SHEETS CONFIGURATION ====================
// Replace this URL with your Google Apps Script Web App URL after deployment
const GOOGLE_SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbyPvcGexYyfWuLgRlUiyQCiokS9gMM3ATlY2MAFi8n-6EEqpEtivVNYxdq6m3PqoUL3/exec';

// Google Sheets mode enabled
const USE_GOOGLE_SHEETS = true;

// Connection status helpers
function setConnectionStatus(prefix, state, text) {
    const dot = document.getElementById(`${prefix}-status-dot`);
    const label = document.getElementById(`${prefix}-status-text`);

    if (dot) {
        dot.className = `status-dot status-${state}`;
    }
    if (label && typeof text === 'string') {
        label.textContent = text;
    }
}

function updateInternetStatus() {
    const online = navigator.onLine;
    setConnectionStatus('internet', online ? 'ok' : 'error', online ? 'Online' : 'Offline');

    // When offline, also show Sheets as unavailable until we reconnect
    if (!online) {
        setGoogleSheetsStatus('error', 'Offline');
    } else {
        setGoogleSheetsStatus('idle', 'Idle');
    }
}

function setGoogleSheetsStatus(state, text) {
    setConnectionStatus('sheets', state, text);
}

function initializeConnectionStatusIndicators() {
    updateInternetStatus();
    setGoogleSheetsStatus('idle', 'Idle');

    window.addEventListener('online', updateInternetStatus);
    window.addEventListener('offline', updateInternetStatus);
}

// Debug logging functions
function addDebugLog(message, type = 'info', action = '') {
    const debugLog = document.getElementById('debug-log');
    if (!debugLog) return;

    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `debug-entry debug-${type}`;
    
    let content = `<span class="debug-timestamp">[${timestamp}]</span>`;
    if (action) {
        content += `<span class="debug-action">${action}</span>`;
    }
    content += `<span class="debug-message">${message}</span>`;
    
    entry.innerHTML = content;
    debugLog.appendChild(entry);
    
    // Force scroll to bottom with a small delay to ensure rendering
    setTimeout(() => {
        debugLog.scrollTop = debugLog.scrollHeight;
    }, 10);
}

function clearDebugLog() {
    const debugLog = document.getElementById('debug-log');
    if (debugLog) {
        debugLog.innerHTML = '';
    }
}

// Initialize debug clear button
document.addEventListener('DOMContentLoaded', function() {
    const clearBtn = document.getElementById('clear-debug-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearDebugLog);
    }

    initializeConnectionStatusIndicators();
});

// Loading indicator functions
function showLoading(message = 'Syncing with Google Sheets...') {
    const loadingDiv = document.getElementById('loading-indicator');
    const loadingText = document.getElementById('loading-message');
    const debugWindow = document.getElementById('debug-window');

    if (loadingDiv) {
        // Clear old debug logs when starting a new loading sequence
        clearDebugLog();
        
        loadingDiv.style.display = 'flex';
        if (debugWindow) {
            debugWindow.style.display = 'flex';
        }
        if (loadingText) {
            loadingText.textContent = message;
        }
        addDebugLog(message, 'info', 'LOADING');
    }
}

function hideLoading() {
    const loadingDiv = document.getElementById('loading-indicator');
    const debugWindow = document.getElementById('debug-window');
    
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }
    
    // Hide debug window after a short delay so user can see the final message
    setTimeout(() => {
        if (debugWindow) {
            debugWindow.style.display = 'none';
        }
    }, 1000);
    
    addDebugLog('Loading complete', 'success', 'DONE');
}

// ==================== GOOGLE SHEETS API HELPER ====================
async function callGoogleSheetsAPI(action, data = null) {
    if (GOOGLE_SHEETS_API_URL === 'PASTE_YOUR_WEB_APP_URL_HERE') {
        console.error('Please configure your Google Apps Script URL in google-sheets-config.js');
        return { success: false, message: 'Google Sheets API not configured' };
    }

    // Show specific loading message based on action
    const actionMessages = {
        'getPatients': 'Loading patients...',
        'getCases': 'Loading cases...',
        'addPatient': 'Saving patient...',
        'updatePatient': 'Updating patient...',
        'deletePatient': 'Deleting patient...',
        'getMedicines': 'Loading medicines...',
        'addMedicine': 'Saving medicine...',
        'updateMedicine': 'Updating medicine...',
        'deleteMedicine': 'Deleting medicine...',
        'getBeds': 'Loading beds...',
        'addBed': 'Saving bed...',
        'updateBed': 'Updating bed...',
        'deleteBed': 'Deleting bed...',
        'getUsers': 'Loading users...',
        'addUser': 'Saving user...',
        'updateUser': 'Updating user...',
        'deleteUser': 'Deleting user...',
        'updateCase': 'Updating case...'
    };

    showLoading(actionMessages[action] || 'Syncing with Google Sheets...');
    setGoogleSheetsStatus('checking', 'Syncing...');
    addDebugLog(`Starting API call: ${action}`, 'info', action.toUpperCase());
    
    if (data) {
        addDebugLog(`Request data: ${JSON.stringify(data).substring(0, 100)}...`, 'info');
    }

    try {
        // Build URL with parameters for GET request
        const url = `${GOOGLE_SHEETS_API_URL}?action=${action}&data=${encodeURIComponent(JSON.stringify(data))}`;
        addDebugLog(`Request URL built (length: ${url.length} chars)`, 'info');

        addDebugLog('Sending fetch request...', 'info');
        const startTime = Date.now();
        
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow'
        });

        const fetchTime = Date.now() - startTime;
        addDebugLog(`Fetch completed in ${fetchTime}ms`, 'success');

        // Check if response is ok
        if (!response.ok) {
            addDebugLog(`HTTP Error: ${response.status} ${response.statusText}`, 'error');
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        addDebugLog(`Response status: ${response.status} OK`, 'success');
        const text = await response.text();
        addDebugLog(`Response received (${text.length} bytes)`, 'info');

        // Try to parse as JSON
        let result;
        try {
            result = JSON.parse(text);
            addDebugLog(`JSON parsed successfully`, 'success');
            if (result.success) {
                addDebugLog(`✓ Action completed successfully`, 'success', action.toUpperCase());
                if (result.data && Array.isArray(result.data)) {
                    addDebugLog(`Retrieved ${result.data.length} records`, 'info');
                }
                setGoogleSheetsStatus('ok', 'Connected');
            } else {
                addDebugLog(`✗ Action failed: ${result.message}`, 'error', action.toUpperCase());
                setGoogleSheetsStatus('error', 'API error');
            }
        } catch (e) {
            addDebugLog(`JSON Parse Error: ${e.message}`, 'error');
            addDebugLog(`Response preview: ${text.substring(0, 200)}...`, 'error');
            console.error('Response is not valid JSON:', text);
            throw new Error('Invalid JSON response from server');
        }

        hideLoading();
        return result;
    } catch (error) {
        addDebugLog(`Fatal Error: ${error.message}`, 'error', action.toUpperCase());
        console.error('API Error:', error);
        setGoogleSheetsStatus('error', 'Unavailable');
        hideLoading();
        return { success: false, message: error.message };
    }
}

// ==================== PATIENT DATABASE FUNCTIONS ====================
async function loadPatientsFromSheet() {
    if (!USE_GOOGLE_SHEETS) {
        return { success: true, data: patients };
    }

    // Load both Patients and Cases data
    const patientsResult = await callGoogleSheetsAPI('getPatients');
    const casesResult = await callGoogleSheetsAPI('getCases');

    if (patientsResult.success && casesResult.success) {
        const patientsData = patientsResult.data || [];
        const casesData = casesResult.data || [];
        // Combine patients with their cases
        const casePatients = casesData.map(caseRecord => {
            const patientInfo = patientsData.find(p => String(p.studentId) === String(caseRecord.studentId));
            let symptomTypes = [];

            if (Array.isArray(caseRecord.symptomTypes)) {
                symptomTypes = caseRecord.symptomTypes;
            } else if (typeof caseRecord.symptomTypes === 'string') {
                const trimmed = caseRecord.symptomTypes.trim();
                if (trimmed) {
                    if (trimmed.startsWith('[')) {
                        try {
                            const parsed = JSON.parse(trimmed);
                            symptomTypes = Array.isArray(parsed) ? parsed : [trimmed];
                        } catch (e) {
                            symptomTypes = [trimmed];
                        }
                    } else {
                        symptomTypes = [trimmed];
                    }
                }
            }

            return {
                caseId: caseRecord.caseId,
                studentId: caseRecord.studentId,
                idType: caseRecord.idType || (patientInfo ? patientInfo.idType : ''),
                name: patientInfo ? patientInfo.name : '',
                college: patientInfo ? patientInfo.college : '',
                gender: patientInfo ? patientInfo.gender : '',
                date: caseRecord.date,
                time: caseRecord.time,
                symptoms: caseRecord.symptoms,
                symptomTypes: symptomTypes,
                medicines: typeof caseRecord.medicines === 'string' ? JSON.parse(caseRecord.medicines || '[]') : caseRecord.medicines,
                nurseName: caseRecord.nurseName,
                needsWard: caseRecord.needsWard,
                status: caseRecord.status
            };
        });

        // Ensure base patient records remain even if no cases exist
        const caseStudentIds = new Set(casePatients.map(p => String(p.studentId)));
        const patientsOnly = patientsData
            .filter(p => !caseStudentIds.has(String(p.studentId)))
            .map(p => ({
                caseId: null,
                studentId: p.studentId,
                idType: p.idType || '',
                name: p.name || '',
                college: p.college || '',
                gender: p.gender || '',
                date: null,
                time: null,
                symptoms: '',
                symptomTypes: [],
                medicines: [],
                nurseName: '',
                needsWard: false,
                status: 'Active'
            }));

        patients = [...casePatients, ...patientsOnly];

        updateDashboard();
        return { success: true, data: patients };
    }
    return { success: false, message: 'Failed to load patient data' };
}

async function savePatientToSheet(patient) {
    return await callGoogleSheetsAPI('addPatient', patient);
}

async function updatePatientInSheet(patient) {
    return await callGoogleSheetsAPI('updatePatient', patient);
}

async function deletePatientFromSheet(studentId) {
    return await callGoogleSheetsAPI('deletePatient', { studentId });
}

async function updateCaseInSheet(caseData) {
    return await callGoogleSheetsAPI('updateCase', caseData);
}

async function deleteCaseFromSheet(caseId) {
    return await callGoogleSheetsAPI('deleteCase', { caseId });
}

// ==================== MEDICINE DATABASE FUNCTIONS ====================
async function loadMedicinesFromSheet() {
    if (!USE_GOOGLE_SHEETS) {
        return { success: true, data: medicines };
    }

    const result = await callGoogleSheetsAPI('getMedicines');
    if (result.success && result.data) {
        const normalized = result.data.map(item =>
            typeof normalizeMedicineRecord === 'function' ? normalizeMedicineRecord(item) : item
        );
        medicines = normalized;
        return { ...result, data: normalized };
    }
    return result;
}

async function saveMedicineToSheet(medicine) {
    return await callGoogleSheetsAPI('addMedicine', medicine);
}

async function updateMedicineInSheet(medicine) {
    return await callGoogleSheetsAPI('updateMedicine', medicine);
}

async function deleteMedicineFromSheet(id) {
    return await callGoogleSheetsAPI('deleteMedicine', { id });
}

// ==================== BED DATABASE FUNCTIONS ====================
async function loadBedsFromSheet() {
    if (!USE_GOOGLE_SHEETS) {
        return { success: true, data: beds };
    }

    const result = await callGoogleSheetsAPI('getBeds');
    if (result.success && result.data) {
        beds = result.data;
        return result;
    }
    return result;
}

async function saveBedToSheet(bed) {
    return await callGoogleSheetsAPI('addBed', bed);
}

async function updateBedInSheet(bed) {
    return await callGoogleSheetsAPI('updateBed', bed);
}

async function deleteBedFromSheet(id) {
    return await callGoogleSheetsAPI('deleteBed', { id });
}

// ==================== USER DATABASE FUNCTIONS ====================
async function loadUsersFromSheet() {
    if (!USE_GOOGLE_SHEETS) {
        return { success: true, data: users };
    }

    const result = await callGoogleSheetsAPI('getUsers');
    if (result.success && result.data) {
        users = result.data;
        return result;
    }
    return result;
}

async function saveUserToSheet(user) {
    return await callGoogleSheetsAPI('addUser', user);
}

async function updateUserInSheet(user) {
    return await callGoogleSheetsAPI('updateUser', user);
}

async function deleteUserFromSheet(id) {
    return await callGoogleSheetsAPI('deleteUser', { id });
}

// ==================== INITIALIZE DATA FROM SHEETS ====================
async function initializeDataFromSheets() {
    addDebugLog('=== Starting Data Initialization ===', 'info', 'INIT');
    addDebugLog('Loading all data from Google Sheets...', 'info');
    
    try {
        const startTime = Date.now();
        
        await Promise.all([
            loadPatientsFromSheet(),
            loadMedicinesFromSheet(),
            loadBedsFromSheet(),
            loadUsersFromSheet()
        ]);

        const totalTime = Date.now() - startTime;
        addDebugLog(`All data loaded in ${totalTime}ms`, 'success', 'INIT');
        addDebugLog(`Patients: ${patients.length}, Medicines: ${medicines.length}, Beds: ${beds.length}, Users: ${users.length}`, 'success');

        // Update login options after users are loaded
        if (typeof updateLoginOptions === 'function') {
            updateLoginOptions();
            addDebugLog('Login options updated', 'info');
        }

        updateDashboard();
        addDebugLog('Dashboard updated', 'info');
        addDebugLog('=== Initialization Complete ===', 'success', 'INIT');

    } catch (error) {
        addDebugLog(`Initialization Error: ${error.message}`, 'error', 'INIT');
        console.error('Error loading data from Google Sheets:', error);
        alert('Failed to load data from Google Sheets. Using local data.');
    }
}

// ==================== GOOGLE APPS SCRIPT FOR BAYMAX 06-02-2026 (V10)====================
// This code should be pasted in Google Apps Script
// Go to: Extensions > Apps Script in your Google Sheet

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    let action, data;

    // Handle GET requests
    if (e.parameter && e.parameter.action) {
      action = e.parameter.action;
      data = e.parameter.data ? JSON.parse(e.parameter.data) : null;
    }
    // Handle POST requests
    else if (e.postData && e.postData.contents) {
      const params = JSON.parse(e.postData.contents);
      action = params.action;
      data = params.data;
    }
    else {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'No action specified'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    let result;

    switch (action) {
      // Patient operations
      case 'getPatients':
        result = getSheetData('Patients');
        break;
      case 'addPatient':
        result = addPatient(ss, data);
        break;
      case 'updatePatient':
        result = updatePatient(ss, data);
        break;
      case 'deletePatient':
        result = deletePatient(ss, data);
        break;

      // Case operations (symptoms & medicines)
      case 'getCases':
        result = getSheetData('Cases');
        break;
      case 'addCase':
        result = addCase(ss, data);
        break;
      case 'updateCase':
        result = updateCase(ss, data);
        break;
      case 'deleteCase':
        result = deleteCase(ss, data);
        break;

      // Medicine operations
      case 'getMedicines':
        result = getSheetData('Medicines');
        break;
      case 'addMedicine':
        result = addMedicine(ss, data);
        break;
      case 'updateMedicine':
        result = updateMedicine(ss, data);
        break;
      case 'deleteMedicine':
        result = deleteMedicine(ss, data);
        break;

      // Bed operations
      case 'getBeds':
        result = getSheetData('Beds');
        break;
      case 'addBed':
        result = addBed(ss, data);
        break;
      case 'updateBed':
        result = updateBed(ss, data);
        break;
      case 'deleteBed':
        result = deleteBed(ss, data);
        break;

      // User operations
      case 'getUsers':
        result = getSheetData('Users');
        break;
      case 'addUser':
        result = addUser(ss, data);
        break;
      case 'updateUser':
        result = updateUser(ss, data);
        break;
      case 'deleteUser':
        result = deleteUser(ss, data);
        break;

      default:
        result = { success: false, message: 'Invalid action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==================== GENERIC SHEET DATA RETRIEVAL ====================
function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return { success: false, message: 'Sheet "' + sheetName + '" not found' };
  }

  const lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    return { success: true, data: [] };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);

  const result = rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });

  return { success: true, data: result };
}

function ensureCaseHeaders(sheet) {
  const expectedHeaders = ['caseId', 'studentId', 'idType', 'date', 'time', 'symptoms', 'symptomTypes', 'medicines', 'nurseName', 'needsWard', 'status'];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(expectedHeaders);
    return expectedHeaders;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), expectedHeaders.length)).getValues()[0];

  // Insert idType column after studentId if missing to avoid misalignment
  if (currentHeaders.indexOf('idType') === -1) {
    sheet.insertColumnAfter(2);
    currentHeaders.splice(2, 0, '');
  }

  const needsUpdate = expectedHeaders.some((header, index) => currentHeaders[index] !== header);

  if (needsUpdate) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
  }

  return expectedHeaders;
}

function ensurePatientHeaders(sheet) {
  const expectedHeaders = ['studentId', 'idType', 'name', 'college', 'gender'];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(expectedHeaders);
    return expectedHeaders;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), expectedHeaders.length)).getValues()[0];

  if (currentHeaders.indexOf('idType') === -1) {
    sheet.insertColumnAfter(2);
    currentHeaders.splice(2, 0, '');
  }

  const needsUpdate = expectedHeaders.some((header, index) => currentHeaders[index] !== header);

  if (needsUpdate) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
  }

  return expectedHeaders;
}

// ==================== PATIENT FUNCTIONS ====================
function addPatient(ss, patient) {
  const patientsSheet = ss.getSheetByName('Patients');
  const casesSheet = ss.getSheetByName('Cases');

  ensurePatientHeaders(patientsSheet);
  ensureCaseHeaders(casesSheet);

  // Check if patient already exists
  const existingPatients = patientsSheet.getDataRange().getValues();
  let patientExists = false;

  for (let i = 1; i < existingPatients.length; i++) {
    if (String(existingPatients[i][0]) === String(patient.studentId)) {
      patientExists = true;
      // Update patient basic info if changed
      patientsSheet.getRange(i + 1, 1, 1, 5).setValues([[
        patient.studentId || '',
        patient.idType || '',
        patient.name || '',
        patient.college || '',
        patient.gender || ''
      ]]);
      break;
    }
  }

  // Add new patient if doesn't exist
  if (!patientExists) {
    patientsSheet.appendRow([
      patient.studentId || '',
      patient.idType || '',
      patient.name || '',
      patient.college || '',
      patient.gender || ''
    ]);
  }

  // Always add a new case record
  const caseId = 'CASE-' + Date.now();
  casesSheet.appendRow([
    caseId,
    patient.studentId || '',
    patient.idType || '',
    patient.date || '',
    patient.time || '',
    patient.symptoms || '',
    JSON.stringify(patient.symptomTypes || []),
    JSON.stringify(patient.medicines || []),
    patient.nurseName || '',
    patient.needsWard || false,
    patient.status || 'Active'
  ]);

  return { success: true, message: 'Patient and case added successfully', caseId: caseId };
}

function updatePatient(ss, patient) {
  const sheet = ss.getSheetByName('Patients');
  ensurePatientHeaders(sheet);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    // Convert both to string for comparison
    if (String(data[i][0]) === String(patient.studentId)) {
      sheet.getRange(i + 1, 1, 1, 5).setValues([[
        patient.studentId || '',
        patient.idType || '',
        patient.name || '',
        patient.college || '',
        patient.gender || ''
      ]]);
      return { success: true, message: 'Patient updated successfully' };
    }
  }

  return { success: false, message: 'Patient not found' };
}

function deletePatient(ss, data) {
  const patientsSheet = ss.getSheetByName('Patients');
  const casesSheet = ss.getSheetByName('Cases');

  if (patientsSheet.getLastRow() === 0) {
    return { success: false, message: 'No patients to delete' };
  }

  const patientValues = patientsSheet.getDataRange().getValues();

  // Delete patient from Patients sheet
  for (let i = patientValues.length - 1; i >= 1; i--) {
    if (String(patientValues[i][0]) === String(data.studentId)) {
      patientsSheet.deleteRow(i + 1);
      break;
    }
  }

  // Delete all cases for this patient from Cases sheet
  if (casesSheet.getLastRow() > 0) {
    const caseValues = casesSheet.getDataRange().getValues();
    for (let i = caseValues.length - 1; i >= 1; i--) {
      if (String(caseValues[i][1]) === String(data.studentId)) {
        casesSheet.deleteRow(i + 1);
      }
    }
  }

  return { success: true, message: 'Patient and all cases deleted successfully' };
}

// ==================== CASE FUNCTIONS (SYMPTOMS & MEDICINES) ====================
function addCase(ss, caseData) {
  const sheet = ss.getSheetByName('Cases');

  ensureCaseHeaders(sheet);

  const caseId = caseData.caseId || 'CASE-' + Date.now();

  sheet.appendRow([
    caseId,
    caseData.studentId || '',
    caseData.idType || '',
    caseData.date || '',
    caseData.time || '',
    caseData.symptoms || '',
    JSON.stringify(caseData.symptomTypes || []),
    JSON.stringify(caseData.medicines || []),
    caseData.nurseName || '',
    caseData.needsWard || false,
    caseData.status || 'Active'
  ]);

  return { success: true, message: 'Case added successfully', caseId: caseId };
}

function updateCase(ss, caseData) {
  const sheet = ss.getSheetByName('Cases');
  const data = sheet.getDataRange().getValues();

  ensureCaseHeaders(sheet);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(caseData.caseId)) {
      // Get existing data
      const existingData = {
        caseId: data[i][0],
        studentId: data[i][1],
        idType: data[i][2],
        date: data[i][3],
        time: data[i][4],
        symptoms: data[i][5],
        symptomTypes: data[i][6],
        medicines: data[i][7],
        nurseName: data[i][8],
        needsWard: data[i][9],
        status: data[i][10]
      };

      // Update only provided fields
      sheet.getRange(i + 1, 1, 1, 11).setValues([[
        caseData.caseId || existingData.caseId,
        caseData.studentId !== undefined ? caseData.studentId : existingData.studentId,
        caseData.idType !== undefined ? caseData.idType : existingData.idType,
        caseData.date !== undefined ? caseData.date : existingData.date,
        caseData.time !== undefined ? caseData.time : existingData.time,
        caseData.symptoms !== undefined ? caseData.symptoms : existingData.symptoms,
        caseData.symptomTypes !== undefined ? JSON.stringify(caseData.symptomTypes) : existingData.symptomTypes,
        caseData.medicines !== undefined ? JSON.stringify(caseData.medicines) : existingData.medicines,
        caseData.nurseName !== undefined ? caseData.nurseName : existingData.nurseName,
        caseData.needsWard !== undefined ? caseData.needsWard : existingData.needsWard,
        caseData.status !== undefined ? caseData.status : existingData.status
      ]]);
      return { success: true, message: 'Case updated successfully' };
    }
  }

  return { success: false, message: 'Case not found' };
}

function deleteCase(ss, data) {
  const sheet = ss.getSheetByName('Cases');

  if (sheet.getLastRow() === 0) {
    return { success: false, message: 'No cases to delete' };
  }

  const values = sheet.getDataRange().getValues();

  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0]) === String(data.caseId)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Case deleted successfully' };
    }
  }

  return { success: false, message: 'Case not found' };
}

// ==================== MEDICINE FUNCTIONS ====================
function addMedicine(ss, medicine) {
  const sheet = ss.getSheetByName('Medicines');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'name', 'category', 'unit', 'stock']);
  }

  sheet.appendRow([
    medicine.id || '',
    medicine.name || '',
    medicine.category || '',
    medicine.unit || '',
    medicine.stock || 0
  ]);

  return { success: true, message: 'Medicine added successfully' };
}

function updateMedicine(ss, medicine) {
  const sheet = ss.getSheetByName('Medicines');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    // Convert both to string for comparison
    if (String(data[i][0]) === String(medicine.id)) {
      sheet.getRange(i + 1, 1, 1, 5).setValues([[
        medicine.id || '',
        medicine.name || '',
        medicine.category || '',
        medicine.unit || '',
        medicine.stock || 0
      ]]);
      return { success: true, message: 'Medicine updated successfully' };
    }
  }

  return { success: false, message: 'Medicine not found' };
}

function deleteMedicine(ss, data) {
  const sheet = ss.getSheetByName('Medicines');

  if (sheet.getLastRow() === 0) {
    return { success: false, message: 'No medicines to delete' };
  }

  const values = sheet.getDataRange().getValues();

  // Start from the last row and go backwards
  for (let i = values.length - 1; i >= 1; i--) {
    // Convert both to string for comparison
    if (String(values[i][0]) === String(data.id)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Medicine deleted successfully' };
    }
  }

  return { success: false, message: 'Medicine not found. Id: ' + data.id };
}

// ==================== BED FUNCTIONS ====================
function addBed(ss, bed) {
  const sheet = ss.getSheetByName('Beds');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'number', 'room', 'status', 'patient', 'admissionDate', 'notes']);
  }

  sheet.appendRow([
    bed.id || '',
    bed.number || 0,
    bed.room || 0,
    bed.status || 'available',
    bed.patient || '',
    bed.admissionDate || '',
    bed.notes || ''
  ]);

  return { success: true, message: 'Bed added successfully' };
}

function updateBed(ss, bed) {
  const sheet = ss.getSheetByName('Beds');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    // Convert both to string for comparison
    if (String(data[i][0]) === String(bed.id)) {
      sheet.getRange(i + 1, 1, 1, 7).setValues([[
        bed.id || '',
        bed.number || 0,
        bed.room || 0,
        bed.status || 'available',
        bed.patient || '',
        bed.admissionDate || '',
        bed.notes || ''
      ]]);
      return { success: true, message: 'Bed updated successfully' };
    }
  }

  return { success: false, message: 'Bed not found' };
}

function deleteBed(ss, data) {
  const sheet = ss.getSheetByName('Beds');

  if (sheet.getLastRow() === 0) {
    return { success: false, message: 'No beds to delete' };
  }

  const values = sheet.getDataRange().getValues();

  // Start from the last row and go backwards
  for (let i = values.length - 1; i >= 1; i--) {
    // Convert both to string for comparison
    if (String(values[i][0]) === String(data.id)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Bed deleted successfully' };
    }
  }

  return { success: false, message: 'Bed not found. Id: ' + data.id };
}

// ==================== USER FUNCTIONS ====================
function addUser(ss, user) {
  const sheet = ss.getSheetByName('Users');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'username', 'role', 'status', 'createdDate']);
  }

  sheet.appendRow([
    user.id || '',
    user.username || '',
    user.role || '',
    user.status || 'Active',
    user.createdDate || ''
  ]);

  return { success: true, message: 'User added successfully' };
}

function updateUser(ss, user) {
  const sheet = ss.getSheetByName('Users');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    // Convert both to string for comparison
    if (String(data[i][0]) === String(user.id)) {
      sheet.getRange(i + 1, 1, 1, 5).setValues([[
        user.id || '',
        user.username || '',
        user.role || '',
        user.status || 'Active',
        user.createdDate || ''
      ]]);
      return { success: true, message: 'User updated successfully' };
    }
  }

  return { success: false, message: 'User not found' };
}

function deleteUser(ss, data) {
  const sheet = ss.getSheetByName('Users');

  if (sheet.getLastRow() === 0) {
    return { success: false, message: 'No users to delete' };
  }

  const values = sheet.getDataRange().getValues();

  // Start from the last row and go backwards
  for (let i = values.length - 1; i >= 1; i--) {
    // Convert both to string for comparison
    if (String(values[i][0]) === String(data.id)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'User deleted successfully' };
    }
  }

  return { success: false, message: 'User not found. Id: ' + data.id };
}

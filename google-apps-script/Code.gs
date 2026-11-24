/**
 * UTM Campaign Builder Banfondesa · Mercadeo
 * Backend abierto por URL para consultar y crear UTMs; solo hojas de Google controlan acceso al archivo.
 * IMPORTANTE: los datos del historial pasan a ser publicos para cualquier visitante de la URL.
 */
const SHEET_ID = '13GH9JD9HgHQOXwFvoKFk9hUvIEbCYLHtRRL3fTxt7eQ';
const SHEET_TAB = 'Bitácora UTMs';
const HEADER_COUNT = 12;

function doGet() {
  // HTMLService ejecuta la aplicacion en Google, sin solicitudes cross-origin desde GitHub.
  const page = HtmlService.createTemplateFromFile('Index');
  page.sheetUrl = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit';
  return page.evaluate().setTitle('UTM Campaign Builder Banfondesa · Mercadeo');
}

function include(file) {
  return HtmlService.createTemplateFromFile(file).getRawContent();
}

function sheet_() {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_TAB);
  if (!sh) throw new Error('No se encontro la pestaña de bitacora.');
  return sh;
}

function toItem_(row) {
  return {
    consecutive: Number(row[0]),
    createdAt: String(row[1] || ''),
    label: String(row[2] || ''),
    source: String(row[3] || ''),
    medium: String(row[4] || ''),
    campaign: String(row[5] || ''),
    term: String(row[6] || ''),
    content: String(row[7] || ''),
    destinationUrl: String(row[8] || ''),
    generatedUrl: String(row[9] || ''),
    shortUrl: String(row[10] || ''),
    id: String(row[11] || '')
  };
}

function allRows_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HEADER_COUNT).getDisplayValues()
    .filter(row => row[11] && row[0])
    .map(toItem_).sort((a, b) => b.consecutive - a.consecutive);
}

function listUtms() {
  return { items: allRows_(), sheetUrl: 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit' };
}

function safeCell_(value) {
  // Las hojas de calculo no deben ejecutar formulas introducidas en campos libres.
  let text = String(value == null ? '' : value).slice(0, 20000);
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return text;
}

function normalize_(v) {
  return String(v || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function cleanUrl_(value) {
  const url = String(value || '').trim();
  if (!/^https?:\/\/[^\/\s?#]+/i.test(url)) throw new Error('La URL de destino debe iniciar por http:// o https://');
  if (url.length > 6000) throw new Error('La URL supera la longitud permitida.');
  return url;
}

function createUtm(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Datos incompletos.');
  const source = normalize_(payload.source);
  const medium = normalize_(payload.medium);
  const campaign = normalize_(payload.campaign);
  if (!source || !medium || !campaign) throw new Error('Source, medium y campaign son obligatorios.');
  const destinationUrl = cleanUrl_(payload.destinationUrl);
  const generatedUrl = cleanUrl_(payload.generatedUrl);
  const id = String(payload.id || Utilities.getUuid());
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = sheet_();
    const last = sh.getLastRow();
    if (last > 1) {
      const ids = sh.getRange(2, 12, last - 1, 1).getDisplayValues();
      const existing = ids.findIndex(row => row[0] === id);
      if (existing >= 0) return toItem_(sh.getRange(existing + 2, 1, 1, HEADER_COUNT).getDisplayValues()[0]);
    }
    const properties = PropertiesService.getScriptProperties();
    // Cuota compartida para limitar uso abusivo accidental. No es defensa frente a bots.
    const hour = Utilities.formatDate(new Date(), 'Etc/UTC', 'yyyyMMddHH');
    const key = 'CREATE_COUNT_' + hour;
    const n = Number(properties.getProperty(key) || '0');
    if (n >= 100) throw new Error('Límite temporal de 100 UTMs/hora para proteger la hoja.');
    const lastSerial = Number(properties.getProperty('LAST_CONSECUTIVO') || '0');
    const lastColumnValue = last > 1 ? Number(sh.getRange(last, 1).getDisplayValue()) || 0 : 0;
    const next = Math.max(lastSerial, lastColumnValue) + 1;
    const createdAt = new Date().toISOString();
    const row = [
      next, createdAt, safeCell_(payload.label),
      safeCell_(source), safeCell_(medium), safeCell_(campaign),
      safeCell_(normalize_(payload.term)), safeCell_(normalize_(payload.content)),
      safeCell_(destinationUrl), safeCell_(generatedUrl), '', safeCell_(id)
    ];
    sh.appendRow(row);
    SpreadsheetApp.flush();
    properties.setProperty('LAST_CONSECUTIVO', String(next));
    properties.setProperty(key, String(n + 1));
    return toItem_(row);
  } finally {
    lock.releaseLock();
  }
}

function shortenUtm(id) {
  const key = String(id || '');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = sheet_(), last = sh.getLastRow();
    if (last < 2) throw new Error('No se encontro el registro.');
    const ids = sh.getRange(2, 12, last - 1, 1).getDisplayValues();
    const offset = ids.findIndex(row => row[0] === key);
    if (offset < 0) throw new Error('El registro no existe en Google Sheets.');
    const rowNum = offset + 2;
    const current = toItem_(sh.getRange(rowNum, 1, 1, HEADER_COUNT).getDisplayValues()[0]);
    if (current.shortUrl) return current.shortUrl;
    const address = 'https://is.gd/create.php?format=json&url=' + encodeURIComponent(current.generatedUrl);
    const response = UrlFetchApp.fetch(address, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) throw new Error('No responde el acortador (' + response.getResponseCode() + ').');
    const data = JSON.parse(response.getContentText());
    if (!data.shorturl || data.errormessage) throw new Error(data.errormessage || 'No se obtuvo URL corta.');
    if (!/^https:\/\/is\.gd\//i.test(data.shorturl)) throw new Error('URL corta no valida.');
    sh.getRange(rowNum, 11).setValue(data.shorturl);
    return data.shorturl;
  } finally {
    lock.releaseLock();
  }
}

function deleteUtm(id) {
  throw new Error('No se permite borrar UTMs desde el acceso público. El propietario puede administrarlas directamente en Google Sheets.');
}

function clearAllUtms() {
  throw new Error('La eliminación masiva está deshabilitada en la aplicación pública.');
}

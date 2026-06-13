/**
 * WEBHOOK — Google Таблица (Apps Script)
 * Google Cloud НЕ нужен. TG уже идёт через Vercel /api/leads
 *
 * script.google.com → вставить код → setupSheetLayout → Развернуть
 */

var CONFIG = {
  SHEET_ID: '1B6C7vMLSevW3wvAIUQXBkK8jdIMzk4QbCUSVB2DbDdY',
  SHEET_NAME: 'Лиды',
  TG_BOT_TOKEN: '',
  TG_CHAT_ID: ''
};

var SAPI_STATUSES = ['новый', 'валид', 'квал', 'трэш', 'дубль'];

var HEADERS = [
  'Дата', 'SAPI', 'Имя', 'Email', 'Телефон', 'WhatsApp',
  'Проблема (код)', 'Проблема (текст)', 'Возраст', 'Страна', 'Проживание',
  'Зависть (ответ)', 'Тип CRM', 'Частичный лид',
  'UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Content', 'UTM Term',
  'fbclid', 'gclid', 'yclid', 'subid', 'Страница'
];

var COL_PHONE = 5; // колонка E «Телефон»

function doPost(e) {
  try {
    var data = parseBody_(e);
    var sheet = ensureSheet_();
    appendRow_(sheet, data);
    SpreadsheetApp.flush();
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return ContentService.createTextOutput('Webhook OK. POST only.').setMimeType(ContentService.MimeType.TEXT);
}

function removeFilterSafe_(sheet) {
  try {
    var filter = sheet.getFilter();
    if (filter) filter.remove();
  } catch (err) {
    Logger.log('removeFilter: ' + err);
  }
}

function ensureFilter_(sheet) {
  removeFilterSafe_(sheet);
  SpreadsheetApp.flush();
  if (sheet.getFilter()) return;
  var rows = Math.max(sheet.getLastRow(), 100);
  sheet.getRange(1, 1, rows, HEADERS.length).createFilter();
}

function applySapiValidation_(sheet) {
  var rows = Math.max(sheet.getLastRow(), 500);
  // Снять проверку данных везде, кроме колонки SAPI (B)
  sheet.getRange(2, 1, rows, 1).clearDataValidations();
  sheet.getRange(2, 3, rows, HEADERS.length).clearDataValidations();
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(SAPI_STATUSES, true)
    .setAllowInvalid(false)
    .setHelpText('SAPI: новый, валид, квал, трэш, дубль')
    .build();
  sheet.getRange(2, 2, rows, 2).setDataValidation(rule);
}

/** Только SAPI — без очистки лидов. Запустить один раз в Apps Script. */
function fixSapiDropdownOnly() {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('Лист «' + CONFIG.SHEET_NAME + '» не найден');
  applySapiValidation_(sheet);
  SpreadsheetApp.flush();
  Logger.log('Выпадающий список только в колонке SAPI');
}

function setupSheetLayout() {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
  removeFilterSafe_(sheet);
  sheet.clear();
  removeFilterSafe_(sheet);
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setBackground('#2a1454')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setWrap(true);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  ensureFilter_(sheet);
  applySapiValidation_(sheet);

  sheet.setColumnWidth(1, 155);
  sheet.setColumnWidth(2, 95);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 185);
  sheet.setColumnWidth(5, 155);
  sheet.setColumnWidth(6, 85);
  sheet.setColumnWidth(7, 110);
  sheet.setColumnWidth(8, 175);
  sheet.setColumnWidth(9, 70);
  sheet.setColumnWidth(10, 110);
  sheet.setColumnWidth(11, 200);
  sheet.setColumnWidth(12, 180);
  sheet.setColumnWidth(13, 95);
  sheet.setColumnWidth(14, 95);
  for (var c = 15; c <= HEADERS.length - 1; c++) sheet.setColumnWidth(c, 115);
  sheet.setColumnWidth(HEADERS.length, 260);

  sheet.getRange('A2:A').setNumberFormat('dd.mm.yyyy hh:mm');

  var rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($E2<>"";COUNTIF($E:$E;$E2)>1)')
    .setBackground('#ffcccc')
    .setBold(true)
    .setRanges([sheet.getRange(2, 1, sheet.getMaxRows(), HEADERS.length)])
    .build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('новый').setBackground('#fff9d1').setRanges([sheet.getRange('B2:B')]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('валид').setBackground('#d1f0d1').setRanges([sheet.getRange('B2:B')]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('квал').setBackground('#c7ddf8').setRanges([sheet.getRange('B2:B')]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('трэш').setBackground('#e0e0e0').setRanges([sheet.getRange('B2:B')]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('дубль').setBackground('#f8cccc').setRanges([sheet.getRange('B2:B')]).build());
  sheet.setConditionalFormatRules(rules);

  SpreadsheetApp.flush();
  Logger.log('Таблица настроена');
}

function parseBody_(e) {
  if (e && e.postData && e.postData.contents) return JSON.parse(e.postData.contents);
  if (e && e.parameter && e.parameter.payload) return JSON.parse(e.parameter.payload);
  return {};
}

function ensureSheet_() {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  } else if (sheet.getRange(1, 2).getValue() !== 'SAPI') {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  return sheet;
}

function normPhone_(p) {
  if (!p) return '';
  return String(p).replace(/\D/g, '').slice(-15);
}

function findDupRows_(sheet, phone) {
  var target = normPhone_(phone);
  if (!target || target.length < 6) return [];
  var vals = sheet.getRange(2, COL_PHONE, Math.max(sheet.getLastRow(), 2), COL_PHONE).getValues();
  var rows = [];
  for (var i = 0; i < vals.length; i++) {
    if (normPhone_(vals[i][0]) === target) rows.push(i + 2);
  }
  return rows;
}

function appendRow_(sheet, data) {
  var utm = data.utm || {};
  sheet.appendRow([
    data.submittedAt ? new Date(data.submittedAt) : new Date(),
    'новый',
    data.name || '', data.email || '', data.phone || '',
    data.whatsapp ? 'Да' : 'Нет',
    data.pain || '', data.painLabel || '', data.age || '', data.geo || '',
    data.residency || '', data.belief || '', data.beliefType || '',
    data.partial ? 'Да' : 'Нет',
    utm.utm_source || '', utm.utm_medium || '', utm.utm_campaign || '',
    utm.utm_content || '', utm.utm_term || '',
    utm.fbclid || '', utm.gclid || '', utm.yclid || '',
    utm.subid || utm.sub_id || '', data.pageUrl || ''
  ]);
}

function sendTelegram_(data, dupRows) {
  if (!CONFIG.TG_BOT_TOKEN || !CONFIG.TG_CHAT_ID) return;
  var prefix = dupRows.length > 1
    ? '🔁 <b>ДУБЛЬ</b> (строки ' + dupRows.join(', ') + ')\n\n'
    : (data.partial ? '⏳ ' : '🆕 ');
  var text = prefix +
    '👤 ' + esc_(data.name) + ' | 📞 ' + esc_(data.phone || '—') + '\n' +
    '🌍 ' + esc_(data.geo) + ' | SAPI: новый';
  UrlFetchApp.fetch('https://api.telegram.org/bot' + CONFIG.TG_BOT_TOKEN + '/sendMessage', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ chat_id: CONFIG.TG_CHAT_ID, text: text, parse_mode: 'HTML' })
  });
}

function esc_(s) {
  if (!s) return '—';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function testLead() {
  var result = doPost({ postData: { contents: JSON.stringify({
    name: 'Тест', phone: '+49 123 456', geo: 'Германия', submittedAt: new Date().toISOString()
  }) } });
  Logger.log(result.getContent());
}

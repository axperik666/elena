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

var CAPI_STATUSES = [
  'новый',      // с ленда, в Facebook ещё не отправляли
  'валид',      // контакт проверен
  'квал',       // квалифицирован → отправить в CAPI
  'не квал',    // не квалифицирован → отправить в CAPI
  'трэш',       // мусор, в Facebook не отправлять
  'дубль',      // повтор
  'отправлен',  // событие уже ушло в CAPI
  'ошибка'      // не удалось отправить в CAPI
];

var HEADERS = [
  'Дата', 'CAPI', 'Имя', 'Email', 'Телефон', 'WhatsApp',
  'Проблема (код)', 'Проблема (текст)', 'Возраст', 'Страна', 'Проживание',
  'Зависть (ответ)', 'Тип CRM', 'Частичный лид',
  'UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Content', 'UTM Term',
  'fbclid', 'gclid', 'yclid', 'subid', 'Страница'
];

var LAST_COL = 'X'; // 24-я колонка

function dataRows_(sheet) {
  return Math.max(sheet.getLastRow(), 500);
}

function parseBody_(e) {
  if (e && e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (err) { Logger.log('JSON parse: ' + err); }
  }
  if (e && e.parameter && e.parameter.payload) {
    try { return JSON.parse(e.parameter.payload); } catch (err) { Logger.log('payload parse: ' + err); }
  }
  return {};
}

function doPost(e) {
  try {
    var data = parseBody_(e);
    if (!data.phone && !data.name) {
      return json_({ ok: false, error: 'Empty payload — нет phone/name' });
    }
    var sheet = ensureSheet_();
    appendRow_(sheet, data);
    SpreadsheetApp.flush();
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  var p = e && e.parameter;
  if (p && p.fix === 'capi') {
    try {
      fixCapiDropdownOnly();
      return json_({ ok: true, message: 'CAPI: заголовок и выпадающий список обновлены' });
    } catch (err) {
      return json_({ ok: false, error: String(err) });
    }
  }
  if (p && p.fix === 'phone') {
    try {
      fixPhoneColumnFormat();
      return json_({ ok: true, message: 'Колонка Телефон: формат текста применён' });
    } catch (err) {
      return json_({ ok: false, error: String(err) });
    }
  }
  return ContentService.createTextOutput('Webhook OK. POST only. GET ?fix=capi | ?fix=phone').setMimeType(ContentService.MimeType.TEXT);
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
  var n = Math.max(sheet.getLastRow(), 100);
  sheet.getRange('A1:' + LAST_COL + n).createFilter();
}

function applyCapiValidation_(sheet) {
  var n = dataRows_(sheet);
  sheet.getRange('B1').setValue('CAPI');
  // Снять проверку данных со всего листа, затем — только B
  sheet.getRange('A2:' + LAST_COL + n).clearDataValidations();
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CAPI_STATUSES, true)
    .setAllowInvalid(true)
    .setHelpText('CAPI (Facebook): новый → валид → квал / не квал → отправлен')
    .build();
  sheet.getRange('B2:B' + n).setDataValidation(rule);
}

function applyCapiColors_(sheet) {
  var capiRange = sheet.getRange('B2:B');
  var rules = sheet.getConditionalFormatRules().filter(function (rule) {
    var ranges = rule.getRanges();
    if (!ranges || !ranges.length) return true;
    return ranges[0].getColumn() !== 2;
  });
  var colors = [
    ['новый', '#fff9d1'],
    ['валид', '#d1f0d1'],
    ['квал', '#c7ddf8'],
    ['не квал', '#ffe0cc'],
    ['трэш', '#e0e0e0'],
    ['дубль', '#f8cccc'],
    ['отправлен', '#e8d4f8'],
    ['ошибка', '#ff9999']
  ];
  for (var i = 0; i < colors.length; i++) {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(colors[i][0])
      .setBackground(colors[i][1])
      .setRanges([capiRange])
      .build());
  }
  sheet.setConditionalFormatRules(rules);
}

/** CAPI: выпадающий список только в колонке B. Без удаления лидов. */
function fixCapiDropdownOnly() {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('Лист «' + CONFIG.SHEET_NAME + '» не найден');
  applyCapiValidation_(sheet);
  applyCapiColors_(sheet);
  SpreadsheetApp.flush();
  Logger.log('CAPI: выпадающий список и цвета обновлены');
}

/** @deprecated — используйте fixCapiDropdownOnly */
function fixSapiDropdownOnly() {
  fixCapiDropdownOnly();
}

function fixPhoneColumnFormat() {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('Лист «' + CONFIG.SHEET_NAME + '» не найден');
  sheet.getRange('E2:E').setNumberFormat('@');
  SpreadsheetApp.flush();
  Logger.log('Телефон: колонка E — формат текста');
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
  applyCapiValidation_(sheet);

  sheet.setColumnWidth(1, 155);
  sheet.setColumnWidth(2, 105);
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
  sheet.getRange('E2:E').setNumberFormat('@');

  var rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($E2<>"";COUNTIF($E:$E;$E2)>1)')
    .setBackground('#ffcccc')
    .setBold(true)
    .setRanges([sheet.getRange('A2:' + LAST_COL)])
    .build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('новый').setBackground('#fff9d1').setRanges([sheet.getRange('B2:B')]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('валид').setBackground('#d1f0d1').setRanges([sheet.getRange('B2:B')]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('квал').setBackground('#c7ddf8').setRanges([sheet.getRange('B2:B')]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('не квал').setBackground('#ffe0cc').setRanges([sheet.getRange('B2:B')]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('трэш').setBackground('#e0e0e0').setRanges([sheet.getRange('B2:B')]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('дубль').setBackground('#f8cccc').setRanges([sheet.getRange('B2:B')]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('отправлен').setBackground('#e8d4f8').setRanges([sheet.getRange('B2:B')]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('ошибка').setBackground('#ff9999').setRanges([sheet.getRange('B2:B')]).build());
  sheet.setConditionalFormatRules(rules);

  SpreadsheetApp.flush();
  Logger.log('Таблица настроена');
}

function ensureSheet_() {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    applyCapiValidation_(sheet);
    applyCapiColors_(sheet);
  } else {
    var b1 = String(sheet.getRange(1, 2).getValue() || '').trim();
    if (b1 === 'SAPI') {
      applyCapiValidation_(sheet);
      applyCapiColors_(sheet);
      Logger.log('CAPI: заголовок SAPI переименован в CAPI');
    } else if (b1 !== 'CAPI') {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      applyCapiValidation_(sheet);
      applyCapiColors_(sheet);
    }
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
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var vals = sheet.getRange('E2:E' + lastRow).getValues();
  var rows = [];
  for (var i = 0; i < vals.length; i++) {
    if (normPhone_(vals[i][0]) === target) rows.push(i + 2);
  }
  return rows;
}

var PHONE_COL = 5;

function compactPhoneForSheet_(phone) {
  if (!phone) return '';
  var digits = String(phone).replace(/\D/g, '');
  return digits ? '+' + digits : '';
}

function setPhoneCell_(sheet, row, phone) {
  var compact = compactPhoneForSheet_(phone);
  if (!compact) return;
  var cell = sheet.getRange(row, PHONE_COL);
  cell.setNumberFormat('@');
  cell.setValue(compact);
}

function appendRow_(sheet, data) {
  var utm = data.utm || {};
  var phone = data.phone || '';
  sheet.appendRow([
    data.submittedAt ? new Date(data.submittedAt) : new Date(),
    'новый',
    data.name || '', data.email || '', '',
    data.whatsapp ? 'Да' : 'Нет',
    data.pain || '', data.painLabel || '', data.age || '', data.geo || '',
    data.residency || '', data.belief || '', data.beliefType || '',
    data.partial ? 'Да' : 'Нет',
    utm.utm_source || '', utm.utm_medium || '', utm.utm_campaign || '',
    utm.utm_content || '', utm.utm_term || '',
    utm.fbclid || '', utm.gclid || '', utm.yclid || '',
    utm.subid || utm.sub_id || '', data.pageUrl || ''
  ]);
  setPhoneCell_(sheet, sheet.getLastRow(), phone);
}

function sendTelegram_(data, dupRows) {
  if (!CONFIG.TG_BOT_TOKEN || !CONFIG.TG_CHAT_ID) return;
  var prefix = dupRows.length > 1
    ? '🔁 <b>ДУБЛЬ</b> (строки ' + dupRows.join(', ') + ')\n\n'
    : (data.partial ? '⏳ ' : '🆕 ');
  var text = prefix +
    '👤 ' + esc_(data.name) + ' | 📞 ' + esc_(data.phone || '—') + '\n' +
    '🌍 ' + esc_(data.geo) + ' | CAPI: новый';
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

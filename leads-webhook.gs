/**
 * ЗАПАСНОЙ WEBHOOK — Google Apps Script (без Vercel API)
 * Основной способ: /api/leads на Vercel + Google Sheets API v4
 *
 * script.google.com → вставить код → Развернуть как веб-приложение
 */

var CONFIG = {
  SHEET_ID: 'ВСТАВЬТЕ_ID_ТАБЛИЦЫ',
  SHEET_NAME: 'Лиды',
  TG_BOT_TOKEN: 'ВСТАВЬТЕ_TOKEN_БОТА',
  TG_CHAT_ID: 'ВСТАВЬТЕ_CHAT_ID'
};

var HEADERS = [
  'Дата', 'Имя', 'Email', 'Телефон', 'WhatsApp',
  'Проблема (код)', 'Проблема (текст)', 'Возраст', 'Страна', 'Проживание',
  'Зависть (ответ)', 'Тип CRM', 'Частичный лид',
  'UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Content', 'UTM Term',
  'fbclid', 'gclid', 'yclid', 'subid', 'Страница'
];

function doPost(e) {
  try {
    var data = parseBody_(e);
    var sheet = ensureSheet_();
    appendRow_(sheet, data);
    sendTelegram_(data);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return ContentService.createTextOutput('Webhook OK. POST only.').setMimeType(ContentService.MimeType.TEXT);
}

/** Запустите один раз: настроит шапку, фильтр, ширину колонок */
function setupSheetLayout() {
  var sheet = ensureSheet_();
  sheet.clear();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setBackground('#2e1065')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, sheet.getMaxRows(), HEADERS.length).createFilter();
  sheet.setColumnWidths(1, HEADERS.length, 130);
  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(4, 160);
  sheet.setColumnWidth(23, 280);
  sheet.getRange('A2:A').setNumberFormat('dd.mm.yyyy hh:mm');
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
  if (sheet.getLastRow() === 0) setupSheetLayout();
  return sheet;
}

function appendRow_(sheet, data) {
  var utm = data.utm || {};
  sheet.appendRow([
    data.submittedAt ? new Date(data.submittedAt) : new Date(),
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

function sendTelegram_(data) {
  if (!CONFIG.TG_BOT_TOKEN || String(CONFIG.TG_BOT_TOKEN).indexOf('ВСТАВЬТЕ') !== -1) return;
  var utm = data.utm || {};
  var utmLines = [];
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','yclid','subid','sub_id'].forEach(function(k) {
    if (utm[k]) utmLines.push('• ' + k + ': ' + utm[k]);
  });
  var prefix = data.partial ? '⏳ <b>Частичный лид</b>\n\n' : '🆕 <b>Новый лид</b>\n\n';
  var text = prefix +
    '👤 <b>Имя:</b> ' + esc_(data.name) + '\n' +
    '📧 <b>Email:</b> ' + esc_(data.email || '—') + '\n' +
    '📞 <b>Телефон:</b> ' + esc_(data.phone || '—') + '\n' +
    '🔮 <b>Проблема:</b> ' + esc_(data.painLabel || data.pain) + '\n' +
    '🌍 <b>Страна:</b> ' + esc_(data.geo);
  if (utmLines.length) text += '\n\n📊 <b>Метки:</b>\n' + utmLines.join('\n');
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
  setupSheetLayout();
  doPost({ postData: { contents: JSON.stringify({
    name: 'Тест', email: 't@mail.com', phone: '+49 123', whatsapp: true,
    pain: 'Порча', painLabel: 'Сглаз', age: 45, geo: 'Германия',
    residency: 'Проживаю уже более 5 лет', belief: 'Да', beliefType: 'believer',
    utm: { utm_source: 'fb', fbclid: 'x' }, pageUrl: 'https://example.com'
  }) } });
}

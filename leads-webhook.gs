/**
 * WEBHOOK — Google Таблица + Telegram
 * Вставьте в script.google.com → Развернуть как веб-приложение
 */

var CONFIG = {
  SHEET_ID: 'ВСТАВЬТЕ_ID_ТАБЛИЦЫ',
  SHEET_NAME: 'Лиды',
  TG_BOT_TOKEN: 'ВСТАВЬТЕ_TOKEN_БОТА',
  TG_CHAT_ID: 'ВСТАВЬТЕ_CHAT_ID'
};

var HEADERS = [
  'Дата',
  'Имя',
  'Email',
  'Телефон',
  'WhatsApp',
  'Проблема (код)',
  'Проблема (текст)',
  'Возраст',
  'Страна',
  'Проживание',
  'Зависть (ответ)',
  'Тип CRM',
  'Частичный лид',
  'UTM Source',
  'UTM Medium',
  'UTM Campaign',
  'UTM Content',
  'UTM Term',
  'fbclid',
  'gclid',
  'yclid',
  'subid',
  'Страница'
];

function doPost(e) {
  try {
    var data = parseBody_(e);
    ensureSheet_();
    appendRow_(data);
    sendTelegram_(data);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput('Webhook OK. POST only.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function parseBody_(e) {
  if (e && e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }
  if (e && e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }
  return {};
}

function ensureSheet_() {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function appendRow_(data) {
  var utm = data.utm || {};
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName(CONFIG.SHEET_NAME);
  sheet.appendRow([
    new Date(),
    data.name || '',
    data.email || '',
    data.phone || '',
    data.whatsapp ? 'Да' : 'Нет',
    data.pain || '',
    data.painLabel || '',
    data.age || '',
    data.geo || '',
    data.residency || '',
    data.belief || '',
    data.beliefType || '',
    data.partial ? 'Да' : 'Нет',
    utm.utm_source || '',
    utm.utm_medium || '',
    utm.utm_campaign || '',
    utm.utm_content || '',
    utm.utm_term || '',
    utm.fbclid || '',
    utm.gclid || '',
    utm.yclid || '',
    utm.subid || utm.sub_id || '',
    data.pageUrl || ''
  ]);
}

function sendTelegram_(data) {
  if (!CONFIG.TG_BOT_TOKEN || !CONFIG.TG_CHAT_ID) return;
  if (String(CONFIG.TG_BOT_TOKEN).indexOf('ВСТАВЬТЕ') !== -1) return;

  var utm = data.utm || {};
  var utmLines = [];
  var utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'yclid', 'subid', 'sub_id'];
  for (var i = 0; i < utmKeys.length; i++) {
    var k = utmKeys[i];
    if (utm[k]) utmLines.push('• ' + k + ': ' + utm[k]);
  }

  var prefix = data.partial ? '⏳ <b>Частичный лид (без телефона)</b>\n\n' : '🆕 <b>Новый лид с лендинга</b>\n\n';

  var text =
    prefix +
    '👤 <b>Имя:</b> ' + esc_(data.name) + '\n' +
    '📧 <b>Email:</b> ' + esc_(data.email || '—') + '\n' +
    '📞 <b>Телефон:</b> ' + esc_(data.phone || '—') + '\n' +
    '💬 <b>WhatsApp:</b> ' + (data.whatsapp ? 'Да' : 'Нет') + '\n\n' +
    '🔮 <b>Проблема:</b> ' + esc_(data.painLabel || data.pain) + '\n' +
    '🎂 <b>Возраст:</b> ' + esc_(data.age) + '\n' +
    '🌍 <b>Страна:</b> ' + esc_(data.geo) + '\n' +
    '🏠 <b>Проживание:</b> ' + esc_(data.residency) + '\n' +
    '✨ <b>Зависть:</b> ' + esc_(data.belief || '—') + '\n' +
    '🎯 <b>Тип CRM:</b> ' + esc_(data.beliefType || '—');

  if (utmLines.length) {
    text += '\n\n📊 <b>Метки:</b>\n' + utmLines.join('\n');
  }

  UrlFetchApp.fetch('https://api.telegram.org/bot' + CONFIG.TG_BOT_TOKEN + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: CONFIG.TG_CHAT_ID,
      text: text,
      parse_mode: 'HTML'
    }),
    muteHttpExceptions: true
  });
}

function esc_(s) {
  if (s === undefined || s === null || s === '') return '—';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function testLead() {
  doPost({
    postData: {
      contents: JSON.stringify({
        name: 'Тест',
        email: 'test@mail.com',
        pain: 'Порча',
        painLabel: 'Сглаз, порча, проклятие',
        age: 45,
        geo: 'Германия',
        residency: 'Проживаю уже более 5 лет',
        belief: 'Верит',
        beliefType: 'believer',
        phone: '+49 123 456 7890',
        whatsapp: true,
        utm: { utm_source: 'facebook', utm_campaign: 'test', fbclid: 'abc123' },
        pageUrl: 'https://example.com?utm_source=facebook'
      })
    }
  });
}

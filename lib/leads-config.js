/** Колонки таблицы «Лиды» — порядок важен */
const HEADERS = [
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

const SHEET_TAB = 'Лиды';

function buildRow(data) {
  const utm = data.utm || {};
  const submitted = data.submittedAt ? new Date(data.submittedAt) : new Date();

  return [
    submitted.toISOString(),
    data.name || '',
    data.email || '',
    data.phone || '',
    data.whatsapp ? 'Да' : 'Нет',
    data.pain || '',
    data.painLabel || '',
    data.age != null ? String(data.age) : '',
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
  ];
}

function escHtml(s) {
  if (s === undefined || s === null || s === '') return '—';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildTelegramText(data) {
  const utm = data.utm || {};
  const utmKeys = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'fbclid', 'gclid', 'yclid', 'subid', 'sub_id'
  ];
  const utmLines = utmKeys
    .filter((k) => utm[k])
    .map((k) => '• ' + k + ': ' + utm[k]);

  const prefix = data.partial
    ? '⏳ <b>Частичный лид (без телефона)</b>\n\n'
    : '🆕 <b>Новый лид с лендинга</b>\n\n';

  let text =
    prefix +
    '👤 <b>Имя:</b> ' + escHtml(data.name) + '\n' +
    '📧 <b>Email:</b> ' + escHtml(data.email || '—') + '\n' +
    '📞 <b>Телефон:</b> ' + escHtml(data.phone || '—') + '\n' +
    '💬 <b>WhatsApp:</b> ' + (data.whatsapp ? 'Да' : 'Нет') + '\n\n' +
    '🔮 <b>Проблема:</b> ' + escHtml(data.painLabel || data.pain) + '\n' +
    '🎂 <b>Возраст:</b> ' + escHtml(data.age) + '\n' +
    '🌍 <b>Страна:</b> ' + escHtml(data.geo) + '\n' +
    '🏠 <b>Проживание:</b> ' + escHtml(data.residency) + '\n' +
    '✨ <b>Зависть:</b> ' + escHtml(data.belief || '—') + '\n' +
    '🎯 <b>Тип CRM:</b> ' + escHtml(data.beliefType || '—');

  if (utmLines.length) {
    text += '\n\n📊 <b>Метки:</b>\n' + utmLines.join('\n');
  }

  return text;
}

module.exports = {
  HEADERS,
  SHEET_TAB,
  buildRow,
  buildTelegramText
};

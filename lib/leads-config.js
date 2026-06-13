/** Колонки таблицы «Лиды» — порядок важен */
const HEADERS = [
  'Дата',
  'SAPI',
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

/** Статусы SAPI — выпадающий список для дедупликации и CRM */
const SAPI_STATUSES = ['новый', 'валид', 'квал', 'трэш', 'дубль'];

const SAPI_DEFAULT = 'новый';

const SHEET_TAB = 'Лиды';

/** Индексы колонок (0-based) */
const COL = {
  DATE: 0,
  SAPI: 1,
  NAME: 2,
  EMAIL: 3,
  PHONE: 4,
  WHATSAPP: 5,
  PAIN: 6,
  PAIN_LABEL: 7,
  AGE: 8,
  GEO: 9,
  RESIDENCY: 10,
  BELIEF: 11,
  BELIEF_TYPE: 12,
  PARTIAL: 13
};

/** Буква колонки «Телефон» для формул */
const PHONE_COL_LETTER = 'E';

function normalizePhone(phone) {
  if (!phone) return '';
  var digits = String(phone).replace(/\D/g, '');
  if (digits.length > 10 && digits.indexOf('0') === 0) {
    digits = digits.replace(/^0+/, '');
  }
  return digits.slice(-15);
}

function buildRow(data, sapiStatus) {
  const utm = data.utm || {};
  const submitted = data.submittedAt ? new Date(data.submittedAt) : new Date();
  const status = sapiStatus || SAPI_DEFAULT;

  return [
    submitted.toISOString(),
    status,
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

function buildTelegramText(data, meta) {
  const utm = data.utm || {};
  const utmKeys = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'fbclid', 'gclid', 'yclid', 'subid', 'sub_id'
  ];
  const utmLines = utmKeys
    .filter((k) => utm[k])
    .map((k) => '• ' + k + ': ' + utm[k]);

  var prefix = data.partial
    ? '⏳ <b>Частичный лид (без телефона)</b>\n\n'
    : '🆕 <b>Новый лид с лендинга</b>\n\n';

  if (meta && meta.duplicate) {
    prefix = '🔁 <b>ДУБЛЬ по телефону</b> (строки ' + meta.duplicateRows.join(', ') + ')\n\n' + prefix;
  }

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
    '🎯 <b>Тип CRM:</b> ' + escHtml(data.beliefType || '—') + '\n' +
    '📋 <b>SAPI:</b> ' + escHtml((meta && meta.sapi) || SAPI_DEFAULT);

  if (utmLines.length) {
    text += '\n\n📊 <b>Метки:</b>\n' + utmLines.join('\n');
  }

  return text;
}

module.exports = {
  HEADERS,
  SAPI_STATUSES,
  SAPI_DEFAULT,
  SHEET_TAB,
  COL,
  PHONE_COL_LETTER,
  normalizePhone,
  buildRow,
  buildTelegramText
};

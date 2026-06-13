/** Колонки таблицы «Лиды» — порядок важен */
const HEADERS = [
  'Дата',
  'CAPI',
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

/**
 * CAPI — Facebook Conversions API: статус лида для отправки в Meta.
 * Менеджер проставляет вручную после звонка/проверки.
 */
const CAPI_STATUSES = [
  'новый',      // с ленда, в Facebook ещё не отправляли
  'валид',      // контакт проверен, ждёт решения квал/не квал
  'квал',       // квалифицирован → отправить в CAPI (хороший лид)
  'не квал',    // не квалифицирован → отправить в CAPI (отказ)
  'трэш',       // мусор, в Facebook не отправлять
  'дубль',      // повтор, в Facebook не отправлять
  'отправлен',  // событие уже ушло в CAPI
  'ошибка'      // не удалось отправить в CAPI, повторить
];

const CAPI_DEFAULT = 'новый';

/** @deprecated используйте CAPI_* */
const SAPI_STATUSES = CAPI_STATUSES;
const SAPI_DEFAULT = CAPI_DEFAULT;

const SHEET_TAB = 'Лиды';

/** Индексы колонок (0-based) */
const COL = {
  DATE: 0,
  CAPI: 1,
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

/** @deprecated */
COL.SAPI = COL.CAPI;

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

/** Только цифры номера */
function phoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/** Для ячейки Sheets: + и цифры без пробелов */
function compactPhoneForSheet(phone) {
  var digits = phoneDigits(phone);
  return digits ? '+' + digits : '';
}

/** Формула Sheets: ="+37051256262" — не даёт #ERROR! */
function sheetPhoneFormula(phone) {
  var digits = phoneDigits(phone);
  if (!digits) return '';
  return '="+' + digits + '"';
}

/** @deprecated — appendRow игнорирует апостроф; используйте sheetPhoneFormula */
function toSheetText(value) {
  return sheetPhoneFormula(value);
}

function buildRow(data, capiStatus) {
  const utm = data.utm || {};
  const submitted = data.submittedAt ? new Date(data.submittedAt) : new Date();
  const status = capiStatus || CAPI_DEFAULT;

  return [
    submitted.toISOString(),
    status,
    data.name || '',
    data.email || '',
    '',
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

  const capi = (meta && (meta.capi || meta.sapi)) || CAPI_DEFAULT;

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
    '📋 <b>CAPI:</b> ' + escHtml(capi);

  if (utmLines.length) {
    text += '\n\n📊 <b>Метки:</b>\n' + utmLines.join('\n');
  }

  return text;
}

module.exports = {
  HEADERS,
  CAPI_STATUSES,
  CAPI_DEFAULT,
  SAPI_STATUSES,
  SAPI_DEFAULT,
  SHEET_TAB,
  COL,
  PHONE_COL_LETTER,
  normalizePhone,
  phoneDigits,
  compactPhoneForSheet,
  sheetPhoneFormula,
  toSheetText,
  buildRow,
  buildTelegramText
};

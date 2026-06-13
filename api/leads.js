const { SHEET_TAB } = require('../lib/leads-config');
const { getEnv, appendLead } = require('../lib/google-sheets');
const { appendLeadViaWebapp } = require('../lib/google-webapp');
const { sendTelegramLead } = require('../lib/telegram');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function parseBody(req) {
  let data = req.body;
  if (typeof data === 'string') {
    data = JSON.parse(data);
  }
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid JSON body');
  }
  return data;
}

module.exports = async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      message: 'Leads API. POST JSON to save lead.',
      telegram: !!(getEnv('TG_BOT_TOKEN') && getEnv('TG_CHAT_ID')),
      sheets: !!(getEnv('GOOGLE_SHEET_ID') || getEnv('GOOGLE_SHEET_WEBAPP_URL'))
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let data;
  try {
    data = parseBody(req);
  } catch (err) {
    return res.status(400).json({ ok: false, error: String(err.message || err) });
  }

  const spreadsheetId = getEnv('GOOGLE_SHEET_ID');
  const webappUrl = getEnv('GOOGLE_SHEET_WEBAPP_URL');
  const tabName = getEnv('GOOGLE_SHEET_TAB') || SHEET_TAB;
  const hasTelegram = !!(getEnv('TG_BOT_TOKEN') && getEnv('TG_CHAT_ID'));

  let sheetResult = null;
  let sheetError = null;

  if (spreadsheetId) {
    try {
      sheetResult = await appendLead(spreadsheetId, tabName, data);
    } catch (err) {
      sheetError = String(err.message || err);
      console.error('Sheet API save failed:', err);
    }
  } else if (webappUrl) {
    try {
      await appendLeadViaWebapp(data);
      sheetResult = { sapi: 'новый', duplicate: false, duplicateRows: [] };
    } catch (err) {
      sheetError = String(err.message || err);
      console.error('Sheet webapp save failed:', err);
    }
  } else {
    sheetError = 'Google Sheet not configured (optional)';
  }

  let telegramOk = false;
  let telegramError = null;

  if (hasTelegram) {
    try {
      await sendTelegramLead(data, {
        duplicate: sheetResult ? sheetResult.duplicate : false,
        duplicateRows: sheetResult ? sheetResult.duplicateRows : [],
        sapi: (sheetResult && sheetResult.sapi) || 'новый'
      });
      telegramOk = true;
    } catch (err) {
      telegramError = String(err.message || err);
      console.error('Telegram failed:', err);
    }
  } else {
    telegramError = 'TG_BOT_TOKEN or TG_CHAT_ID not configured on Vercel';
  }

  const ok = telegramOk || !!sheetResult;

  if (!ok) {
    return res.status(500).json({
      ok: false,
      error: 'Lead not saved',
      sheetError,
      telegramError
    });
  }

  return res.status(200).json({
    ok: true,
    telegram: telegramOk,
    sheet: !!sheetResult,
    sheetError: sheetResult ? null : sheetError,
    telegramError: telegramOk ? null : telegramError,
    duplicate: sheetResult ? sheetResult.duplicate : false,
    duplicateRows: sheetResult ? sheetResult.duplicateRows : [],
    row: sheetResult ? sheetResult.newRowNum : null
  });
};

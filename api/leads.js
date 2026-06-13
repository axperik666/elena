const { SHEET_TAB } = require('../lib/leads-config');
const { getEnvAny } = require('../lib/get-env');
const { appendLead } = require('../lib/google-sheets');
const { appendLeadViaWebapp } = require('../lib/google-webapp');
const { sendTelegramLead } = require('../lib/telegram');

function getEnv(name) {
  return getEnvAny(name);
}

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

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error('Apps Script timeout after ' + ms + 'ms'));
      }, ms);
    })
  ]);
}

module.exports = async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const hasTg = !!(getEnvAny('TG_BOT_TOKEN') && getEnvAny('TG_CHAT_ID'));
    const hasServiceAccount = !!(getEnvAny('GOOGLE_SERVICE_ACCOUNT_EMAIL') && getEnvAny('GOOGLE_PRIVATE_KEY'));
    const hasSheetsApi = !!(getEnvAny('GOOGLE_SHEET_ID') && hasServiceAccount);
    const hasWebapp = !!getEnvAny('GOOGLE_SHEET_WEBAPP_URL');
    return res.status(200).json({
      ok: true,
      message: 'Leads API. POST JSON to save lead.',
      telegram: hasTg,
      sheets: hasSheetsApi || hasWebapp,
      hint: hasTg ? null : 'Добавьте TG_BOT_TOKEN и TG_CHAT_ID в Vercel → Settings → Environment Variables → Redeploy'
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

  const spreadsheetId = getEnvAny('GOOGLE_SHEET_ID');
  const webappUrl = getEnvAny('GOOGLE_SHEET_WEBAPP_URL');
  const tabName = getEnv('GOOGLE_SHEET_TAB') || SHEET_TAB;
  const hasTelegram = !!(getEnvAny('TG_BOT_TOKEN') && getEnvAny('TG_CHAT_ID'));
  const hasServiceAccount = !!(getEnvAny('GOOGLE_SERVICE_ACCOUNT_EMAIL') && getEnvAny('GOOGLE_PRIVATE_KEY'));

  let sheetResult = null;
  let sheetError = null;

  if (spreadsheetId && hasServiceAccount) {
    try {
      sheetResult = await appendLead(spreadsheetId, tabName, data);
    } catch (err) {
      sheetError = String(err.message || err);
      console.error('Sheet API save failed:', err);
    }
  }

  let telegramOk = false;
  let telegramError = null;

  const tasks = [];

  if (!sheetResult && webappUrl) {
    tasks.push(
      withTimeout(appendLeadViaWebapp(data), 10000)
        .then(function () {
          sheetResult = { capi: 'новый', sapi: 'новый', duplicate: false, duplicateRows: [] };
        })
        .catch(function (err) {
          sheetError = String(err.message || err);
          console.error('Sheet webapp save failed:', err);
        })
    );
  } else if (!sheetResult && !webappUrl) {
    sheetError = 'Google Sheet not configured (optional)';
  }

  if (hasTelegram) {
    tasks.push(
      sendTelegramLead(data, {
        duplicate: false,
        duplicateRows: [],
        sapi: 'новый',
        capi: 'новый'
      })
        .then(function () {
          telegramOk = true;
        })
        .catch(function (err) {
          telegramError = String(err.message || err);
          console.error('Telegram failed:', err);
        })
    );
  } else {
    telegramError = 'TG_BOT_TOKEN or TG_CHAT_ID not configured on Vercel';
  }

  if (tasks.length) {
    await Promise.allSettled(tasks);
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

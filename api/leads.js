const { SHEET_TAB, compactPhoneForSheet } = require('../lib/leads-config');
const { getEnvAny } = require('../lib/get-env');
const { appendLead } = require('../lib/google-sheets');
const { appendLeadViaWebapp } = require('../lib/google-webapp');
const { sendTelegramLead } = require('../lib/telegram');
const { sendFacebookLeadEvent } = require('../lib/facebook-capi');

const SHEET_TIMEOUT_MS = 8000;

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
    const hasFacebook = !!(getEnvAny('FB_PIXEL_ID') && getEnvAny('FB_ACCESS_TOKEN'));
    return res.status(200).json({
      ok: true,
      message: 'Leads API. POST JSON to save lead.',
      telegram: hasTg,
      sheets: hasSheetsApi || hasWebapp,
      facebook: hasFacebook,
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

  if (data.phone) {
    data.phone = compactPhoneForSheet(data.phone);
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

  if (!sheetResult && webappUrl) {
    try {
      await withTimeout(appendLeadViaWebapp(data), SHEET_TIMEOUT_MS);
      sheetResult = { capi: 'новый', sapi: 'новый', duplicate: false, duplicateRows: [] };
    } catch (err) {
      sheetError = String(err.message || err);
      console.error('Sheet webapp save failed:', err);
    }
  } else if (!sheetResult && !webappUrl) {
    sheetError = 'Google Sheet not configured (optional)';
  }

  let telegramOk = false;
  let telegramError = null;

  if (hasTelegram) {
    try {
      await sendTelegramLead(data, {
        duplicate: sheetResult ? sheetResult.duplicate : false,
        duplicateRows: sheetResult ? sheetResult.duplicateRows : [],
        capi: 'новый',
        sapi: 'новый'
      });
      telegramOk = true;
    } catch (err) {
      telegramError = String(err.message || err);
      console.error('Telegram failed:', err);
    }
  } else {
    telegramError = 'TG_BOT_TOKEN or TG_CHAT_ID not configured on Vercel';
  }

  let facebookOk = false;
  let facebookError = null;

  const fbPixelId = getEnvAny('FB_PIXEL_ID');
  const fbAccessToken = getEnvAny('FB_ACCESS_TOKEN');
  if (fbPixelId && fbAccessToken) {
    try {
      const clientIp =
        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        req.headers['x-real-ip'] ||
        '';
      await sendFacebookLeadEvent(data, {
        pixelId: fbPixelId,
        accessToken: fbAccessToken,
        clientIp,
        userAgent: req.headers['user-agent'] || ''
      });
      facebookOk = true;
    } catch (err) {
      facebookError = String(err.message || err);
      console.error('Facebook CAPI failed:', err);
    }
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
    facebook: facebookOk,
    sheetError: sheetResult ? null : sheetError,
    telegramError: telegramOk ? null : telegramError,
    facebookError: facebookOk ? null : facebookError,
    duplicate: sheetResult ? sheetResult.duplicate : false,
    duplicateRows: sheetResult ? sheetResult.duplicateRows : [],
    row: sheetResult ? sheetResult.newRowNum : null
  });
};

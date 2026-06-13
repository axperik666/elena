const { SHEET_TAB } = require('../lib/leads-config');
const { getEnv, appendLead } = require('../lib/google-sheets');
const { sendTelegramLead } = require('../lib/telegram');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'Leads API. POST JSON to save lead.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const spreadsheetId = getEnv('GOOGLE_SHEET_ID');
    if (!spreadsheetId) {
      return res.status(500).json({ ok: false, error: 'GOOGLE_SHEET_ID not configured' });
    }

    let data = req.body;
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid JSON body' });
    }

    const tabName = getEnv('GOOGLE_SHEET_TAB') || SHEET_TAB;

    await appendLead(spreadsheetId, tabName, data);

    try {
      await sendTelegramLead(data);
    } catch (tgErr) {
      console.error('Telegram failed:', tgErr);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Lead save failed:', err);
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
};

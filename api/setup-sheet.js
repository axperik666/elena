const { SHEET_TAB } = require('../lib/leads-config');
const { getEnv, setupSheetLayout } = require('../lib/google-sheets');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST only' });
  }

  const secret = getEnv('SETUP_SECRET');
  const auth = req.headers.authorization || '';
  if (!secret || auth !== 'Bearer ' + secret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  try {
    const spreadsheetId = getEnv('GOOGLE_SHEET_ID');
    if (!spreadsheetId) {
      return res.status(500).json({ ok: false, error: 'GOOGLE_SHEET_ID not configured' });
    }

    const tabName = getEnv('GOOGLE_SHEET_TAB') || SHEET_TAB;
    const result = await setupSheetLayout(spreadsheetId, tabName);

    return res.status(200).json({
      ok: true,
      message: 'Sheet layout created',
      spreadsheetId,
      tabName,
      columns: result.headers
    });
  } catch (err) {
    console.error('Setup failed:', err);
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
};

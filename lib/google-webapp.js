const { getEnv } = require('./google-sheets');

async function appendLeadViaWebapp(data) {
  const url = getEnv('GOOGLE_SHEET_WEBAPP_URL');
  if (!url) return null;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error('Apps Script webhook failed: ' + text);
  }

  try {
    return await res.json();
  } catch (_) {
    return { ok: true };
  }
}

module.exports = { appendLeadViaWebapp };

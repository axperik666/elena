const { getEnvAny } = require('./get-env');

async function postToAppsScript(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
    redirect: 'follow',
    signal: AbortSignal.timeout(25000)
  });
  return res;
}

async function appendLeadViaWebapp(data) {
  const url = getEnvAny('GOOGLE_SHEET_WEBAPP_URL');
  if (!url) return null;

  const body = JSON.stringify(data);
  const res = await postToAppsScript(url, body);

  if (!res.ok) {
    const text = await res.text();
    throw new Error('Apps Script webhook failed: ' + text.slice(0, 200));
  }

  try {
    return await res.json();
  } catch (_) {
    return { ok: true };
  }
}

module.exports = { appendLeadViaWebapp, postToAppsScript };

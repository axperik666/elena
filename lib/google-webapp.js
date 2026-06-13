const { getEnvAny } = require('./get-env');

async function postToAppsScript(url, body) {
  const headers = { 'Content-Type': 'text/plain;charset=utf-8' };
  let res = await fetch(url, {
    method: 'POST',
    headers,
    body,
    redirect: 'manual'
  });

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location');
    if (!location) {
      throw new Error('Apps Script redirect without location');
    }
    res = await fetch(location, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': String(Buffer.byteLength(body, 'utf8'))
      },
      body
    });
  }

  return res;
}

async function appendLeadViaWebapp(data) {
  const url = getEnvAny('GOOGLE_SHEET_WEBAPP_URL');
  if (!url) return null;

  const body = JSON.stringify(data);
  const res = await postToAppsScript(url, body);

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

module.exports = { appendLeadViaWebapp, postToAppsScript };

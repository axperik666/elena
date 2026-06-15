const crypto = require('crypto');

const FB_API_VERSION = 'v21.0';

function sha256(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(value).digest('hex');
}

function phoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function buildFbc(fbclid) {
  if (!fbclid) return null;
  return 'fb.1.' + Math.floor(Date.now() / 1000) + '.' + fbclid;
}

function buildUserData(data, meta) {
  const utm = data.utm || {};
  const userData = {};

  const phone = phoneDigits(data.phone);
  if (phone) {
    const hashed = sha256(phone);
    if (hashed) userData.ph = [hashed];
  }

  const email = String(data.email || '').trim().toLowerCase();
  if (email) {
    const hashed = sha256(email);
    if (hashed) userData.em = [hashed];
  }

  if (meta.clientIp) userData.client_ip_address = meta.clientIp;
  if (meta.userAgent) userData.client_user_agent = meta.userAgent;

  const fbc = data.fbc || buildFbc(utm.fbclid);
  if (fbc) userData.fbc = fbc;
  if (data.fbp) userData.fbp = data.fbp;

  return userData;
}

async function sendFacebookLeadEvent(data, options) {
  const pixelId = (options.pixelId || '').trim();
  const accessToken = (options.accessToken || '').trim();
  if (!pixelId || !accessToken) {
    return { ok: false, skipped: true, reason: 'FB_PIXEL_ID or FB_ACCESS_TOKEN not configured' };
  }

  if (data.partial) {
    return { ok: false, skipped: true, reason: 'partial lead' };
  }

  const eventId = data.eventId || ('lead_srv_' + Date.now());
  const event = {
    event_name: 'Lead',
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    event_source_url: data.pageUrl || '',
    action_source: 'website',
    user_data: buildUserData(data, options)
  };

  const url =
    'https://graph.facebook.com/' +
    FB_API_VERSION +
    '/' +
    encodeURIComponent(pixelId) +
    '/events?access_token=' +
    encodeURIComponent(accessToken);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [event] })
  });

  const body = await res.json().catch(function () {
    return {};
  });

  if (!res.ok) {
    const err = body.error || {};
    throw new Error(err.message || 'Facebook CAPI error ' + res.status);
  }

  return {
    ok: true,
    eventId,
    eventsReceived: body.events_received,
    fbtraceId: body.fbtrace_id || null
  };
}

module.exports = { sendFacebookLeadEvent };

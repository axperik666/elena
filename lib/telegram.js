const { buildTelegramText } = require('./leads-config');

const { getEnvAny } = require('./get-env');

async function sendTelegramLead(data, meta) {
  const token = getEnvAny('TG_BOT_TOKEN');
  const chatId = getEnvAny('TG_CHAT_ID');
  if (!token || !chatId || String(token).includes('ВСТАВЬТЕ')) {
    throw new Error('TG_BOT_TOKEN or TG_CHAT_ID not configured');
  }

  const res = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: buildTelegramText(data, meta),
      parse_mode: 'HTML'
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error('Telegram error: ' + body);
  }

  return { ok: true };
}

module.exports = { sendTelegramLead };

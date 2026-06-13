const { buildTelegramText } = require('./leads-config');

async function sendTelegramLead(data) {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;
  if (!token || !chatId || String(token).includes('ВСТАВЬТЕ')) return { skipped: true };

  const res = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: buildTelegramText(data),
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

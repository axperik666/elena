const { DEFAULT_GOOGLE_SHEET_WEBAPP_URL } = require('./webapp-url');

function getEnv(name) {
  const v = process.env[name];
  if (v && !String(v).includes('ВСТАВЬТЕ')) return v;
  return '';
}

const ENV_ALIASES = {
  TG_BOT_TOKEN: ['TELEGRAM_BOT_TOKEN', 'BOT_TOKEN'],
  TG_CHAT_ID: ['TELEGRAM_CHAT_ID', 'CHAT_ID'],
  GOOGLE_SHEET_ID: ['SHEET_ID'],
  GOOGLE_SHEET_WEBAPP_URL: ['LEAD_WEBHOOK_URL', 'APPS_SCRIPT_URL']
};

function getEnvAny(primary) {
  let val = getEnv(primary);
  if (val) return val;
  const aliases = ENV_ALIASES[primary] || [];
  for (let i = 0; i < aliases.length; i++) {
    val = getEnv(aliases[i]);
    if (val) return val;
  }
  if (primary === 'GOOGLE_SHEET_WEBAPP_URL') return DEFAULT_GOOGLE_SHEET_WEBAPP_URL;
  return '';
}

module.exports = { getEnv, getEnvAny };

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const configPath = path.join(root, 'config.js');

const webapp = (process.env.GOOGLE_SHEET_WEBAPP_URL || '').trim();
const primary = '/api/leads';
const fallback = webapp;

function patch(filePath) {
  if (!fs.existsSync(filePath)) return;
  let text = fs.readFileSync(filePath, 'utf8');
  text = text.replace(/__LEAD_WEBHOOK_URL__/g, primary);
  text = text.replace(/__LEAD_WEBHOOK_FALLBACK__/g, fallback);
  fs.writeFileSync(filePath, text, 'utf8');
}

patch(indexPath);
patch(configPath);

console.log('Webhook primary:', primary);
console.log('Webhook fallback:', fallback || '(none)');

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');

const staticFiles = [
  'index.html',
  'privacy.html',
  'impressum.html',
  'config.js',
  'expert-photo.jpg',
  'expert-photo.png'
];

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

staticFiles.forEach((file) => {
  const src = path.join(root, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(publicDir, file));
  }
});

const { DEFAULT_GOOGLE_SHEET_WEBAPP_URL } = require('../lib/webapp-url');
const webapp = (process.env.GOOGLE_SHEET_WEBAPP_URL || '').trim() || DEFAULT_GOOGLE_SHEET_WEBAPP_URL;
const primary = '/api/leads';
const fallback = webapp;

function patch(filePath) {
  if (!fs.existsSync(filePath)) return;
  let text = fs.readFileSync(filePath, 'utf8');
  text = text.replace(/__LEAD_WEBHOOK_URL__/g, primary);
  text = text.replace(/__LEAD_WEBHOOK_FALLBACK__/g, fallback);
  fs.writeFileSync(filePath, text, 'utf8');
}

patch(path.join(publicDir, 'index.html'));
patch(path.join(publicDir, 'config.js'));

console.log('Built public/ for Vercel');
console.log('Webhook primary:', primary);
console.log('Webhook fallback:', fallback || '(none)');

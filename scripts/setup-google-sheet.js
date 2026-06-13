/**
 * Однократная настройка Google Таблицы через Sheets API v4
 *
 * 1. Скопируйте .env.example → .env и заполните
 * 2. node scripts/setup-google-sheet.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { SHEET_TAB } = require('../lib/leads-config');
const { getEnv, setupSheetLayout } = require('../lib/google-sheets');

async function main() {
  const spreadsheetId = getEnv('GOOGLE_SHEET_ID');
  const tabName = getEnv('GOOGLE_SHEET_TAB') || SHEET_TAB;

  if (!spreadsheetId) {
    console.error('Задайте GOOGLE_SHEET_ID в .env');
    process.exit(1);
  }

  console.log('Настраиваю таблицу...');
  console.log('ID:', spreadsheetId);
  console.log('Лист:', tabName);

  const result = await setupSheetLayout(spreadsheetId, tabName);
  console.log('Готово. Колонок:', result.headers);
  console.log('Откройте таблицу: https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

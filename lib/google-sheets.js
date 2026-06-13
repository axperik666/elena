const { google } = require('googleapis');
const { HEADERS, SHEET_TAB, buildRow } = require('./leads-config');

function getEnv(name) {
  const v = process.env[name];
  if (!v || String(v).includes('ВСТАВЬТЕ')) return '';
  return v;
}

function getAuthClient() {
  const email = getEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const keyRaw = getEnv('GOOGLE_PRIVATE_KEY');
  if (!email || !keyRaw) {
    throw new Error('Не заданы GOOGLE_SERVICE_ACCOUNT_EMAIL или GOOGLE_PRIVATE_KEY');
  }

  return new google.auth.JWT({
    email,
    key: keyRaw.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

function getSheetsClient() {
  const auth = getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

async function getSheetMeta(spreadsheetId, tabName) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const tab = (res.data.sheets || []).find(
    (s) => s.properties && s.properties.title === tabName
  );
  return { sheets, spreadsheet: res.data, tab, tabId: tab ? tab.properties.sheetId : null };
}

async function ensureTab(spreadsheetId, tabName) {
  const { sheets, tabId } = await getSheetMeta(spreadsheetId, tabName);
  if (tabId != null) return tabId;

  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: tabName } } }]
    }
  });
  return addRes.data.replies[0].addSheet.properties.sheetId;
}

async function readHeaderRow(spreadsheetId, tabName) {
  const sheets = getSheetsClient();
  const range = tabName + '!1:1';
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values && res.data.values[0]) || [];
}

function buildLayoutRequests(sheetId, colCount) {
  const lastCol = colCount - 1;
  return [
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount'
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.18, green: 0.11, blue: 0.31 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    },
    {
      setBasicFilter: {
        filter: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 5000,
            startColumnIndex: 0,
            endColumnIndex: colCount
          }
        }
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: colCount },
        properties: { pixelSize: 130 },
        fields: 'pixelSize'
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 170 },
        fields: 'pixelSize'
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 },
        properties: { pixelSize: 160 },
        fields: 'pixelSize'
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 22, endIndex: 23 },
        properties: { pixelSize: 280 },
        fields: 'pixelSize'
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 5000, startColumnIndex: 0, endColumnIndex: 1 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'DATE_TIME', pattern: 'dd.mm.yyyy hh:mm' }
          }
        },
        fields: 'userEnteredFormat.numberFormat'
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 5000, startColumnIndex: 11, endColumnIndex: 12 },
        cell: {
          userEnteredFormat: { horizontalAlignment: 'CENTER' }
        },
        fields: 'userEnteredFormat.horizontalAlignment'
      }
    },
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId, startRowIndex: 1, endRowIndex: 5000, startColumnIndex: 12, endColumnIndex: 13 }],
          booleanRule: {
            condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'Да' }] },
            format: { backgroundColor: { red: 0.95, green: 0.85, blue: 0.55 } }
          }
        },
        index: 0
      }
    },
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId, startRowIndex: 1, endRowIndex: 5000, startColumnIndex: 11, endColumnIndex: 12 }],
          booleanRule: {
            condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'believer' }] },
            format: { backgroundColor: { red: 0.85, green: 0.75, blue: 0.95 } }
          }
        },
        index: 1
      }
    }
  ];
}

async function setupSheetLayout(spreadsheetId, tabName) {
  const sheetId = await ensureTab(spreadsheetId, tabName);
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: tabName + '!A1',
    valueInputOption: 'RAW',
    requestBody: { values: [HEADERS] }
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: buildLayoutRequests(sheetId, HEADERS.length) }
  });

  return { sheetId, headers: HEADERS.length };
}

async function ensureSheetReady(spreadsheetId, tabName) {
  const sheetId = await ensureTab(spreadsheetId, tabName);
  const header = await readHeaderRow(spreadsheetId, tabName);
  const ok = header.length === HEADERS.length && header[0] === HEADERS[0] && header[HEADERS.length - 1] === HEADERS[HEADERS.length - 1];

  if (!ok) {
    await setupSheetLayout(spreadsheetId, tabName);
  }

  return sheetId;
}

async function appendLead(spreadsheetId, tabName, data) {
  await ensureSheetReady(spreadsheetId, tabName);
  const sheets = getSheetsClient();
  const row = buildRow(data);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: tabName + '!A:W',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });

  return row;
}

module.exports = {
  getEnv,
  getSheetsClient,
  setupSheetLayout,
  ensureSheetReady,
  appendLead
};

const { google } = require('googleapis');
const {
  HEADERS,
  SAPI_STATUSES,
  SHEET_TAB,
  COL,
  PHONE_COL_LETTER,
  normalizePhone,
  buildRow
} = require('./leads-config');

const LAST_COL_LETTER = 'X';
const MAX_ROWS = 5000;

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
  return google.sheets({ version: 'v4', auth: getAuthClient() });
}

async function getSheetMeta(spreadsheetId, tabName) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const tab = (res.data.sheets || []).find(
    (s) => s.properties && s.properties.title === tabName
  );
  return { sheets, tabId: tab ? tab.properties.sheetId : null };
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
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: tabName + '!1:1'
  });
  return (res.data.values && res.data.values[0]) || [];
}

function colRange(sheetId, startCol, endCol, startRow, endRow) {
  return {
    sheetId,
    startRowIndex: startRow,
    endRowIndex: endRow,
    startColumnIndex: startCol,
    endColumnIndex: endCol
  };
}

function buildLayoutRequests(sheetId, colCount) {
  const fullRow = colRange(sheetId, 0, colCount, 1, MAX_ROWS);
  const requests = [
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1, frozenColumnCount: 2 } },
        fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount'
      }
    },
    {
      repeatCell: {
        range: colRange(sheetId, 0, colCount, 0, 1),
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.16, green: 0.08, blue: 0.28 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 42 },
        fields: 'pixelSize'
      }
    },
    {
      setBasicFilter: {
        filter: { range: colRange(sheetId, 0, colCount, 0, MAX_ROWS) }
      }
    },
    {
      setDataValidation: {
        range: colRange(sheetId, COL.SAPI, COL.SAPI + 1, 1, MAX_ROWS),
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: SAPI_STATUSES.map((s) => ({ userEnteredValue: s }))
          },
          showCustomUi: true,
          strict: false,
          inputMessage: 'Статус лида для CRM и дедупликации'
        }
      }
    },
    {
      repeatCell: {
        range: colRange(sheetId, COL.DATE, COL.DATE + 1, 1, MAX_ROWS),
        cell: { userEnteredFormat: { numberFormat: { type: 'DATE_TIME', pattern: 'dd.mm.yyyy hh:mm' } } },
        fields: 'userEnteredFormat.numberFormat'
      }
    },
    {
      repeatCell: {
        range: colRange(sheetId, COL.SAPI, COL.SAPI + 1, 1, MAX_ROWS),
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'CENTER',
            textFormat: { bold: true }
          }
        },
        fields: 'userEnteredFormat(horizontalAlignment,textFormat)'
      }
    },
    {
      repeatCell: {
        range: colRange(sheetId, COL.PHONE, COL.PHONE + 1, 1, MAX_ROWS),
        cell: { userEnteredFormat: { textFormat: { fontFamily: 'Roboto Mono' } } },
        fields: 'userEnteredFormat.textFormat'
      }
    }
  ];

  const widths = [
    [COL.DATE, COL.DATE + 1, 155],
    [COL.SAPI, COL.SAPI + 1, 95],
    [COL.NAME, COL.NAME + 1, 120],
    [COL.EMAIL, COL.EMAIL + 1, 185],
    [COL.PHONE, COL.PHONE + 1, 155],
    [COL.WHATSAPP, COL.WHATSAPP + 1, 85],
    [COL.PAIN, COL.PAIN + 1, 110],
    [COL.PAIN_LABEL, COL.PAIN_LABEL + 1, 175],
    [COL.AGE, COL.AGE + 1, 70],
    [COL.GEO, COL.GEO + 1, 110],
    [COL.RESIDENCY, COL.RESIDENCY + 1, 200],
    [COL.BELIEF, COL.BELIEF + 1, 180],
    [COL.BELIEF_TYPE, COL.BELIEF_TYPE + 1, 95],
    [COL.PARTIAL, COL.PARTIAL + 1, 95]
  ];

  widths.forEach(([start, end, px]) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: start, endIndex: end },
        properties: { pixelSize: px },
        fields: 'pixelSize'
      }
    });
  });

  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: COL.PARTIAL + 1, endIndex: colCount - 1 },
      properties: { pixelSize: 115 },
      fields: 'pixelSize'
    }
  });
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: colCount - 1, endIndex: colCount },
      properties: { pixelSize: 260 },
      fields: 'pixelSize'
    }
  });

  var dupFormula =
    '=AND($' + PHONE_COL_LETTER + '2<>"";COUNTIF($' + PHONE_COL_LETTER + ':$' + PHONE_COL_LETTER + ';$' + PHONE_COL_LETTER + '2)>1)';

  var statusRules = [
    { status: 'новый', bg: { red: 1, green: 0.97, blue: 0.82 } },
    { status: 'валид', bg: { red: 0.82, green: 0.94, blue: 0.82 } },
    { status: 'квал', bg: { red: 0.78, green: 0.87, blue: 0.98 } },
    { status: 'трэш', bg: { red: 0.88, green: 0.88, blue: 0.88 } },
    { status: 'дубль', bg: { red: 0.98, green: 0.8, blue: 0.8 } }
  ];

  statusRules.forEach((item, idx) => {
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [colRange(sheetId, COL.SAPI, COL.SAPI + 1, 1, MAX_ROWS)],
          booleanRule: {
            condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: item.status }] },
            format: { backgroundColor: item.bg, textFormat: { bold: true } }
          }
        },
        index: idx
      }
    });
  });

  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [fullRow],
        booleanRule: {
          condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: dupFormula }] },
          format: {
            backgroundColor: { red: 1, green: 0.88, blue: 0.88 },
            textFormat: { bold: true }
          }
        }
      },
      index: statusRules.length
    }
  });

  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [colRange(sheetId, COL.PARTIAL, COL.PARTIAL + 1, 1, MAX_ROWS)],
        booleanRule: {
          condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'Да' }] },
          format: { backgroundColor: { red: 0.95, green: 0.85, blue: 0.55 } }
        }
      },
      index: statusRules.length + 1
    }
  });

  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [colRange(sheetId, COL.BELIEF_TYPE, COL.BELIEF_TYPE + 1, 1, MAX_ROWS)],
        booleanRule: {
          condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'believer' }] },
          format: { backgroundColor: { red: 0.85, green: 0.75, blue: 0.95 } }
        }
      },
      index: statusRules.length + 2
    }
  });

  return requests;
}

async function clearSheetFormatting(spreadsheetId, sheetId) {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(conditionalFormats,properties.sheetId)'
  });
  const sheet = (meta.data.sheets || []).find((s) => s.properties.sheetId === sheetId);
  const count = (sheet && sheet.conditionalFormats && sheet.conditionalFormats.length) || 0;
  if (!count) return;

  const requests = [];
  for (let i = count - 1; i >= 0; i--) {
    requests.push({ deleteConditionalFormatRule: { sheetId, index: i } });
  }
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
}

async function setupSheetLayout(spreadsheetId, tabName) {
  const sheetId = await ensureTab(spreadsheetId, tabName);
  const sheets = getSheetsClient();

  await clearSheetFormatting(spreadsheetId, sheetId);

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
  const ok = header.length === HEADERS.length && header[COL.SAPI] === 'SAPI';

  if (!ok) {
    await setupSheetLayout(spreadsheetId, tabName);
  }

  return sheetId;
}

async function readPhoneRows(spreadsheetId, tabName) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: tabName + '!' + PHONE_COL_LETTER + ':' + PHONE_COL_LETTER
  });
  return (res.data.values || []).map((r) => (r[0] ? r[0] : ''));
}

function findDuplicateRows(phoneRows, phone) {
  const target = normalizePhone(phone);
  if (!target || target.length < 6) return [];

  const rows = [];
  for (let i = 1; i < phoneRows.length; i++) {
    if (normalizePhone(phoneRows[i]) === target) {
      rows.push(i + 1);
    }
  }
  return rows;
}

async function appendLead(spreadsheetId, tabName, data) {
  await ensureSheetReady(spreadsheetId, tabName);
  const sheets = getSheetsClient();

  const phoneRowsBefore = await readPhoneRows(spreadsheetId, tabName);
  const dupBefore = findDuplicateRows(phoneRowsBefore, data.phone);
  const row = buildRow(data);

  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: tabName + '!A:' + LAST_COL_LETTER,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });

  const updatedRange = appendRes.data.updates && appendRes.data.updates.updatedRange;
  const newRowMatch = updatedRange && updatedRange.match(/(\d+)$/);
  const newRowNum = newRowMatch ? parseInt(newRowMatch[1], 10) : null;

  const duplicateRows = dupBefore.length
    ? dupBefore.concat(newRowNum ? [newRowNum] : [])
    : [];

  const duplicate = duplicateRows.length > 1;

  return {
    row,
    duplicate,
    duplicateRows: duplicate ? duplicateRows : [],
    newRowNum,
    sapi: row[COL.SAPI]
  };
}

module.exports = {
  getEnv,
  getSheetsClient,
  setupSheetLayout,
  ensureSheetReady,
  appendLead,
  normalizePhone,
  findDuplicateRows
};

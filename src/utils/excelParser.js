const XLSX = require('xlsx');

/**
 * Načte Excel soubor a vrátí data jako pole objektů
 * @param {Buffer} fileBuffer
 * @param {string|null} sheetName
 * @returns {Array<object>}
 */
function parseExcelFile (fileBuffer, sheetName = null) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const targetSheetName = sheetName || workbook.SheetNames[0];
  if (!targetSheetName) {
    return [];
  }
  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet) {
    return [];
  }
  return XLSX.utils.sheet_to_json(sheet, { defval: null });
}

/**
 * Parsuje Excel serial date nebo string reprezentaci na Date
 * @param {number|string|null} excelDate
 * @returns {Date|null}
 */
function parseExcelDate (excelDate) {
  if (excelDate === null || excelDate === undefined || excelDate === '') {
    return null;
  }

  if (typeof excelDate === 'number') {
    const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(excelDate);
  return isNaN(parsed.getTime()) ? null : parsed;
}

module.exports = {
  parseExcelFile,
  parseExcelDate
};

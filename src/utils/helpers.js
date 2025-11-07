/**
 * Generuje QR kód objednávky ve formátu ORD-{sapNumber}-{YYMMDD}
 * @param {string} sapNumber
 * @returns {string}
 */
function generateOrderQR (sapNumber) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `ORD-${sapNumber}-${yy}${mm}${dd}`;
}

/**
 * Generuje čárový kód položky ve formátu MAT-{YYMMDD}-{XXX}
 * @param {number} index - index položky (0-based)
 * @returns {string}
 */
function generateItemBarcode (index) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const idx = String(index + 1).padStart(3, '0');
  return `MAT-${yy}${mm}${dd}-${idx}`;
}

/**
 * Generuje unikátní čárový kód bez nutnosti znát index položky
 * @returns {string}
 */
function generateBarcode () {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).slice(-4).toUpperCase();
  return `MAT-${yy}${mm}${dd}-${random}`;
}

/**
 * Vypočítá status objednávky na základě položek
 * @param {Array<{qtyReceived:number,status:string}>} items
 * @returns {string}
 */
function calculateOrderStatus (items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'pending';
  }

  let allZero = true;
  let allComplete = true;

  for (const item of items) {
    if (item.qtyReceived > 0) {
      allZero = false;
    }
    if (item.status !== 'complete') {
      allComplete = false;
    }
  }

  if (allZero) return 'pending';
  if (allComplete) return 'complete';
  return 'partial';
}

module.exports = {
  generateOrderQR,
  generateItemBarcode,
  generateBarcode,
  calculateOrderStatus
};

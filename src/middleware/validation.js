const { body, param, query, validationResult } = require('express-validator');

/**
 * Vrací middleware, který odesílá validační chyby v jednotném formátu.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validační chyba',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

const validateCreateOrder = [
  body('sapNumber')
    .notEmpty().withMessage('SAP číslo je povinné')
    .isLength({ min: 1, max: 10 }).withMessage('SAP číslo musí mít 1-10 znaků')
    .matches(/^[0-9]+$/).withMessage('SAP číslo musí obsahovat pouze číslice'),
  body('supplier')
    .notEmpty().withMessage('Dodavatel je povinný')
    .isLength({ max: 255 }).withMessage('Dodavatel může mít maximálně 255 znaků'),
  body('items')
    .isArray({ min: 1 }).withMessage('Objednávka musí obsahovat alespoň jednu položku'),
  body('items.*.itemName')
    .notEmpty().withMessage('Název položky je povinný')
    .isLength({ max: 255 }).withMessage('Název položky může mít maximálně 255 znaků'),
  body('items.*.quantity')
    .isInt({ min: 1 }).withMessage('Množství musí být kladné celé číslo'),
  body('items.*.dimension')
    .optional()
    .isLength({ max: 255 }).withMessage('Rozměr může mít maximálně 255 znaků'),
  body('items.*.material')
    .optional()
    .isLength({ max: 255 }).withMessage('Materiál může mít maximálně 255 znaků'),
  body('items.*.position')
    .optional()
    .isLength({ max: 50 }).withMessage('Pozice může mít maximálně 50 znaků'),
  body('notes')
    .optional()
    .isString().withMessage('Poznámka musí být text'),
  handleValidationErrors
];

const validateReceive = [
  body('barcode')
    .notEmpty().withMessage('Čárový kód je povinný')
    .isLength({ max: 50 }).withMessage('Čárový kód může mít maximálně 50 znaků'),
  body('quantityReceived')
    .isInt({ min: 1 }).withMessage('Přijaté množství musí být kladné celé číslo'),
  body('notes')
    .optional()
    .isString().withMessage('Poznámka musí být text'),
  handleValidationErrors
];

const validateMove = [
  body('barcode')
    .notEmpty().withMessage('Čárový kód je povinný'),
  body('warehouseId')
    .notEmpty().withMessage('ID skladu je povinné')
    .isLength({ max: 50 }).withMessage('ID skladu může mít maximálně 50 znaků'),
  body('position')
    .notEmpty().withMessage('Pozice je povinná')
    .isLength({ max: 50 }).withMessage('Pozice může mít maximálně 50 znaků'),
  body('quantity')
    .isInt({ min: 1 }).withMessage('Množství musí být kladné celé číslo'),
  body('notes')
    .optional()
    .isString().withMessage('Poznámka musí být text'),
  handleValidationErrors
];

const validateConsume = [
  body('barcode')
    .notEmpty().withMessage('Čárový kód je povinný'),
  body('warehouseId')
    .notEmpty().withMessage('ID skladu je povinné'),
  body('position')
    .notEmpty().withMessage('Pozice je povinná'),
  body('quantity')
    .isInt({ min: 1 }).withMessage('Množství musí být kladné celé číslo'),
  body('notes')
    .optional()
    .isString().withMessage('Poznámka musí být text'),
  handleValidationErrors
];

const validateCsvImport = [
  body('sapNumber')
    .notEmpty().withMessage('SAP číslo je povinné'),
  body('supplier')
    .notEmpty().withMessage('Dodavatel je povinný'),
  body('csvData')
    .notEmpty().withMessage('CSV data jsou povinná')
    .isString().withMessage('CSV data musí být text'),
  handleValidationErrors
];

const validateGenerateBarcodes = [
  body('orderId')
    .isInt({ min: 1 }).withMessage('orderId musí být kladné číslo'),
  handleValidationErrors
];

const validateOrderId = [
  param('orderId')
    .isInt({ min: 1 }).withMessage('ID objednávky musí být kladné číslo'),
  handleValidationErrors
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Číslo stránky musí být kladné'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit musí být v rozsahu 1-100'),
  handleValidationErrors
];

module.exports = {
  validateCreateOrder,
  validateReceive,
  validateMove,
  validateConsume,
  validateCsvImport,
  validateGenerateBarcodes,
  validateOrderId,
  validatePagination
};

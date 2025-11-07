const { body, param, query, validationResult } = require('express-validator');
const {
  ORDER_TYPE,
  COMPONENT_TYPE,
  QUALITY_RESULT
} = require('../constants/statuses');

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
    .matches(/^MAT-\d{6}-\d{3}$/).withMessage('Čárový kód musí být ve formátu MAT-YYMMDD-XXX')
    .isLength({ max: 50 }).withMessage('Čárový kód může mít maximálně 50 znaků'),
  body('quantityReceived')
    .isInt({ min: 1 }).withMessage('Přijaté množství musí být kladné celé číslo'),
  body('warehouseId')
    .notEmpty().withMessage('ID skladu je povinné')
    .isLength({ max: 50 }).withMessage('ID skladu může mít maximálně 50 znaků'),
  body('position')
    .notEmpty().withMessage('Pozice je povinná')
    .isLength({ max: 50 }).withMessage('Pozice může mít maximálně 50 znaků'),
  body('notes')
    .optional()
    .isString().withMessage('Poznámka musí být text'),
  handleValidationErrors
];

const validateMove = [
  body('barcode')
    .notEmpty().withMessage('Čárový kód je povinný')
    .matches(/^MAT-\d{6}-\d{3}$/).withMessage('Čárový kód musí být ve formátu MAT-YYMMDD-XXX')
    .isLength({ max: 50 }).withMessage('Čárový kód může mít maximálně 50 znaků'),
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
    .notEmpty().withMessage('Čárový kód je povinný')
    .matches(/^MAT-\d{6}-\d{3}$/).withMessage('Čárový kód musí být ve formátu MAT-YYMMDD-XXX')
    .isLength({ max: 50 }).withMessage('Čárový kód může mít maximálně 50 znaků'),
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

const validateUpdateOrder = [
  body('supplier')
    .optional()
    .isLength({ max: 255 }).withMessage('Dodavatel může mít maximálně 255 znaků'),
  body('notes')
    .optional()
    .isLength({ max: 1000 }).withMessage('Poznámka může mít maximálně 1000 znaků'),
  handleValidationErrors
];

const validateWarehouse = [
  body('warehouseId')
    .notEmpty().withMessage('ID skladu je povinné')
    .isLength({ max: 50 }).withMessage('ID skladu může mít maximálně 50 znaků'),
  body('warehouseName')
    .notEmpty().withMessage('Název skladu je povinný')
    .isLength({ max: 255 }).withMessage('Název skladu může mít maximálně 255 znaků'),
  body('location')
    .optional()
    .isLength({ max: 255 }).withMessage('Umístění může mít maximálně 255 znaků'),
  body('capacity')
    .optional()
    .isInt({ min: 0 }).withMessage('Kapacita musí být nezáporné celé číslo'),
  body('notes')
    .optional()
    .isLength({ max: 1000 }).withMessage('Poznámka může mít maximálně 1000 znaků'),
  handleValidationErrors
];

const validateWarehouseUpdate = [
  body('warehouseName')
    .optional()
    .isLength({ max: 255 }).withMessage('Název skladu může mít maximálně 255 znaků'),
  body('location')
    .optional()
    .isLength({ max: 255 }).withMessage('Umístění může mít maximálně 255 znaků'),
  body('capacity')
    .optional()
    .isInt({ min: 0 }).withMessage('Kapacita musí být nezáporné celé číslo'),
  body('notes')
    .optional()
    .isLength({ max: 1000 }).withMessage('Poznámka může mít maximálně 1000 znaků'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive musí být boolean'),
  handleValidationErrors
];

const validateWarehouseId = [
  param('warehouseId')
    .notEmpty().withMessage('ID skladu je povinné')
    .isLength({ max: 50 }).withMessage('ID skladu může mít maximálně 50 znaků'),
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

const validateComponentId = [
  param('componentId')
    .isInt({ min: 1 }).withMessage('ID komponenty musí být kladné číslo'),
  handleValidationErrors
];

const validateAssemblyCreate = [
  body('sapNumber')
    .notEmpty().withMessage('SAP číslo je povinné')
    .isLength({ max: 50 }).withMessage('SAP číslo může mít maximálně 50 znaků'),
  body('supplier')
    .notEmpty().withMessage('Dodavatel je povinný')
    .isLength({ max: 255 }).withMessage('Dodavatel může mít maximálně 255 znaků'),
  body('orderType')
    .optional()
    .isIn(Object.values(ORDER_TYPE)).withMessage('Neplatný typ zakázky'),
  body('parentOrderId')
    .optional()
    .isInt({ min: 1 }).withMessage('parentOrderId musí být kladné číslo'),
  body('notes')
    .optional()
    .isLength({ max: 1000 }).withMessage('Poznámka může mít maximálně 1000 znaků'),
  body('operator')
    .optional()
    .isLength({ max: 100 }).withMessage('Operator může mít maximálně 100 znaků'),
  handleValidationErrors
];

const validateAssemblyComponent = [
  param('orderId')
    .isInt({ min: 1 }).withMessage('ID zakázky musí být kladné číslo'),
  body('componentType')
    .notEmpty().withMessage('Typ komponenty je povinný')
    .isIn(Object.values(COMPONENT_TYPE)).withMessage('Neplatný typ komponenty'),
  body('componentOrderId')
    .if(body('componentType').equals(COMPONENT_TYPE.ORDER))
    .notEmpty().withMessage('componentOrderId je povinné pro komponentu typu order')
    .bail()
    .isInt({ min: 1 }).withMessage('componentOrderId musí být kladné číslo'),
  body('componentItemId')
    .if(body('componentType').equals(COMPONENT_TYPE.ITEM))
    .notEmpty().withMessage('componentItemId je povinné pro komponentu typu item')
    .bail()
    .isInt({ min: 1 }).withMessage('componentItemId musí být kladné číslo'),
  body('quantityRequired')
    .optional()
    .isInt({ min: 1 }).withMessage('Požadované množství musí být kladné celé číslo'),
  body('sortOrder')
    .optional()
    .isInt({ min: 0 }).withMessage('sortOrder musí být nezáporné číslo'),
  body('operator')
    .optional()
    .isLength({ max: 100 }).withMessage('Operator může mít maximálně 100 znaků'),
  handleValidationErrors
];

const validateAssemblyAction = [
  param('orderId')
    .isInt({ min: 1 }).withMessage('ID zakázky musí být kladné číslo'),
  body('operator')
    .optional()
    .isLength({ max: 100 }).withMessage('Operator může mít maximálně 100 znaků'),
  body('notes')
    .optional()
    .isLength({ max: 1000 }).withMessage('Poznámka může mít maximálně 1000 znaků'),
  handleValidationErrors
];

const validateQualityCheck = [
  param('orderId')
    .isInt({ min: 1 }).withMessage('ID zakázky musí být kladné číslo'),
  body('result')
    .notEmpty().withMessage('Výsledek kontroly je povinný')
    .isIn(Object.values(QUALITY_RESULT)).withMessage('Neplatný výsledek kontroly'),
  body('inspector')
    .notEmpty().withMessage('Jméno inspektora je povinné')
    .isLength({ max: 100 }).withMessage('Jméno inspektora může mít maximálně 100 znaků'),
  body('notes')
    .optional()
    .isLength({ max: 1000 }).withMessage('Poznámka může mít maximálně 1000 znaků'),
  body('parameters')
    .optional()
    .isObject().withMessage('Parametry musí být objekt'),
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
  validateUpdateOrder,
  validateCsvImport,
  validateGenerateBarcodes,
  validateOrderId,
  validatePagination,
  validateWarehouse,
  validateWarehouseId,
  validateWarehouseUpdate,
  validateAssemblyCreate,
  validateAssemblyComponent,
  validateComponentId,
  validateAssemblyAction,
  validateQualityCheck
};

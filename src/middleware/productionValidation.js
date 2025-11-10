const { body, param, query, validationResult } = require('express-validator');

const handleErrors = (req, res, next) => {
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

const validateProductionStart = [
  body('productCode')
    .notEmpty().withMessage('productCode je povinný')
    .isLength({ max: 100 }).withMessage('productCode je příliš dlouhý'),
  body('quantityIn')
    .isInt({ min: 1 }).withMessage('quantityIn musí být kladné číslo'),
  body('batchNumber')
    .optional()
    .isLength({ max: 50 }).withMessage('batchNumber je příliš dlouhý'),
  body('orderId')
    .optional()
    .isInt({ min: 1 }).withMessage('orderId musí být číslo'),
  body('stages')
    .optional()
    .isArray().withMessage('stages musí být pole'),
  body('stages.*.stageName')
    .optional()
    .isLength({ max: 100 }).withMessage('Název mezioperace je příliš dlouhý'),
  body('stages.*.stageSequence')
    .optional()
    .isInt({ min: 1 }).withMessage('Sekvence musí být kladné číslo'),
  handleErrors
];

const validateProductionQuery = [
  query('status')
    .optional()
    .isIn(['pending', 'started', 'in_progress', 'completed', 'cancelled']).withMessage('Neplatný status'),
  query('productCode')
    .optional()
    .isLength({ max: 100 }).withMessage('productCode je příliš dlouhý'),
  query('batchNumber')
    .optional()
    .isLength({ max: 50 }).withMessage('batchNumber je příliš dlouhý'),
  query('from')
    .optional()
    .isISO8601().withMessage('from musí být datum'),
  query('to')
    .optional()
    .isISO8601().withMessage('to musí být datum'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page musí být kladné číslo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('limit musí být 1-100'),
  handleErrors
];

const validateProductionId = [
  param('workOrderId')
    .isInt({ min: 1 }).withMessage('workOrderId musí být kladné číslo'),
  handleErrors
];

const validateProductionUpdate = [
  body('status')
    .optional()
    .isIn(['pending', 'started', 'in_progress', 'completed', 'cancelled']).withMessage('Neplatný status'),
  body('quantityOut')
    .optional()
    .isInt({ min: 0 }).withMessage('quantityOut musí být nezáporné číslo'),
  body('quantityScrap')
    .optional()
    .isInt({ min: 0 }).withMessage('quantityScrap musí být nezáporné číslo'),
  body('machineId')
    .optional()
    .isLength({ max: 50 }).withMessage('machineId je příliš dlouhé'),
  body('notes')
    .optional()
    .isLength({ max: 2000 }).withMessage('Poznámka je příliš dlouhá'),
  body('endTime')
    .optional()
    .isISO8601().withMessage('endTime musí být datum'),
  handleErrors
];

const validateStageId = [
  param('stageId')
    .isInt({ min: 1 }).withMessage('stageId musí být kladné číslo'),
  handleErrors
];

const validateStageAction = [
  body('operatorId')
    .optional()
    .isInt({ min: 1 }).withMessage('operatorId musí být číslo'),
  body('quantity')
    .optional()
    .isInt({ min: 0 }).withMessage('quantity musí být nezáporné číslo'),
  body('scrapQuantity')
    .optional()
    .isInt({ min: 0 }).withMessage('scrapQuantity musí být nezáporné číslo'),
  body('reworkQuantity')
    .optional()
    .isInt({ min: 0 }).withMessage('reworkQuantity musí být nezáporné číslo'),
  handleErrors
];

module.exports = {
  validateProductionStart,
  validateProductionQuery,
  validateProductionId,
  validateProductionUpdate,
  validateStageId,
  validateStageAction
};

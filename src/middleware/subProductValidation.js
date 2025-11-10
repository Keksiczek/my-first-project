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

const validateSubProductCreate = [
  body('parentWorkOrderId')
    .isInt({ min: 1 }).withMessage('parentWorkOrderId je povinný'),
  body('componentCode')
    .notEmpty().withMessage('componentCode je povinný')
    .isLength({ max: 100 }).withMessage('componentCode je příliš dlouhý'),
  body('componentName')
    .optional()
    .isLength({ max: 255 }).withMessage('componentName je příliš dlouhý'),
  body('quantity')
    .optional()
    .isInt({ min: 0 }).withMessage('quantity musí být nezáporné číslo'),
  body('unit')
    .optional()
    .isLength({ max: 20 }).withMessage('unit je příliš dlouhý'),
  handleErrors
];

const validateSubProductList = [
  query('status')
    .optional()
    .isIn(['created', 'in_stock', 'in_progress', 'consumed']).withMessage('Neplatný status'),
  query('warehouseId')
    .optional()
    .isInt({ min: 1 }).withMessage('warehouseId musí být číslo'),
  query('stageId')
    .optional()
    .isInt({ min: 1 }).withMessage('stageId musí být číslo'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page musí být kladné číslo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('limit musí být 1-100'),
  handleErrors
];

const validateSubProductId = [
  param('subProductId')
    .isInt({ min: 1 }).withMessage('subProductId musí být číslo'),
  handleErrors
];

const validateSubProductMove = [
  body('warehouseId')
    .optional()
    .isInt({ min: 1 }).withMessage('warehouseId musí být číslo'),
  body('position')
    .optional()
    .isLength({ max: 50 }).withMessage('position je příliš dlouhý'),
  body('currentStageId')
    .optional()
    .isInt({ min: 1 }).withMessage('currentStageId musí být číslo'),
  body('status')
    .optional()
    .isIn(['created', 'in_stock', 'in_progress', 'consumed']).withMessage('Neplatný status'),
  handleErrors
];

const validateWorkOrderParam = [
  param('workOrderId')
    .isInt({ min: 1 }).withMessage('workOrderId musí být číslo'),
  handleErrors
];

module.exports = {
  validateSubProductCreate,
  validateSubProductList,
  validateSubProductId,
  validateSubProductMove,
  validateWorkOrderParam
};

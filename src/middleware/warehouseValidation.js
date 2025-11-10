const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validační chyba',
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

const validateWarehouseCreate = [
  body('name')
    .notEmpty().withMessage('Název skladu je povinný')
    .isLength({ max: 255 }).withMessage('Název může mít maximálně 255 znaků'),
  body('type')
    .optional()
    .isIn(['Main', 'Buffer', 'WIP', 'Finished']).withMessage('Neplatný typ skladu'),
  body('location')
    .optional()
    .isLength({ max: 255 }).withMessage('Umístění může mít maximálně 255 znaků'),
  body('capacity')
    .optional()
    .isInt({ min: 0 }).withMessage('Kapacita musí být nezáporné číslo'),
  handleValidationErrors
];

const validateWarehouseUpdate = [
  body('name')
    .optional()
    .isLength({ max: 255 }).withMessage('Název může mít maximálně 255 znaků'),
  body('type')
    .optional()
    .isIn(['Main', 'Buffer', 'WIP', 'Finished']).withMessage('Neplatný typ skladu'),
  body('location')
    .optional()
    .isLength({ max: 255 }).withMessage('Umístění může mít maximálně 255 znaků'),
  body('capacity')
    .optional()
    .isInt({ min: 0 }).withMessage('Kapacita musí být nezáporné číslo'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive musí být boolean'),
  handleValidationErrors
];

const validateWarehouseIdParam = [
  param('warehouseId')
    .isInt({ min: 1 }).withMessage('ID skladu musí být kladné celé číslo'),
  handleValidationErrors
];

const validateWarehouseListQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page musí být kladné číslo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit musí být 1-100'),
  query('type')
    .optional()
    .isIn(['Main', 'Buffer', 'WIP', 'Finished']).withMessage('Neplatný typ skladu'),
  query('isActive')
    .optional()
    .isBoolean().withMessage('isActive musí být boolean'),
  query('search')
    .optional()
    .isLength({ max: 255 }).withMessage('Hledaný výraz je příliš dlouhý'),
  handleValidationErrors
];

const validateWarehousePositionCreate = [
  body('warehouseId')
    .isInt({ min: 1 }).withMessage('ID skladu musí být kladné celé číslo'),
  body('positionName')
    .notEmpty().withMessage('Název pozice je povinný')
    .isLength({ max: 50 }).withMessage('Název pozice může mít maximálně 50 znaků'),
  body('description')
    .optional()
    .isLength({ max: 255 }).withMessage('Popis je příliš dlouhý'),
  body('maxCapacity')
    .optional()
    .isInt({ min: 0 }).withMessage('Maximální kapacita musí být nezáporné číslo'),
  handleValidationErrors
];

const validateWarehousePositionQuery = [
  query('warehouseId')
    .optional()
    .isInt({ min: 1 }).withMessage('ID skladu musí být kladné celé číslo'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page musí být kladné číslo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit musí být 1-100'),
  handleValidationErrors
];

module.exports = {
  validateWarehouseCreate,
  validateWarehouseUpdate,
  validateWarehouseIdParam,
  validateWarehouseListQuery,
  validateWarehousePositionCreate,
  validateWarehousePositionQuery
};

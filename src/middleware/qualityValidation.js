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

const validateQualityCreate = [
  body('stageId')
    .isInt({ min: 1 }).withMessage('stageId je povinný'),
  body('result')
    .optional()
    .isIn(['OK', 'NOK', 'rework']).withMessage('Neplatný výsledek'),
  body('checkType')
    .optional()
    .isLength({ max: 100 }).withMessage('checkType je příliš dlouhý'),
  body('parameter')
    .optional()
    .isLength({ max: 100 }).withMessage('parameter je příliš dlouhý'),
  body('notes')
    .optional()
    .isLength({ max: 2000 }).withMessage('Poznámka je příliš dlouhá'),
  handleErrors
];

const validateQualityQuery = [
  query('result')
    .optional()
    .isIn(['OK', 'NOK', 'rework']).withMessage('Neplatný výsledek'),
  query('stageId')
    .optional()
    .isInt({ min: 1 }).withMessage('stageId musí být číslo'),
  query('subProductId')
    .optional()
    .isInt({ min: 1 }).withMessage('subProductId musí být číslo'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page musí být kladné číslo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('limit musí být 1-100'),
  handleErrors
];

const validateQualityId = [
  param('checkId')
    .isInt({ min: 1 }).withMessage('checkId musí být číslo'),
  handleErrors
];

const validateStageParam = [
  param('stageId')
    .isInt({ min: 1 }).withMessage('stageId musí být číslo'),
  handleErrors
];

module.exports = {
  validateQualityCreate,
  validateQualityQuery,
  validateQualityId,
  validateStageParam
};

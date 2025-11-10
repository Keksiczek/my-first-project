const { body, validationResult } = require('express-validator');

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

const validateCustomExport = [
  body('resource')
    .notEmpty().withMessage('resource je povinný')
    .isIn(['production', 'subProducts', 'quality']).withMessage('Neplatný resource'),
  body('filters')
    .optional()
    .isObject().withMessage('filters musí být objekt'),
  handleErrors
];

module.exports = {
  validateCustomExport
};

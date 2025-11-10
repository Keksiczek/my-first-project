const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Přístup zamítnut. Chybí autentizační token.'
    });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    logger.warn('Neplatný JWT token', { error: error.message });
    return res.status(403).json({
      success: false,
      error: 'Neplatný nebo expirovaný token'
    });
  }
};

exports.requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Uživatel není autentizován'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Přístup zamítnut - nedostatečná oprávnění', {
        userId: req.user.userId,
        role: req.user.role,
        required: allowedRoles
      });
      return res.status(403).json({
        success: false,
        error: 'Nedostatečná oprávnění pro tuto akci'
      });
    }

    next();
  };
};

exports.optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
  } catch (error) {
    logger.debug('Neplatný optional auth token', { error: error.message });
  }

  next();
};

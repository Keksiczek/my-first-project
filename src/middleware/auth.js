const ROLE_PRIORITY = {
  admin: 4,
  operator: 3,
  operator_full: 3,
  operator_limited: 2,
  viewer: 1
};

exports.resolveUser = (req, _res, next) => {
  if (!req.user) {
    const roleHeader = req.headers['x-user-role'];
    const idHeader = req.headers['x-user-id'];
    if (roleHeader) {
      req.user = {
        userId: idHeader ? Number(idHeader) || null : null,
        role: roleHeader
      };
    }
  }
  next();
};

exports.authorizeRoles = (...allowedRoles) => {
  const allowed = new Set(allowedRoles);

  return (req, res, next) => {
    const user = req.user;

    if (!user || !user.role) {
      return res.status(401).json({
        success: false,
        message: 'Neautorizovaný přístup – chybí role uživatele'
      });
    }

    if (allowed.has('admin') && user.role === 'admin') {
      return next();
    }

    if (allowed.has(user.role)) {
      return next();
    }

    // Operátor může mít alias operator_full
    if (user.role === 'operator_full' && allowed.has('operator')) {
      return next();
    }

    const requiredPriority = Math.max(...[...allowed].map((role) => ROLE_PRIORITY[role] || 0));
    const userPriority = ROLE_PRIORITY[user.role] || 0;

    if (userPriority >= requiredPriority && requiredPriority > 0) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Uživatel nemá dostatečná oprávnění pro tuto operaci'
    });
  };
};

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const logger = require('../config/logger');

const ACCESS_TOKEN_EXPIRES = '15m';
const REFRESH_TOKEN_EXPIRES = '7d';
const SALT_ROUNDS = 10;

function generateAccessToken(user) {
  return jwt.sign(
    {
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );
}

function generateRefreshToken() {
  return jwt.sign(
    { random: Math.random().toString() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES }
  );
}

exports.register = async (req, res, next) => {
  const { username, email, password, role, fullName } = req.body;

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userRole = role || 'operator';

    const [result] = await conn.query(
      'INSERT INTO Users (username, email, passwordHash, role, fullName) VALUES (?, ?, ?, ?, ?)',
      [username, email, passwordHash, userRole, fullName]
    );

    await conn.commit();

    logger.info('Uživatel registrován', { userId: result.insertId, username });

    res.status(201).json({
      success: true,
      message: 'Uživatel byl úspěšně vytvořen',
      data: {
        userId: result.insertId,
        username,
        email,
        role: userRole
      }
    });
  } catch (error) {
    if (conn) {
      await conn.rollback();
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Uživatel s tímto username nebo emailem již existuje'
      });
    }
    next(error);
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

exports.login = async (req, res, next) => {
  const { username, password } = req.body;

  let conn;
  try {
    conn = await pool.getConnection();

    const [users] = await conn.query(
      'SELECT * FROM Users WHERE username = ? AND isActive = TRUE',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Neplatné přihlašovací údaje'
      });
    }

    const user = users[0];

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      logger.warn('Neúspěšný pokus o přihlášení', { username });
      return res.status(401).json({
        success: false,
        error: 'Neplatné přihlašovací údaje'
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await conn.query(
      'INSERT INTO RefreshTokens (userId, token, expiresAt) VALUES (?, ?, ?)',
      [user.userId, refreshToken, expiresAt]
    );

    await conn.query(
      'UPDATE Users SET lastLogin = NOW() WHERE userId = ?',
      [user.userId]
    );

    logger.info('Uživatel přihlášen', { userId: user.userId, username });

    res.json({
      success: true,
      message: 'Přihlášení úspěšné',
      data: {
        accessToken,
        refreshToken,
        user: {
          userId: user.userId,
          username: user.username,
          email: user.email,
          role: user.role,
          fullName: user.fullName
        }
      }
    });
  } catch (error) {
    next(error);
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

exports.refresh = async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      error: 'Refresh token je povinný'
    });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const [tokens] = await conn.query(
      `SELECT rt.*, u.* FROM RefreshTokens rt
       JOIN Users u ON u.userId = rt.userId
       WHERE rt.token = ? AND rt.isRevoked = FALSE AND rt.expiresAt > NOW()`,
      [refreshToken]
    );

    if (tokens.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Neplatný nebo expirovaný refresh token'
      });
    }

    const user = tokens[0];
    const accessToken = generateAccessToken(user);

    res.json({
      success: true,
      data: { accessToken }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Neplatný nebo expirovaný refresh token'
      });
    }
    next(error);
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

exports.logout = async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      error: 'Refresh token je povinný'
    });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query(
      'UPDATE RefreshTokens SET isRevoked = TRUE WHERE token = ?',
      [refreshToken]
    );

    logger.info('Uživatel odhlášen', { userId: req.user?.userId });

    res.json({
      success: true,
      message: 'Odhlášení úspěšné'
    });
  } catch (error) {
    next(error);
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

exports.me = async (req, res, next) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [users] = await conn.query(
      'SELECT userId, username, email, role, fullName, lastLogin, createdAt FROM Users WHERE userId = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Uživatel nenalezen'
      });
    }

    res.json({
      success: true,
      data: users[0]
    });
  } catch (error) {
    next(error);
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

exports.changePassword = async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;

  let conn;
  try {
    conn = await pool.getConnection();
    const [users] = await conn.query(
      'SELECT passwordHash FROM Users WHERE userId = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Uživatel nenalezen'
      });
    }

    const isValid = await bcrypt.compare(oldPassword, users[0].passwordHash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Neplatné staré heslo'
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await conn.query(
      'UPDATE Users SET passwordHash = ? WHERE userId = ?',
      [newPasswordHash, req.user.userId]
    );

    await conn.query(
      'UPDATE RefreshTokens SET isRevoked = TRUE WHERE userId = ?',
      [req.user.userId]
    );

    logger.info('Heslo změněno', { userId: req.user.userId });

    res.json({
      success: true,
      message: 'Heslo bylo úspěšně změněno. Přihlaste se znovu.'
    });
  } catch (error) {
    next(error);
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

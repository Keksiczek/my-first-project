const pool = require('../config/db');
const logger = require('../config/logger');

exports.healthCheck = async (req, res) => {
  const started = Date.now();
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: require('../../package.json').version
  };

  try {
    const dbStarted = Date.now();
    await pool.query('SELECT 1');
    health.database = {
      connected: true,
      responseTime: Date.now() - dbStarted
    };
  } catch (error) {
    logger.error('Health check databáze selhala', { error: error.message });
    health.status = 'error';
    health.database = {
      connected: false,
      error: error.message
    };
    health.responseTime = Date.now() - started;
    return res.status(503).json(health);
  }

  health.responseTime = Date.now() - started;
  res.json(health);
};

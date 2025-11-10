require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

const logger = require('./config/logger');
const swaggerSpec = require('./config/swagger');

const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const receiveRoutes = require('./routes/receive');
const inventoryRoutes = require('./routes/inventory');
const movementRoutes = require('./routes/movements');
const consumeRoutes = require('./routes/consume');
const importRoutes = require('./routes/import');
const excelImportRoutes = require('./routes/excelImport');
const healthRoutes = require('./routes/health');
const homeRoutes = require('./routes/home');
const warehouseRoutes = require('./routes/warehouses');
const assemblyRoutes = require('./routes/assembly');
const qualityRoutes = require('./routes/quality');
const { authenticateToken, optionalAuth } = require('./middleware/auth');

const app = express();

app.use(helmet());

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim())
  : undefined;

app.use(
  cors({
    origin: allowedOrigins || '*'
  })
);
app.use(express.json({ limit: '10mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Příliš mnoho požadavků, zkuste to později.'
  }
});

const importLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Import je dočasně omezen, zkuste to znovu za chvíli.'
  }
});

app.use('/api/', apiLimiter);

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

app.use('/api/auth', authRoutes);

app.use('/api/orders', authenticateToken, orderRoutes);
app.use('/api/receive', authenticateToken, receiveRoutes);
app.use('/api/inventory', authenticateToken, inventoryRoutes);
app.use('/api/movements', authenticateToken, movementRoutes);
app.use('/api/consume', authenticateToken, consumeRoutes);
app.use('/api/import', authenticateToken, importLimiter, importRoutes);
app.use('/api/excel-import', authenticateToken, importLimiter, excelImportRoutes);
app.use('/api/warehouses', authenticateToken, warehouseRoutes);
app.use('/api/assembly', authenticateToken, assemblyRoutes);
app.use('/api/quality', authenticateToken, qualityRoutes);

app.use('/api/health', healthRoutes);
app.use('/api/home', optionalAuth, homeRoutes);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.use((req, res) => {
  logger.warn(`404 - ${req.originalUrl}`);
  res.status(404).json({ success: false, message: 'Endpoint nenalezen' });
});

app.use((err, req, res, _next) => {
  logger.error('Nezpracovaná chyba', {
    error: err.message,
    stack: err.stack
  });
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Interní chyba serveru' : err.message
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`Warehouse API běží na http://localhost:${PORT}`);
});

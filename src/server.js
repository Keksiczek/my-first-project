require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

const logger = require('./config/logger');
const swaggerSpec = require('./config/swagger');

const orderRoutes = require('./routes/orders');
const receiveRoutes = require('./routes/receive');
const inventoryRoutes = require('./routes/inventory');
const movementRoutes = require('./routes/movements');
const consumeRoutes = require('./routes/consume');
const importRoutes = require('./routes/import');
const healthRoutes = require('./routes/health');
const homeRoutes = require('./routes/home');
const warehouseRoutes = require('./routes/warehouses');
const assemblyRoutes = require('./routes/assembly');
const qualityRoutes = require('./routes/quality');

const app = express();

app.use(helmet());
app.use(cors());
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
app.use('/api/import', importLimiter);

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

app.use('/api/orders', orderRoutes);
app.use('/api/receive', receiveRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/consume', consumeRoutes);
app.use('/api/import', importRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/assembly', assemblyRoutes);
app.use('/api/quality', qualityRoutes);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.use((req, res) => {
  logger.warn(`404 - ${req.originalUrl}`);
  res.status(404).json({ success: false, message: 'Endpoint nenalezen' });
});

app.use((err, req, res, next) => {
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

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const orderRoutes = require('./routes/orders');
const inventoryRoutes = require('./routes/inventory');
const movementRoutes = require('./routes/movements');
const importRoutes = require('./routes/import');
const receiveController = require('./controllers/receiveController');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/import', importRoutes);

app.post('/api/receive', receiveController.receiveFull);
app.post('/api/receive/partial', receiveController.receivePartial);

app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Warehouse API running on http://localhost:${PORT}`);
});

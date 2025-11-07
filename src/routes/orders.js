const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.post('/create', orderController.createOrder);
router.get('/', orderController.getOrders);
router.get('/qr/:orderQR', orderController.getOrderByQR);
router.get('/:orderId', orderController.getOrderById);
router.post('/generate-barcodes', orderController.generateBarcodes);
router.post('/generate/barcodes', orderController.generateBarcodes);

module.exports = router;

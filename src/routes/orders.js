const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const receiveController = require('../controllers/receiveController');

router.post('/create', orderController.createOrder);
router.get('/', orderController.getOrders);
router.get('/qr/:orderQR', orderController.getOrderByQR);
router.get('/:orderId', orderController.getOrderById);

router.post('/receive', receiveController.receiveFull);
router.post('/receive/partial', receiveController.receivePartial);

router.post('/generate/barcodes', orderController.generateBarcodes);

module.exports = router;

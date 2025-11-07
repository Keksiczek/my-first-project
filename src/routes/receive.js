const express = require('express');
const router = express.Router();
const receiveController = require('../controllers/receiveController');

router.post('/', receiveController.receiveFull);
router.post('/partial', receiveController.receivePartial);

module.exports = router;

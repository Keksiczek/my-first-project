const express = require('express');
const router = express.Router();
const movementController = require('../controllers/movementController');

router.post('/', movementController.consumeMaterial);

module.exports = router;

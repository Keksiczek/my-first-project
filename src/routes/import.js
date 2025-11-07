const express = require('express');
const router = express.Router();
const importController = require('../controllers/importController');

router.post('/csv', importController.importCsv);

module.exports = router;

const express = require('express');
const { fetchHistoricalPrices } = require('../controllers/prices');

const router = express.Router();

router.get('/historical', fetchHistoricalPrices);

module.exports = router;
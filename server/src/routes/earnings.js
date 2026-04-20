const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const { getEarnings, createEarningsEvent } = require('../controllers/earnings');

router.use(protect);

router.route('/').get(getEarnings).post(createEarningsEvent);

module.exports = router;

const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const { getTrades, createTrade, getTrade, updateTrade, deleteTrade } = require('../controllers/trades');

router.use(protect);

router.route('/').get(getTrades).post(createTrade);
router.route('/:id').get(getTrade).put(updateTrade).delete(deleteTrade);

module.exports = router;

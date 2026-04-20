const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const { getWatchlist, addToWatchlist, removeFromWatchlist } = require('../controllers/watchlist');

router.use(protect);

router.route('/').get(getWatchlist).post(addToWatchlist);
router.route('/:id').delete(removeFromWatchlist);

module.exports = router;

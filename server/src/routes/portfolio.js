const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const { getPortfolio, getPerformance } = require('../controllers/portfolio');

router.use(protect);

router.get('/', getPortfolio);
router.get('/performance', getPerformance);

module.exports = router;

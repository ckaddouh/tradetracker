const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const {
  getIdeas,
  createIdea,
  getIdea,
  updateIdea,
  deleteIdea,
  getUpdates,
  addUpdate,
} = require('../controllers/ideas');

router.use(protect);

router.route('/').get(getIdeas).post(createIdea);
router.route('/:id').get(getIdea).put(updateIdea).delete(deleteIdea);
router.route('/:id/updates').get(getUpdates).post(addUpdate);

module.exports = router;

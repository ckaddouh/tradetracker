const Idea = require('../models/Idea');
const IdeaUpdate = require('../models/IdeaUpdate');

const getIdeas = async (req, res, next) => {
  try {
    const ideas = await Idea.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ data: ideas, error: null });
  } catch (err) {
    next(err);
  }
};

const createIdea = async (req, res, next) => {
  try {
    const { ticker, title, direction, thesis, catalysts, timeHorizon, status, tags } = req.body;
    if (!ticker || !title || !direction || !thesis || !timeHorizon) {
      return res.status(400).json({ data: null, error: 'ticker, title, direction, thesis, and timeHorizon are required' });
    }
    const idea = await Idea.create({ userId: req.user._id, ticker, title, direction, thesis, catalysts, timeHorizon, status, tags });
    res.status(201).json({ data: idea, error: null });
  } catch (err) {
    next(err);
  }
};

const getIdea = async (req, res, next) => {
  try {
    const idea = await Idea.findOne({ _id: req.params.id, userId: req.user._id });
    if (!idea) return res.status(404).json({ data: null, error: 'Idea not found' });
    res.json({ data: idea, error: null });
  } catch (err) {
    next(err);
  }
};

const updateIdea = async (req, res, next) => {
  try {
    const idea = await Idea.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!idea) return res.status(404).json({ data: null, error: 'Idea not found' });
    res.json({ data: idea, error: null });
  } catch (err) {
    next(err);
  }
};

const deleteIdea = async (req, res, next) => {
  try {
    const idea = await Idea.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!idea) return res.status(404).json({ data: null, error: 'Idea not found' });
    res.json({ data: { message: 'Idea deleted' }, error: null });
  } catch (err) {
    next(err);
  }
};

const getUpdates = async (req, res, next) => {
  try {
    const idea = await Idea.findOne({ _id: req.params.id, userId: req.user._id });
    if (!idea) return res.status(404).json({ data: null, error: 'Idea not found' });
    const updates = await IdeaUpdate.find({ ideaId: req.params.id }).sort({ createdAt: -1 });
    res.json({ data: updates, error: null });
  } catch (err) {
    next(err);
  }
};

const addUpdate = async (req, res, next) => {
  try {
    const idea = await Idea.findOne({ _id: req.params.id, userId: req.user._id });
    if (!idea) return res.status(404).json({ data: null, error: 'Idea not found' });
    const { type, content } = req.body;
    if (!type || !content) {
      return res.status(400).json({ data: null, error: 'type and content are required' });
    }
    const update = await IdeaUpdate.create({ ideaId: req.params.id, type, content });
    res.status(201).json({ data: update, error: null });
  } catch (err) {
    next(err);
  }
};

module.exports = { getIdeas, createIdea, getIdea, updateIdea, deleteIdea, getUpdates, addUpdate };

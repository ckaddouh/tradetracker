const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (user) =>
  jwt.sign({ _id: user._id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const register = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ data: null, error: 'email, password and name are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ data: null, error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash, name });
    const token = signToken(user);

    res.status(201).json({ data: { token, user: { _id: user._id, email: user.email, name: user.name } }, error: null });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ data: null, error: 'email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ data: null, error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ data: null, error: 'Invalid credentials' });
    }

    const token = signToken(user);
    res.json({ data: { token, user: { _id: user._id, email: user.email, name: user.name } }, error: null });
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash');
    if (!user) return res.status(404).json({ data: null, error: 'User not found' });
    res.json({ data: user, error: null });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, me };

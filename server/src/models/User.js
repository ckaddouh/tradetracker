const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    settings: {
      theme: { type: String, default: 'light' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);

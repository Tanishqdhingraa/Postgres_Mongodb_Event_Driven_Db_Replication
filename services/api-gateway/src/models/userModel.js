const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    _id: Number,
    name: String,
    email: String,
    created_at: Date,
    updated_at: Date
  },
  { versionKey: false }
);

module.exports = mongoose.model('User', UserSchema);

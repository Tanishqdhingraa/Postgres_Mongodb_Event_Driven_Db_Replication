const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    _id: {
      type: Number,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    created_at: {
      type: Date
    },
    updated_at: {
      type: Date
    }
  },
  {
    timestamps: false, // timestamps are managed by PostgreSQL and replicated
    versionKey: false
  }
);

module.exports = mongoose.model('User', UserSchema);

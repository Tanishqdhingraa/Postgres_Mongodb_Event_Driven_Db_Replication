const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    _id: {
      type: Number,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    description: {
      type: String
    },
    inventory_count: {
      type: Number,
      default: 0
    },
    created_at: {
      type: Date
    },
    updated_at: {
      type: Date
    }
  },
  {
    timestamps: false,
    versionKey: false
  }
);

module.exports = mongoose.model('Product', ProductSchema);

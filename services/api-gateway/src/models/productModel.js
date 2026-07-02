const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    _id: Number,
    name: String,
    price: Number,
    description: String,
    inventory_count: Number,
    created_at: Date,
    updated_at: Date
  },
  { versionKey: false }
);

module.exports = mongoose.model('Product', ProductSchema);

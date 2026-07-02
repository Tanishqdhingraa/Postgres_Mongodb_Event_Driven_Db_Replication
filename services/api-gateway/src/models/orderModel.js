const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema(
  {
    _id: Number,
    user_id: {
      type: Number,
      ref: 'User'
    },
    product_id: {
      type: Number,
      ref: 'Product'
    },
    quantity: Number,
    total_price: Number,
    status: String,
    created_at: Date,
    updated_at: Date
  },
  { versionKey: false }
);

module.exports = mongoose.model('Order', OrderSchema);

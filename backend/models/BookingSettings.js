const mongoose = require('mongoose');

module.exports = mongoose.model('BookingSettings', new mongoose.Schema({
  _id: { type: String, default: 'booking' },
  minPaise: { type: Number, required: true },
  maxPaise: { type: Number, required: true },
  blockedDates: { type: [String], default: [] },
  version: { type: Number, default: 0 },
}, { timestamps: true }));

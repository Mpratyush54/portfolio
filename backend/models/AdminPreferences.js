const mongoose = require('mongoose');
module.exports = mongoose.model('AdminPreferences', new mongoose.Schema({
  _id: String, digestHour: Number, digestMinute: Number, version: { type: Number, default: 0 },
}));

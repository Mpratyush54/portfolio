const mongoose = require('mongoose');

function mongoReady() {
  return mongoose.connection.readyState === 1;
}

module.exports = { mongoReady };

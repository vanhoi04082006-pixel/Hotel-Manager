const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    type: { type: String, required: true }, // success, warning, error, info
    message: { type: String, required: true },
    user: { type: String, default: 'System' },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Log', logSchema);
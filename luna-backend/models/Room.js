const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, required: true }, // Standard, VIP...
    price: { type: Number, required: true },
    status: { type: String, default: 'available' }, // available, booked, maintenance
    amenities: [String]
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
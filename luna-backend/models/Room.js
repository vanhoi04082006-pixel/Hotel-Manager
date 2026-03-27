const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true }, // VD: P101, P102...
    type: { type: String, required: true }, // Standard, VIP, Deluxe...
    price: { type: Number, required: true },
    status: { type: String, default: 'available' }, // available, booked, maintenance
    image: { type: String }, // Link ảnh phòng
    area: { type: Number },  // Diện tích m2
    capacity: { type: Number }, // Số người tối đa
    bedType: { type: String }, // VD: 1 giường King
    amenities: [String]
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    roomId: { type: String, required: true },
    roomCode: { type: String },
    userId: { type: String },
    userEmail: { type: String, required: true },
    userName: { type: String, required: true },
    userPhone: { type: String, required: true },
    checkIn: { type: String, required: true },
    checkOut: { type: String, required: true },
    nights: { type: Number, required: true },
    adultCount: { type: Number, default: 1 },
    childCount: { type: Number, default: 0 },
    services: { type: Array, default: [] },
    roomPrice: { type: Number },
    roomTotal: { type: Number },
    serviceTotal: { type: Number },
    serviceFee: { type: Number },
    discountApplied: { type: Number, default: 0 },
    discountCode: { type: String },
    totalPrice: { type: Number, required: true },
    finalPaidAmount: { type: Number },
    specialRequests: { type: String },
    status: { type: String, default: 'pending' }, // pending, confirmed, completed, cancelled
    paymentStatus: { type: String, default: 'unpaid' }, // unpaid, paid
    paymentId: { type: String },
    isGuest: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
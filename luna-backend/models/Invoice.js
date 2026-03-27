const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    bookingId: { type: String, required: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String },
    customerPhone: { type: String },
    roomCode: { type: String, required: true },
    checkIn: { type: String },
    checkOut: { type: String },
    nights: { type: Number },
    roomPrice: { type: Number },
    roomTotal: { type: Number },
    services: { type: Array, default: [] },
    serviceTotal: { type: Number, default: 0 },
    serviceFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true }, // Tổng tiền khách đã trả (finalPaidAmount)
    status: { type: String, default: 'paid' }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
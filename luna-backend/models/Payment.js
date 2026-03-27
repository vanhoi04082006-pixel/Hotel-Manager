const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    bookingId: { type: String, required: true },
    userId: { type: String },
    userEmail: { type: String },
    amount: { type: Number, required: true },
    originalAmount: { type: Number },
    discount: { type: Number, default: 0 },
    discountCode: { type: String },
    method: { type: String, required: true }, // cash, bank, credit, wallet
    status: { type: String, default: 'completed' },
    transactionId: { type: String, required: true },
    roomCode: { type: String },
    bookingDetails: { type: Object }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    bookingId: { type: String },
    roomId: { type: String },
    roomCode: { type: String },
    userName: { type: String },
    userEmail: { type: String },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String },
    content: { type: String, required: true },
    anonymous: { type: Boolean, default: false },
    approved: { type: Boolean, default: false }, // Trạng thái duyệt hiển thị
    reply: { type: String }, // Khách sạn trả lời
    replyAt: { type: Date },
    replyBy: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
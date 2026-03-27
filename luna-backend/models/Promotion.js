const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    type: { type: String, required: true }, // 'percent' hoặc 'fixed'
    value: { type: Number, required: true },
    active: { type: Boolean, default: true },
    endDate: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Promotion', promotionSchema);
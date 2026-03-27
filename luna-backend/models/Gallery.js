const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
    title: { type: String, required: true },
    category: { type: String, default: 'other' }, // exterior, lobby, room, restaurant...
    image: { type: String, required: true }, // URL hoặc Base64 string
    uploadedBy: { type: String, default: 'Admin' }
}, { timestamps: true });

module.exports = mongoose.model('Gallery', gallerySchema);
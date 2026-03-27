const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true }, // ID map với Firebase Auth
    email: { type: String, required: true, unique: true },
    name: { type: String },
    phone: { type: String },
    birthday: { type: String },
    address: { type: String },
    preferences: { type: String },
    role: { type: String, default: 'user' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
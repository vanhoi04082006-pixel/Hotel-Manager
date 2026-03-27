const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    position: { type: String, default: 'receptionist' },
    department: { type: String, default: 'frontdesk' },
    startDate: { type: String }, // Lưu định dạng YYYY-MM-DD
    salary: { type: Number, default: 0 },
    notes: { type: String },
    status: { type: String, default: 'active' } // active, inactive
}, { timestamps: true });

module.exports = mongoose.model('Staff', staffSchema);
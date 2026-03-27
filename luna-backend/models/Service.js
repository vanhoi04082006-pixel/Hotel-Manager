const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    category: { type: String, required: true }, // dining, spa, wellness, transport, activities
    icon: { type: String, default: 'concierge-bell' }, // Tên class icon FontAwesome (vd: utensils, spa)
    image: { type: String }, // Link ảnh
    available: { type: Boolean, default: true }, // Trạng thái hoạt động
    unit: { type: String, default: 'person' } // person, hour, session...
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
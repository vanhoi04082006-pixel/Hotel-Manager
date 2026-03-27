const express = require('express');
const router = express.Router();
const Service = require('../models/Service');

// API Lấy danh sách dịch vụ
router.get('/', async (req, res) => {
    try {
        const services = await Service.find();
        res.json(services);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// API Thêm dịch vụ mới (Dành cho Admin gọi)
router.post('/', async (req, res) => {
    const service = new Service({
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
        category: req.body.category,
        icon: req.body.icon,
        image: req.body.image,
        available: req.body.available !== undefined ? req.body.available : true,
        unit: req.body.unit || 'person'
    });
    
    try {
        const newService = await service.save();
        res.status(201).json(newService);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
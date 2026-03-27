const express = require('express');
const router = express.Router();
const Room = require('../models/Room');

// API Lấy danh sách tất cả các phòng
router.get('/', async (req, res) => {
    try {
        const rooms = await Room.find();
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// API Thêm phòng mới
router.post('/', async (req, res) => {
    const room = new Room({
        name: req.body.name,
        code: req.body.code,
        type: req.body.type,
        price: req.body.price,
        status: req.body.status || 'available',
        image: req.body.image,
        area: req.body.area,
        capacity: req.body.capacity,
        bedType: req.body.bedType,
        amenities: req.body.amenities
    });
    
    try {
        const newRoom = await room.save();
        res.status(201).json(newRoom);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
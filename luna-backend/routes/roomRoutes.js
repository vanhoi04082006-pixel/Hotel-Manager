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

// API Thêm phòng mới (Che giấu logic xử lý ở đây)
router.post('/', async (req, res) => {
    const room = new Room({
        name: req.body.name,
        type: req.body.type,
        price: req.body.price,
        status: req.body.status,
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
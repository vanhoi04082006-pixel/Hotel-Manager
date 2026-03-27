const express = require('express');
const router = express.Router();
const Log = require('../models/Log');

// Lấy logs (giới hạn 200 bản ghi mới nhất để nhẹ tải)
router.get('/', async (req, res) => {
    try {
        const logs = await Log.find().sort({ timestamp: -1 }).limit(200);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Ghi log mới
router.post('/', async (req, res) => {
    const log = new Log(req.body);
    try {
        const newLog = await log.save();
        res.status(201).json(newLog);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Xóa toàn bộ logs
router.delete('/', async (req, res) => {
    try {
        await Log.deleteMany({});
        res.json({ message: 'Đã xóa toàn bộ nhật ký hệ thống' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
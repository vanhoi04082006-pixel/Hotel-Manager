const express = require('express');
const router = express.Router();
const User = require('../models/User');

// API Lấy thông tin User theo Firebase UID
router.get('/:uid', async (req, res) => {
    try {
        const user = await User.findOne({ uid: req.params.uid });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// API Cập nhật hồ sơ User (Dùng upsert: nếu chưa có sẽ tự tạo mới)
router.put('/:uid', async (req, res) => {
    try {
        const updatedUser = await User.findOneAndUpdate(
            { uid: req.params.uid },
            { $set: req.body },
            { new: true, upsert: true } 
        );
        res.json(updatedUser);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
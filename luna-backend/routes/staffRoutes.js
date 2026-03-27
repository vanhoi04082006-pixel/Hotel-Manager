const express = require('express');
const router = express.Router();
const Staff = require('../models/Staff');

// Lấy tất cả nhân viên
router.get('/', async (req, res) => {
    try {
        const staff = await Staff.find().sort({ createdAt: -1 });
        res.json(staff);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Thêm nhân viên mới
router.post('/', async (req, res) => {
    const staff = new Staff(req.body);
    try {
        const newStaff = await staff.save();
        res.status(201).json(newStaff);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Cập nhật nhân viên
router.put('/:id', async (req, res) => {
    try {
        const updatedStaff = await Staff.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedStaff);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Xóa nhân viên
router.delete('/:id', async (req, res) => {
    try {
        await Staff.findByIdAndDelete(req.params.id);
        res.json({ message: 'Đã xóa nhân viên' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
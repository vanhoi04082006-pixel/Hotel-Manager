const express = require('express');
const router = express.Router();
const Gallery = require('../models/Gallery');

// Lấy tất cả ảnh
router.get('/', async (req, res) => {
    try {
        const images = await Gallery.find().sort({ createdAt: -1 });
        res.json(images);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Thêm ảnh mới
router.post('/', async (req, res) => {
    const image = new Gallery(req.body);
    try {
        const newImage = await image.save();
        res.status(201).json(newImage);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Xóa ảnh
router.delete('/:id', async (req, res) => {
    try {
        await Gallery.findByIdAndDelete(req.params.id);
        res.json({ message: 'Đã xóa hình ảnh' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
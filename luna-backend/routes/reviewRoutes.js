const express = require('express');
const router = express.Router();
const Review = require('../models/Review');

// Lấy tất cả đánh giá
router.get('/', async (req, res) => {
    try {
        const reviews = await Review.find().sort({ createdAt: -1 });
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Đăng đánh giá mới (Cho khách hàng)
router.post('/', async (req, res) => {
    const review = new Review(req.body);
    try {
        const newReview = await review.save();
        res.status(201).json(newReview);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Cập nhật đánh giá (Duyệt hiển thị hoặc Phản hồi)
router.put('/:id', async (req, res) => {
    try {
        const updatedReview = await Review.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedReview);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Xóa đánh giá
router.delete('/:id', async (req, res) => {
    try {
        await Review.findByIdAndDelete(req.params.id);
        res.json({ message: 'Đã xóa đánh giá' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
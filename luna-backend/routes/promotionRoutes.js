const express = require('express');
const router = express.Router();
const Promotion = require('../models/Promotion');

// API Lấy danh sách tất cả mã giảm giá (Dành cho trang Ưu Đãi)
router.get('/', async (req, res) => {
    try {
        const promotions = await Promotion.find().sort({ createdAt: -1 });
        res.json(promotions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// API Kiểm tra và áp dụng mã giảm giá (Dành cho lúc thanh toán)
router.post('/check', async (req, res) => {
    try {
        const { code, originalAmount } = req.body;
        const promo = await Promotion.findOne({ code: code.toUpperCase(), active: true });

        if (!promo) {
            return res.status(400).json({ success: false, message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn' });
        }

        if (new Date(promo.endDate) < new Date()) {
            return res.status(400).json({ success: false, message: 'Mã giảm giá đã hết hạn' });
        }

        let discount = promo.type === 'percent' ? (originalAmount * promo.value / 100) : promo.value;
        discount = Math.min(discount, originalAmount); // Không giảm quá tổng tiền

        res.json({
            success: true,
            discount: discount,
            message: `Áp dụng thành công! Giảm ${promo.type === 'percent' ? promo.value + '%' : promo.value.toLocaleString() + 'đ'}`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
    }
});

module.exports = router;
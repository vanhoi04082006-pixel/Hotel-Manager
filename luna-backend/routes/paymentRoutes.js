const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');

// Tạo thanh toán VÀ cập nhật trạng thái Booking
router.post('/', async (req, res) => {
    try {
        // 1. Tạo bản ghi thanh toán
        const payment = new Payment(req.body);
        const savedPayment = await payment.save();

        // 2. Cập nhật booking thành 'paid'
        await Booking.findByIdAndUpdate(req.body.bookingId, {
            paymentStatus: 'paid',
            paymentId: savedPayment._id,
            discountApplied: req.body.discount || 0,
            discountCode: req.body.discountCode || null,
            finalPaidAmount: req.body.amount
        });

        res.status(201).json(savedPayment);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');

// Lấy danh sách booking của 1 user theo email
router.get('/user/:email', async (req, res) => {
    try {
        const bookings = await Booking.find({ userEmail: req.params.email }).sort({ createdAt: -1 });
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// API Tra cứu booking bằng Email và Mã đặt phòng (ID)
router.get('/lookup', async (req, res) => {
    try {
        const { email, bookingId } = req.query;
        if (!email || !bookingId) {
            return res.status(400).json({ message: "Thiếu thông tin tra cứu" });
        }

        // Tìm tất cả booking của email này
        const bookings = await Booking.find({ userEmail: email });

        // Lọc booking có chứa mã ID (so sánh 8 ký tự cuối hoặc toàn bộ)
        const foundBooking = bookings.find(b =>
            b._id.toString().includes(bookingId) ||
            b._id.toString().slice(-8).toUpperCase() === bookingId.toUpperCase()
        );

        if (!foundBooking) {
            return res.status(404).json({ message: "Không tìm thấy mã đặt phòng khớp với email" });
        }

        res.json(foundBooking);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// API Lấy chi tiết 1 booking theo ID
router.get('/:id', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: 'Không tìm thấy booking' });
        }
        res.json(booking);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Hủy booking
router.put('/:id/cancel', async (req, res) => {
    try {
        const updatedBooking = await Booking.findByIdAndUpdate(
            req.params.id,
            { status: 'cancelled' },
            { new: true }
        );
        res.json(updatedBooking);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');

// Lấy danh sách hóa đơn
router.get('/', async (req, res) => {
    try {
        const invoices = await Invoice.find().sort({ createdAt: -1 });
        res.json(invoices);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Tạo hóa đơn mới
router.post('/', async (req, res) => {
    const invoice = new Invoice(req.body);
    try {
        const newInvoice = await invoice.save();
        res.status(201).json(newInvoice);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Xóa hóa đơn (Chỉ admin dùng khi cần thiết)
router.delete('/:id', async (req, res) => {
    try {
        await Invoice.findByIdAndDelete(req.params.id);
        res.json({ message: 'Đã xóa hóa đơn' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
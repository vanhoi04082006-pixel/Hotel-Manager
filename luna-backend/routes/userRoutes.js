const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'luna_hotel_secret_key_12345';

// [POST] Đăng ký tài khoản
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        
        // Kiểm tra user tồn tại
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email đã được sử dụng' });
        }

        // Mã hóa mật khẩu
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Cấp quyền Admin nếu là email chủ tịch
        const role = email === 'lunanewyear@gmail.com' ? 'admin' : 'user';

        // Tạo User mới
        const newUser = new User({ email, password: hashedPassword, name, role });
        await newUser.save();

        // Tạo Token
        const token = jwt.sign({ id: newUser._id, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({ 
            token, 
            user: { uid: newUser._id, email: newUser.email, name: newUser.name, role: newUser.role } 
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// [POST] Đăng nhập
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Tìm user
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });

        // So sánh mật khẩu
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Mật khẩu không đúng' });

        // Tạo Token
        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({ 
            token, 
            user: { uid: user._id, email: user.email, name: user.name, role: user.role } 
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// [GET] Lấy thông tin user (Lấy theo ID)
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
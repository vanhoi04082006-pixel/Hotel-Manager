require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json()); // Để server hiểu dữ liệu JSON gửi lên

// Kết nối Database
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Đã kết nối MongoDB thành công!"))
    .catch((err) => console.error("❌ Lỗi kết nối MongoDB:", err));

// Khai báo các Routes
const roomRoutes = require('./routes/roomRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const staffRoutes = require('./routes/staffRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const logRoutes = require('./routes/logRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const galleryRoutes = require('./routes/galleryRoutes');
// 1. THÊM DÒNG NÀY ĐỂ KHAI BÁO userRoutes:
const userRoutes = require('./routes/userRoutes'); 


// Gắn vào app.use()
app.use('/api/rooms', roomRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/promotions', require('./routes/promotionRoutes'));
// 2. Dòng này giờ sẽ hoạt động bình thường:
app.use('/api/users', userRoutes); 
app.use('/api/staff', staffRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/gallery', galleryRoutes);

// Route mặc định để test server
app.get('/', (req, res) => {
    res.send('🚀 Luna Hotel API đang hoạt động mượt mà!');
});

// Chạy Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
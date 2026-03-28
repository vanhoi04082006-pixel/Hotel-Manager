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
const serviceRoutes = require('./routes/serviceRoutes'); // Thêm dòng này
const staffRoutes = require('./routes/staffRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const logRoutes = require('./routes/logRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const galleryRoutes = require('./routes/galleryRoutes');


// Gắn vào app.use()
app.use('/api/rooms', roomRoutes);
app.use('/api/services', serviceRoutes); // Thêm dòng này
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/promotions', require('./routes/promotionRoutes'));
app.use('/api/staff', staffRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/users', userRoutes); // 2. Thêm dòng này cực kỳ quan trọng
app.use('/api/staff', staffRoutes);

app.get('/', (req, res) => {
    res.send('🚀 Luna Hotel API đang hoạt động mượt mà!');
});

// Chạy Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
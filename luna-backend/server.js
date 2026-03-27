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
app.use('/api/rooms', roomRoutes);

// Chạy Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
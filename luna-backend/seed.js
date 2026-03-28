require('dotenv').config();
const mongoose = require('mongoose');

// Import các Models (Hãy đảm bảo đường dẫn đúng với cấu trúc của bạn)
const Room = require('./models/Room');
const Service = require('./models/Service');
const Promotion = require('./models/Promotion');
const Staff = require('./models/Staff');
const Review = require('./models/Review');

const seedData = async () => {
    try {
        // Kết nối Database
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Đã kết nối MongoDB. Đang chuẩn bị bơm dữ liệu...");

        // Xóa dữ liệu cũ để tránh trùng lặp nếu chạy lại nhiều lần
        await Room.deleteMany();
        await Service.deleteMany();
        await Promotion.deleteMany();
        await Staff.deleteMany();
        await Review.deleteMany();
        console.log("🧹 Đã dọn dẹp sạch sẽ dữ liệu cũ.");

        // ================= 1. DỮ LIỆU PHÒNG (25 Phòng) =================
        const rooms = [
            // Tầng 1: Standard & Superior
            { code: 'P101', name: 'Phòng Standard Giường Đơn', type: 'Standard', price: 600000, area: 20, capacity: 1, status: 'available', amenities: ['wifi', 'tv', 'ac'], image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800', description: 'Phòng tiêu chuẩn cho người đi công tác', bedType: '1 giường Single', floor: 1, bookingsCount: 45 },
            { code: 'P102', name: 'Phòng Standard Giường Đôi', type: 'Standard', price: 800000, area: 25, capacity: 2, status: 'occupied', amenities: ['wifi', 'tv', 'ac'], image: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=800', description: 'Phòng đôi tiêu chuẩn, ấm cúng', bedType: '1 giường King', floor: 1, bookingsCount: 32 },
            { code: 'P103', name: 'Phòng Standard Hai Giường', type: 'Standard', price: 850000, area: 28, capacity: 2, status: 'available', amenities: ['wifi', 'tv', 'ac'], image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=800', description: 'Phòng 2 giường đơn tiện lợi', bedType: '2 giường Single', floor: 1, bookingsCount: 20 },
            { code: 'P104', name: 'Phòng Superior Hướng Phố', type: 'Superior', price: 1200000, area: 32, capacity: 2, status: 'maintenance', amenities: ['wifi', 'tv', 'ac', 'minibar'], image: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=800', description: 'Phòng Superior với cửa sổ lớn nhìn ra phố', bedType: '1 giường King', floor: 1, bookingsCount: 15 },
            { code: 'P105', name: 'Phòng Superior Hướng Phố', type: 'Superior', price: 1200000, area: 32, capacity: 2, status: 'occupied', amenities: ['wifi', 'tv', 'ac', 'minibar'], image: 'https://images.unsplash.com/photo-1590490359683-658d34c8f92f?q=80&w=800', description: 'Phòng Superior với cửa sổ lớn nhìn ra phố', bedType: '1 giường King', floor: 1, bookingsCount: 28 },

            // Tầng 2: Superior, Deluxe & Family
            { code: 'P201', name: 'Phòng Superior Hướng Biển', type: 'Superior', price: 1500000, area: 35, capacity: 2, status: 'available', amenities: ['wifi', 'tv', 'ac', 'minibar', 'seaView'], image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=800', description: 'Tầm nhìn một góc ra biển', bedType: '1 giường King', floor: 2, bookingsCount: 19 },
            { code: 'P202', name: 'Phòng Superior Hướng Biển', type: 'Superior', price: 1500000, area: 35, capacity: 2, status: 'available', amenities: ['wifi', 'tv', 'ac', 'minibar', 'seaView'], image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=800', description: 'Tầm nhìn một góc ra biển', bedType: '2 giường Single', floor: 2, bookingsCount: 11 },
            { code: 'P203', name: 'Phòng Deluxe Hướng Phố', type: 'Deluxe', price: 1800000, area: 40, capacity: 2, status: 'occupied', amenities: ['wifi', 'tv', 'ac', 'minibar', 'bathtub'], image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=800', description: 'Nội thất sang trọng, có bồn tắm', bedType: '1 giường King', floor: 2, bookingsCount: 35 },
            { code: 'P204', name: 'Phòng Deluxe Góc', type: 'Deluxe', price: 2000000, area: 45, capacity: 2, status: 'available', amenities: ['wifi', 'tv', 'ac', 'minibar', 'bathtub'], image: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?q=80&w=800', description: 'Phòng góc thoáng đãng, nhiều ánh sáng', bedType: '1 giường King', floor: 2, bookingsCount: 24 },
            { code: 'P205', name: 'Phòng Family Cỡ Lớn', type: 'Family', price: 2800000, area: 55, capacity: 4, status: 'occupied', amenities: ['wifi', 'tv', 'ac', 'minibar', 'bathtub'], image: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=800', description: 'Tuyệt vời cho kỳ nghỉ gia đình', bedType: '2 giường Queen', floor: 2, bookingsCount: 40 },

            // Tầng 3: Deluxe, Executive
            { code: 'P301', name: 'Phòng Deluxe Hướng Biển', type: 'Deluxe', price: 2200000, area: 45, capacity: 2, status: 'maintenance', amenities: ['wifi', 'tv', 'ac', 'minibar', 'bathtub', 'seaView'], image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800', description: 'Trực diện biển, có ban công', bedType: '1 giường King', floor: 3, bookingsCount: 16 },
            { code: 'P302', name: 'Phòng Deluxe Hướng Biển', type: 'Deluxe', price: 2200000, area: 45, capacity: 2, status: 'available', amenities: ['wifi', 'tv', 'ac', 'minibar', 'bathtub', 'seaView'], image: 'https://images.unsplash.com/photo-1590490359683-658d34c8f92f?q=80&w=800', description: 'Trực diện biển, có ban công', bedType: '2 giường Single', floor: 3, bookingsCount: 22 },
            { code: 'P303', name: 'Phòng Executive Hướng Phố', type: 'Executive', price: 3000000, area: 50, capacity: 2, status: 'occupied', amenities: ['wifi', 'tv', 'ac', 'minibar', 'bathtub', 'breakfast'], image: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=800', description: 'Dịch vụ đặc quyền cho doanh nhân', bedType: '1 giường King', floor: 3, bookingsCount: 31 },
            { code: 'P304', name: 'Phòng Executive Hướng Biển', type: 'Executive', price: 3500000, area: 55, capacity: 2, status: 'available', amenities: ['wifi', 'tv', 'ac', 'minibar', 'bathtub', 'seaView', 'breakfast'], image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=800', description: 'Sang trọng, đi kèm bữa sáng VIP', bedType: '1 giường King', floor: 3, bookingsCount: 18 },
            { code: 'P305', name: 'Suite Gia Đình Cao Cấp', type: 'Family', price: 4500000, area: 75, capacity: 5, status: 'available', amenities: ['wifi', 'tv', 'ac', 'minibar', 'bathtub', 'seaView', 'breakfast'], image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=800', description: 'Căn hộ nhỏ với bếp và phòng khách', bedType: '1 King, 2 Single', floor: 3, bookingsCount: 14 },

            // Tầng 4: Suite Hạng Sang
            { code: 'P401', name: 'Suite Hướng Thành Phố', type: 'Suite', price: 5000000, area: 80, capacity: 2, status: 'occupied', amenities: ['wifi', 'tv', 'ac', 'minibar', 'bathtub', 'breakfast'], image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=800', description: 'Phòng khách và phòng ngủ tách biệt', bedType: '1 giường King', floor: 4, bookingsCount: 25 },
            { code: 'P402', name: 'Suite Hướng Biển Nhỏ', type: 'Suite', price: 5500000, area: 85, capacity: 2, status: 'available', amenities: ['wifi', 'tv', 'ac', 'minibar', 'bathtub', 'seaView', 'breakfast'], image: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?q=80&w=800', description: 'Tầm nhìn Panorama ra đại dương', bedType: '1 giường King', floor: 4, bookingsCount: 12 },
            { code: 'P403', name: 'Suite Trăng Mật', type: 'Suite', price: 6000000, area: 90, capacity: 2, status: 'occupied', amenities: ['wifi', 'tv', 'ac', 'minibar', 'bathtub', 'seaView', 'breakfast'], image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800', description: 'Setup lãng mạn, bồn tắm hoa hồng', bedType: '1 giường King', floor: 4, bookingsCount: 38 },
            { code: 'P404', name: 'Grand Suite Biển', type: 'Suite', price: 6500000, area: 95, capacity: 4, status: 'available', amenities: ['wifi', 'tv', 'ac', 'minibar', 'bathtub', 'seaView', 'breakfast'], image: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=800', description: 'Nội thất nhập khẩu cao cấp', bedType: '2 giường Queen', floor: 4, bookingsCount: 9 },
            { code: 'P405', name: 'Royal Suite (Phòng Hoàng Gia)', type: 'Suite', price: 8500000, area: 110, capacity: 4, status: 'maintenance', amenities: ['wifi', 'tv', 'ac', 'minibar', 'bathtub', 'seaView', 'breakfast'], image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=800', description: 'Trải nghiệm phong cách hoàng tộc', bedType: '2 giường King', floor: 4, bookingsCount: 7 },

            // Tầng 5: Penthouse & Presidential
            { code: 'P501', name: 'Penthouse Căn Góc', type: 'Suite', price: 12000000, area: 150, capacity: 6, status: 'available', amenities: ['wifi', 'tv', 'ac', 'minibar', 'bathtub', 'seaView', 'breakfast', 'pool'], image: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=800', description: 'Biệt thự trên cao, hồ bơi vô cực', bedType: '3 giường King', floor: 5, bookingsCount: 5 },
            { code: 'P502', name: 'Penthouse Trung Tâm', type: 'Suite', price: 15000000, area: 180, capacity: 6, status: 'occupied', amenities: ['wifi', 'tv', 'ac', 'minibar', 'bathtub', 'seaView', 'breakfast', 'pool'], image: 'https://images.unsplash.com/photo-1590490359683-658d34c8f92f?q=80&w=800', description: 'Biệt thự trên cao, hồ bơi vô cực', bedType: '3 giường King', floor: 5, bookingsCount: 8 },
            { code: 'P503', name: 'Luna Signature Suite', type: 'Suite', price: 18000000, area: 200, capacity: 4, status: 'available', amenities: ['wifi', 'tv', 'ac', 'minibar', 'bathtub', 'seaView', 'breakfast', 'pool'], image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=800', description: 'Phòng mang dấu ấn thương hiệu Luna', bedType: '2 giường King', floor: 5, bookingsCount: 3 },
            { code: 'P504', name: 'Phòng Tổng Thống', type: 'Suite', price: 25000000, area: 300, capacity: 6, status: 'available', amenities: ['wifi', 'tv', 'ac', 'minibar', 'bathtub', 'seaView', 'breakfast', 'pool'], image: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?q=80&w=800', description: 'Tuyệt tác không gian sống đỉnh cao', bedType: '3 giường King', floor: 5, bookingsCount: 1 },
            { code: 'P505', name: 'Tổng Thống Hướng Biển', type: 'Suite', price: 30000000, area: 350, capacity: 6, status: 'occupied', amenities: ['wifi', 'tv', 'ac', 'minibar', 'bathtub', 'seaView', 'breakfast', 'pool'], image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=800', description: 'Căn hộ thượng lưu với mọi tiện ích VIP nhất', bedType: '3 giường King', floor: 5, bookingsCount: 4 }
        ];

        // ================= 2. DỮ LIỆU DỊCH VỤ =================
        const services = [
            { name: 'Buffet Sáng', description: 'Thưởng thức buffet Á-Âu đa dạng.', price: 250000, unit: 'person', icon: 'utensils', image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=800', available: true, category: 'dining' },
            { name: 'Spa & Massage', description: 'Thư giãn cơ thể với liệu pháp massage trị liệu 60 phút.', price: 800000, unit: 'person', icon: 'spa', image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=800', available: true, category: 'wellness' },
            { name: 'Xe Đưa Đón Sân Bay', description: 'Dịch vụ đưa đón tận nơi an toàn bằng xe sang 4 chỗ.', price: 500000, unit: 'room', icon: 'car', image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=800', available: true, category: 'transport' },
            { name: 'Phòng Gym VIP', description: 'Mở cửa 24/7 với trang thiết bị Technogym hiện đại.', price: 150000, unit: 'person', icon: 'dumbbell', image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800', available: true, category: 'wellness' },
            { name: 'Tiệc Nướng BBQ Bãi Biển', description: 'Bữa tối lãng mạn dưới ánh nến và hải sản tươi sống.', price: 1200000, unit: 'person', icon: 'utensils', image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=800', available: true, category: 'dining' },
            { name: 'Dịch vụ Giặt Ủi Cao Cấp', description: 'Giặt sấy trong ngày với quy trình tiêu chuẩn resort.', price: 100000, unit: 'room', icon: 'shirt', image: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?q=80&w=800', available: true, category: 'other' }
        ];

        // ================= 3. DỮ LIỆU NHÂN SỰ =================
        const staffs = [
            { name: 'Nguyễn Văn Hoàng', email: 'hoang.nv@lunahotel.com', phone: '0901234567', position: 'manager', department: 'management', salary: 25000000, status: 'active', startDate: '2020-01-15' },
            { name: 'Trần Thị Thu Thủy', email: 'thu.tt@lunahotel.com', phone: '0987654321', position: 'receptionist', department: 'frontdesk', salary: 12000000, status: 'active', startDate: '2022-05-10' },
            { name: 'Lê Hoàng Anh', email: 'anh.lh@lunahotel.com', phone: '0912345678', position: 'chef', department: 'kitchen', salary: 20000000, status: 'active', startDate: '2021-11-20' },
            { name: 'Phạm Thị Lan', email: 'lan.pt@lunahotel.com', phone: '0934567890', position: 'housekeeping', department: 'housekeeping', salary: 9000000, status: 'active', startDate: '2023-02-01' }
        ];

        // ================= 4. DỮ LIỆU KHUYẾN MÃI =================
        const promotions = [
            { code: 'SUMMER2026', name: 'Chào Hè Sôi Động 2026', type: 'percent', value: 15, condition: 'all', minAmount: 0, startDate: '2026-05-01', endDate: '2026-08-31', active: true, description: 'Giảm 15% cho mọi booking trong mùa hè.' },
            { code: 'VIPWELCOME', name: 'Quà Tặng Lần Đầu', type: 'fixed', value: 500000, condition: 'first_booking', minAmount: 2000000, startDate: '2024-01-01', endDate: '2026-12-31', active: true, description: 'Giảm trực tiếp 500k cho khách hàng lần đầu đặt phòng.' },
            { code: 'LUNALUXURY', name: 'Tuần Lễ Vàng Hạng Sang', type: 'percent', value: 25, condition: 'min_amount', minAmount: 10000000, startDate: '2026-04-01', endDate: '2026-04-15', active: true, description: 'Giảm siêu khủng 25% cho các đơn trên 10 triệu.' }
        ];

        // ================= 5. DỮ LIỆU ĐÁNH GIÁ (REVIEWS) =================
        const reviews = [
            { userName: 'Trần Đăng Khoa', userEmail: 'khoatd@gmail.com', roomCode: 'P504', rating: 5, title: 'Trải nghiệm tuyệt vời', content: 'Phòng Tổng thống view biển thực sự đẳng cấp. Dịch vụ không có điểm nào để chê.', approved: true, anonymous: false },
            { userName: 'Nguyễn Bích Ngọc', userEmail: 'ngocnb@yahoo.com', roomCode: 'P201', rating: 4, title: 'Khá hài lòng', content: 'Phòng sạch sẽ, nhân viên thân thiện. Điểm trừ duy nhất là buffet sáng chưa phong phú lắm.', approved: true, anonymous: false },
            { userName: 'Lê Khách', userEmail: 'khachle@gmail.com', roomCode: 'P403', rating: 5, title: 'Kỳ trăng mật lãng mạn', content: 'Cảm ơn Luna Hotel đã chuẩn bị phòng Honeymoon cực kỳ lãng mạn. Vợ tôi rất thích bồn tắm hoa hồng.', approved: true, anonymous: false, reply: 'Luna Hotel rất vinh hạnh được đồng hành cùng anh chị trong dịp đặc biệt này. Hẹn gặp lại anh chị!' }
        ];

        // Lưu vào MongoDB
        await Room.insertMany(rooms);
        await Service.insertMany(services);
        await Promotion.insertMany(promotions);
        await Staff.insertMany(staffs);
        await Review.insertMany(reviews);

        console.log("🎉 BƠM DỮ LIỆU MẪU THÀNH CÔNG! BẠN CÓ THỂ TẮT TERMINAL NÀY.");
        process.exit(0);

    } catch (error) {
        console.error("❌ Lỗi khi bơm dữ liệu:", error);
        process.exit(1);
    }
};

seedData();
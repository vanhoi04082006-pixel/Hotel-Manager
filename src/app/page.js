// src/app/page.jsx
"use client"; 
import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

// Hàm tiện ích format tiền tệ
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export default function Home() {
  const [rooms, setRooms] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Lấy dữ liệu từ Firebase
  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        // Lấy danh sách phòng nổi bật
        const roomsSnap = await getDocs(collection(db, 'rooms'));
        const allRooms = roomsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const featuredRooms = allRooms.filter(r => r.status === 'available').slice(0, 3);
        setRooms(featuredRooms);

        // Lấy danh sách dịch vụ
        const servicesSnap = await getDocs(collection(db, 'services'));
        const allServices = servicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const featuredServices = allServices.slice(0, 4);
        setServices(featuredServices);
      } catch (error) {
        console.error('Lỗi tải dữ liệu:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, []);

  return (
    <div id="main-content" className="loaded">
      <Header />
      
      <main className="user-main">
        {/* Banner Section */}
        <div 
          className="hero-section min-h-[85vh] flex items-center relative"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2000&auto=format&fit=crop')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed'
          }}
        >
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 to-black/70"></div>
          
          <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10 w-full">
            <div className="max-w-3xl">
              <span className="inline-block py-1 px-3 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30 text-xs font-bold tracking-widest uppercase mb-6 animate-pulse">
                Khám phá chuẩn mực mới
              </span>
              <h1 className="text-5xl md:text-7xl font-playfair font-bold text-white mb-6 leading-tight drop-shadow-lg">
                Nơi Khởi Nguồn<br /><span className="italic font-light">Cảm Hứng Bất Tận</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-200 mb-10 max-w-xl font-light">
                Trải nghiệm không gian nghỉ dưỡng đẳng cấp 5 sao với dịch vụ hoàn hảo và tầm nhìn ôm trọn đại dương tuyệt đẹp.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/rooms" className="bg-blue-600 text-white px-8 py-4 rounded-full font-bold shadow-lg shadow-blue-600/40 hover:bg-blue-700 hover:-translate-y-1 transition-all duration-300">
                  Đặt phòng ngay
                </Link>
                <Link href="/booking-lookup" className="bg-white/10 backdrop-blur-md border border-white/30 text-white px-8 py-4 rounded-full font-bold hover:bg-white/20 hover:-translate-y-1 transition-all duration-300">
                  <i className="fa-solid fa-magnifying-glass mr-2"></i>Tra cứu mã đặt
                </Link>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
            <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
              <div className="w-1 h-3 bg-white rounded-full mt-2 opacity-80"></div>
            </div>
          </div>
        </div>

        {/* Thông số thống kê */}
        <div className="bg-white py-12 border-b border-slate-100 relative z-20 -mt-10 mx-4 md:mx-8 lg:mx-12 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2 font-playfair">500+</div>
                <div className="text-slate-500 font-medium text-sm uppercase tracking-wider">Phòng cao cấp</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2 font-playfair">50k+</div>
                <div className="text-slate-500 font-medium text-sm uppercase tracking-wider">Khách hàng</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2 font-playfair">4.9/5</div>
                <div className="text-slate-500 font-medium text-sm uppercase tracking-wider">Đánh giá</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2 font-playfair">24/7</div>
                <div className="text-slate-500 font-medium text-sm uppercase tracking-wider">Hỗ trợ</div>
              </div>
            </div>
          </div>
        </div>

        {/* Danh sách phòng nổi bật */}
        <div className="py-24 bg-[#f8fafc]">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12">
              <div>
                <span className="text-blue-600 font-bold text-sm uppercase tracking-widest mb-2 block">Lựa chọn hàng đầu</span>
                <h2 className="text-4xl md:text-5xl font-playfair font-bold text-slate-900">Phòng Nổi Bật</h2>
              </div>
              <Link href="/rooms" className="hidden md:inline-flex items-center font-bold text-blue-600 hover:text-blue-700 transition-colors group">
                Xem tất cả <i className="fa-solid fa-arrow-right ml-2 transform group-hover:translate-x-1 transition-transform"></i>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
              {loading ? (
                <div className="col-span-3 text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100">
                  <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-500 font-medium">Đang tải bộ sưu tập phòng...</p>
                </div>
              ) : rooms.length === 0 ? (
                <div className="col-span-3 text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100">
                  <p className="text-slate-500 font-medium">Hiện chưa có phòng nổi bật</p>
                </div>
              ) : (
                rooms.map((room) => (
                  <div key={room.id} className="bg-white p-4 md:p-5 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(37,99,235,0.08)] border border-slate-100/50 flex flex-col h-full transition-all duration-300 group">
                    <div className="h-60 relative rounded-2xl overflow-hidden mb-6">
                      <img src={room.image || 'https://images.unsplash.com/photo-1611892440504-42a792e24d32'} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={`Phòng ${room.code}`} />
                      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-slate-800 shadow-sm">
                        {room.type || 'Cao cấp'}
                      </div>
                      <div className="absolute top-3 right-3 bg-blue-600/90 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center shadow-sm">
                        <i className="fa-solid fa-star text-amber-300 mr-1 text-[10px]"></i> 5.0
                      </div>
                    </div>
                    
                    <div className="flex flex-col flex-grow px-2">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-2xl font-bold text-slate-900 leading-tight">Phòng {room.code}</h3>
                        <div className="text-right">
                          <span className="text-xl font-bold text-blue-600 block">{formatCurrency(room.price)}</span>
                          <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">/ Đêm</span>
                        </div>
                      </div>
                      
                      <p className="text-slate-500 text-[15px] mb-6 line-clamp-2">
                        {room.name || room.description || 'Trải nghiệm không gian sang trọng.'}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-3 text-[14px] text-slate-600 font-medium mb-8 bg-slate-50/50 p-4 rounded-2xl mt-auto border border-slate-100">
                        <div className="flex items-center"><i className="fa-solid fa-expand text-blue-400 w-5"></i>{room.area || 30}m²</div>
                        <div className="flex items-center"><i className="fa-regular fa-user text-blue-400 w-5"></i>{room.capacity || 2} khách</div>
                      </div>
                      
                      <Link href={`/rooms?book=${room.id}`} className="w-full text-center bg-slate-100 text-slate-800 py-3.5 rounded-xl font-bold text-[15px] hover:bg-blue-600 hover:text-white hover:shadow-lg hover:shadow-blue-600/20 transition-all duration-300">
                        Đặt phòng này
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="text-center mt-10 md:hidden">
              <Link href="/rooms" className="inline-flex items-center px-8 py-4 bg-slate-900 text-white rounded-full font-bold shadow-lg shadow-slate-900/20">
                Xem tất cả phòng
              </Link>
            </div>
          </div>
        </div>

        {/* Danh sách Dịch vụ nổi bật */}
        <div className="py-24 bg-white border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="text-center mb-16">
              <span className="text-blue-600 font-bold text-sm uppercase tracking-widest mb-2 block">Trải nghiệm</span>
              <h2 className="text-4xl md:text-5xl font-playfair font-bold text-slate-900 mb-4">Dịch Vụ Đẳng Cấp</h2>
              <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                Nâng niu từng khoảnh khắc với hệ thống tiện ích 5 sao được thiết kế riêng biệt cho chuyến đi của bạn.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              {loading ? (
                <div className="col-span-4 text-center py-20 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-500 font-medium">Đang tải dữ liệu dịch vụ...</p>
                </div>
              ) : services.length === 0 ? (
                <div className="col-span-4 text-center py-20 bg-slate-50 rounded-3xl border border-slate-100">
                  <p className="text-slate-500 font-medium">Hiện chưa có dịch vụ nào</p>
                </div>
              ) : (
                services.map((service) => {
                  const unitStr = service.unit === 'person' ? '/ Người' : service.unit === 'room' ? '/ Phòng' : '/ Giờ';
                  
                  return (
                    <div key={service.id} className="bg-white p-5 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(37,99,235,0.08)] border border-slate-100/50 flex flex-col h-full transition-all duration-300 group">
                      <div className="w-16 h-16 bg-blue-50 group-hover:bg-blue-600 rounded-2xl flex items-center justify-center text-blue-600 group-hover:text-white transition-colors duration-300 mb-5">
                        <i className={`fa-solid fa-${service.icon || 'star'} text-2xl`}></i>
                      </div>
                      
                      <h3 className="text-xl font-bold text-slate-900 mb-2">{service.name}</h3>
                      <p className="text-slate-500 text-[14px] line-clamp-2 mb-6 flex-grow">
                        {service.description || 'Trải nghiệm tiện ích tuyệt vời.'}
                      </p>
                      
                      <div className="pt-4 border-t border-slate-100 mt-auto flex items-end justify-between">
                        <div>
                          <span className="text-lg font-bold text-blue-600 block">{formatCurrency(service.price || 0)}</span>
                          <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{unitStr}</span>
                        </div>
                        <Link href="/services" className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-900 hover:text-white transition-all">
                          <i className="fa-solid fa-arrow-right"></i>
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
} 
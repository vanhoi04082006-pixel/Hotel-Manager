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

// Hình ảnh mặc định nếu dịch vụ không có ảnh
const DEFAULT_IMAGES = {
    dining: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=800",
    spa: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=800",
    wellness: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800",
    transport: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=800",
    activities: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=800",
};

export default function Home() {
  const [rooms, setRooms] = useState([]);
  const [services, setServices] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  
  // State cho Custom Toast Notification
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Lấy dữ liệu từ Firebase
  useEffect(() => {
    const loadAllData = async () => {
      try {
        const [roomsSnap, servicesSnap] = await Promise.all([
          getDocs(collection(db, 'rooms')),
          getDocs(collection(db, 'services'))
        ]);

        const allRooms = roomsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const featuredRooms = allRooms.filter(r => r.status === 'available').slice(0, 3);
        setRooms(featuredRooms);

        const allServices = servicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const featuredServices = allServices.slice(0, 4);
        setServices(featuredServices);

      } catch (error) {
        console.error('Lỗi tải dữ liệu:', error);
      } finally {
        setLoadingRooms(false);
        setLoadingServices(false);
        setTimeout(() => setIsPageLoaded(true), 600); 
      }
    };

    loadAllData();
  }, []);

  // Hàm gọi Custom Toast
  const showNotification = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
        setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  // Hàm xử lý "Đặt ngay" dịch vụ
  const handleAddToCart = (service) => {
      sessionStorage.setItem("selectedService", JSON.stringify(service));
      showNotification(`Đã thêm "${service.name}" vào danh sách yêu thích!`, 'success');
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popInItem { 0% { opacity: 0; transform: scale(0.95) translateY(20px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .animate-item { opacity: 0; animation: popInItem 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .hero-section {
          background-image: url('https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2000&auto=format&fit=crop');
          background-size: cover;
          background-position: center;
          background-attachment: fixed;
          position: relative;
        }
        .hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, rgba(15, 23, 42, 0.4), rgba(0, 0, 0, 0.7));
        }
        .custom-loader {
          border: 3px solid #e2e8f0;
          border-top: 3px solid #2563eb;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }
        .ultra-glass-pill {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 1);
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);
        }
      `}} />

      {/* Custom Toast Notification Component */}
      <div className={`fixed top-6 right-6 z-[10000] transition-all duration-500 transform ${toast.show ? 'translate-x-0 opacity-100' : 'translate-x-[150%] opacity-0'}`}>
          <div className={`flex items-center p-4 rounded-2xl shadow-2xl border backdrop-blur-xl bg-white/90 ${toast.type === 'success' ? 'border-emerald-100' : 'border-rose-100'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 shadow-inner ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                  <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'} text-lg`}></i>
              </div>
              <span className="font-bold text-slate-800 text-[14px] pr-2">{toast.message}</span>
          </div>
      </div>

      {/* Màn hình Loading Khởi tạo */}
      <div className={`fixed inset-0 bg-white z-[9999] flex items-center justify-center flex-col transition-opacity duration-700 ease-in-out ${isPageLoaded ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        <div className="text-center transition-transform duration-700 scale-100">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <i className="fa-solid fa-hotel text-4xl text-blue-600"></i>
          </div>
          <h2 className="text-3xl font-playfair font-bold text-slate-900 mb-4">Luna Hotel</h2>
          <div className="custom-loader mx-auto mb-5"></div>
          <p className="text-slate-500 font-medium">Đang chuẩn bị không gian tuyệt vời...</p>
        </div>
      </div>

      <div id="main-content" className={`min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans transition-opacity duration-1000 ${isPageLoaded ? "opacity-100" : "opacity-0"}`}>
        <Header />
        
        <main className="user-main">
          
          {/* Banner Section */}
          <div className="hero-section min-h-[85vh] flex items-center relative">
            <div className="hero-overlay"></div>
            
            <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10 w-full">
              <div className="max-w-3xl">
                <span className="inline-block py-1.5 px-4 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30 text-xs font-bold tracking-widest uppercase mb-6 animate-pulse shadow-lg">
                  Khám phá chuẩn mực mới
                </span>
                <h1 className="text-5xl md:text-7xl font-playfair font-bold text-white mb-6 leading-tight drop-shadow-2xl">
                  Nơi Khởi Nguồn<br /><span className="italic font-light">Cảm Hứng Bất Tận</span>
                </h1>
                <p className="text-lg md:text-xl text-slate-200 mb-10 max-w-xl font-light">
                  Trải nghiệm không gian nghỉ dưỡng đẳng cấp 5 sao với dịch vụ hoàn hảo và tầm nhìn ôm trọn đại dương tuyệt đẹp.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link href="/rooms" className="bg-blue-600 text-white px-8 py-4 rounded-full font-bold shadow-lg shadow-blue-600/40 hover:bg-blue-700 hover:-translate-y-1 transition-all duration-300">
                    Đặt phòng ngay
                  </Link>
                  <Link href="/booking-lookup" className="bg-white/10 backdrop-blur-md border border-white/30 text-white px-8 py-4 rounded-full font-bold hover:bg-white/20 hover:-translate-y-1 transition-all duration-300 flex items-center">
                    <i className="fa-solid fa-magnifying-glass mr-2"></i>Tra cứu mã đặt
                  </Link>
                </div>
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
                {loadingRooms ? (
                  <div className="col-span-3 text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100">
                    <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-500 font-medium">Đang tải bộ sưu tập phòng...</p>
                  </div>
                ) : rooms.length === 0 ? (
                  <div className="col-span-3 text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100">
                    <p className="text-slate-500 font-medium">Hiện chưa có phòng nổi bật</p>
                  </div>
                ) : (
                  rooms.map((room, index) => (
                    <div key={room.id} className="animate-item bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(37,99,235,0.1)] border border-slate-100 flex flex-col h-full transition-all duration-500 transform hover:-translate-y-2 group relative" style={{ animationDelay: `${index * 0.1}s` }}>
                      
                      {/* 1. KHUNG HÌNH ẢNH */}
                      <div className="h-64 relative rounded-t-[2rem] overflow-hidden bg-slate-100 shrink-0">
                        <img src={room.image || 'https://images.unsplash.com/photo-1611892440504-42a792e24d32'} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={`Phòng ${room.code}`} />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity"></div>
                        
                        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-slate-800 shadow-sm border border-white/50">
                          {room.type || 'Cao cấp'}
                        </div>
                        <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center shadow-sm border border-white/20">
                          <i className="fa-solid fa-star text-amber-300 mr-1.5 text-[10px]"></i> 5.0
                        </div>
                      </div>

                      {/* 2. CỤC GIÁ TIỀN (CHUYỂN RA NGOÀI VÀ SỬA KHOẢNG TRẮNG) */}
                      <div className="absolute top-64 right-6 -translate-y-1/2 ultra-glass-pill px-5 py-2.5 rounded-2xl z-20 flex items-baseline gap-1.5 bg-white shadow-xl border border-slate-100">
                          <span className="text-xl font-bold font-mono text-blue-600 tracking-tight">
                              {room.price.toLocaleString("vi-VN")}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">đ / Đêm</span>
                      </div>
                      
                      {/* 3. KHUNG NỘI DUNG CHỮ */}
                      <div className="p-6 md:p-8 pt-10 flex flex-col flex-grow relative z-10 bg-white rounded-b-[2rem]">
                        <h3 className="text-2xl font-playfair font-bold text-slate-900 leading-tight mb-3 group-hover:text-blue-600 transition-colors duration-300">Phòng {room.code}</h3>
                        
                        <p className="text-slate-500 text-[15px] mb-6 line-clamp-2 leading-relaxed">
                          {room.name || room.description || 'Trải nghiệm không gian sang trọng.'}
                        </p>
                        
                        <div className="flex flex-wrap gap-2 text-[12px] text-slate-600 font-medium mb-8 mt-auto">
                            <span className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg flex items-center"><i className="fa-solid fa-expand text-blue-400 w-4 mr-1"></i>{room.area || 30}m²</span>
                            <span className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg flex items-center"><i className="fa-regular fa-user text-emerald-500 w-4 mr-1"></i>{room.capacity || 2} khách</span>
                        </div>
                        
                        <Link href={`/rooms?book=${room.id}`} className="w-full text-center bg-slate-900 text-white py-4 rounded-xl font-bold text-[14px] hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-600/30 transition-all duration-300 transform group-hover:-translate-y-1">
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
                {loadingServices ? (
                  <div className="col-span-4 text-center py-20 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-500 font-medium">Đang tải dữ liệu dịch vụ...</p>
                  </div>
                ) : services.length === 0 ? (
                  <div className="col-span-4 text-center py-20 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-slate-500 font-medium">Hiện chưa có dịch vụ nào</p>
                  </div>
                ) : (
                  services.map((service, index) => {
                    let sCat = 'activities';
                    if (['utensils', 'cocktail', 'cake'].includes(service.icon)) sCat = 'dining';
                    if (['spa', 'swimmer', 'dumbbell'].includes(service.icon)) sCat = 'wellness';
                    if (['car', 'motorcycle'].includes(service.icon)) sCat = 'transport';

                    const displayImage = service.image || DEFAULT_IMAGES[service.category] || DEFAULT_IMAGES[sCat] || DEFAULT_IMAGES.activities;
                    const priceDisplay = service.price ? formatCurrency(service.price) : "Liên hệ";
                    const unitStr = service.unit === 'person' ? '/ Người' : service.unit === 'room' ? '/ Phòng' : service.unit === 'hour' ? '/ Giờ' : '/ Ngày';
                    
                    return (
                        <div
                            key={service.id}
                            className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(37,99,235,0.1)] transition-all duration-500 transform hover:-translate-y-2 flex flex-col group animate-item"
                            style={{ animationDelay: `${index * 0.1}s` }}
                        >
                            <div className="relative h-48 w-full overflow-hidden bg-slate-100 rounded-t-[2rem]">
                                <img
                                    src={displayImage}
                                    alt={service.name || "Dịch vụ"}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300"></div>
                                
                                {/* Category Badge */}
                                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-[11px] font-bold text-slate-800 shadow-sm z-20 flex items-center gap-1.5 border border-white/50 uppercase">
                                    <i className={`fa-solid fa-${service.icon || 'star'} text-blue-500`}></i>
                                    {service.category === 'dining' ? 'Ẩm thực' : service.category === 'spa' ? 'Spa' : service.category === 'wellness' ? 'Sức khỏe' : 'Tiện ích'}
                                </div>
                            </div>

                            <div className="p-6 flex-1 flex flex-col relative z-10 bg-white rounded-b-[2rem]">
                                <h3 className="text-xl font-playfair font-bold text-slate-800 mb-3 line-clamp-2 group-hover:text-blue-600 transition-colors duration-300 leading-tight">
                                    {service.name || "Tên dịch vụ"}
                                </h3>
                                
                                <p className="text-slate-500 text-[14px] line-clamp-2 mb-6 flex-1 leading-relaxed">
                                    {service.description || "Trải nghiệm tiện ích cao cấp dành riêng cho quý khách tại Luna Hotel."}
                                </p>
                                
                                <div className="pt-4 border-t border-slate-100 border-dashed mt-auto flex items-end justify-between">
                                    <div>
                                        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Mức giá</span>
                                        <span className="text-lg font-bold font-mono text-blue-600 block">{priceDisplay.replace("₫", "")}</span>
                                        {service.price && <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{unitStr}</span>}
                                    </div>
                                    <button
                                        onClick={() => handleAddToCart(service)}
                                        className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all flex items-center justify-center shadow-sm group-hover:-translate-y-1"
                                        title="Lưu dịch vụ này"
                                    >
                                        <i className="fa-solid fa-plus text-sm"></i>
                                    </button>
                                </div>
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
    </>
  );
}
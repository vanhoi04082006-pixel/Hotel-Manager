// src/app/offers/page.jsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// Hàm tiện ích
const formatCurrency = (amount) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString("vi-VN") : "";

export default function OffersPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Kiểm tra đăng nhập và lấy dữ liệu Voucher
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser({ uid: user.uid, email: user.email });
      } else {
        setCurrentUser(null);
      }
    });

    const fetchPromotions = async () => {
      try {
        const promotionsSnap = await getDocs(collection(db, "promotions"));
        const activePromos = promotionsSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(p => p.active); // Chỉ lấy các mã đang active
        
        setPromotions(activePromos);
      } catch (error) {
        console.error("Lỗi tải khuyến mãi:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPromotions();

    return () => unsubscribe();
  }, []);

  // Xử lý nhận ưu đãi
  const handleClaimOffer = (type) => {
    if (!currentUser) {
      alert("Vui lòng đăng nhập để nhận ưu đãi!");
      router.push("/login");
      return;
    }
    alert(`Tuyệt vời! Ưu đãi ${type.toUpperCase()} đã được kích hoạt thành công.`);
  };

  // Copy mã giảm giá
  const copyPromoCode = (code) => {
    navigator.clipboard.writeText(code);
    alert(`Đã sao chép mã: ${code}`);
  };

  // Xem chi tiết
  const viewPromoDetails = (promo) => {
    const discountText = promo.type === "percent" ? `${promo.value}%` : formatCurrency(promo.value);
    alert(`Thông tin Voucher:\n\nTên: ${promo.name}\nMã: ${promo.code}\nGiảm: ${discountText}\nHạn sử dụng: ${formatDate(promo.endDate)}`);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800">
      <Header />

      <main className="min-h-[calc(100vh-80px)] pb-24">
        {/* Hero Banner */}
        <div className="relative h-80 md:h-[450px] w-full mb-16">
          <img src="https://images.unsplash.com/photo-1607860108855-64acf2078ed9?q=80&w=2000&auto=format&fit=crop" className="w-full h-full object-cover" alt="Offers Banner" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent"></div>
          <div className="absolute inset-0 flex items-center">
            <div className="max-w-7xl mx-auto px-4 md:px-8 w-full">
              <div className="max-w-2xl">
                <span className="bg-gradient-to-r from-amber-400 to-amber-600 text-white px-5 py-2 rounded-full text-[13px] font-bold uppercase tracking-wider mb-6 inline-flex items-center shadow-lg animate-pulse">
                  <i className="fa-solid fa-fire mr-2"></i>Ưu Đãi Đặc Biệt
                </span>
                <h2 className="text-4xl md:text-6xl font-playfair font-bold text-white mb-6 leading-tight drop-shadow-lg">
                  Dành Riêng<br /><span className="italic font-light">Cho Chuyến Đi Của Bạn</span>
                </h2>
                <p className="text-lg md:text-xl text-slate-300 font-light">Mở khóa những đặc quyền hấp dẫn và tiết kiệm hơn khi đặt phòng trực tiếp tại Luna Hotel.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-8">
          
          {/* Đặc quyền hội viên */}
          <div className="mb-20">
            <h3 className="text-3xl md:text-4xl font-playfair font-bold text-slate-900 mb-10 flex items-center">
              <i className="fa-solid fa-crown text-amber-500 mr-4 text-3xl"></i>Đặc quyền hội viên
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* Bronze */}
              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-amber-100 relative overflow-hidden group hover:shadow-xl hover:-translate-y-2 transition-all duration-500">
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-amber-100 to-transparent rounded-bl-full -mr-10 -mt-10 opacity-50 group-hover:scale-110 transition-transform duration-700"></div>
                <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-6 border border-amber-100 shadow-sm relative z-10">
                  <i className="fa-solid fa-seedling text-3xl text-amber-600"></i>
                </div>
                <h4 className="text-2xl font-bold text-slate-900 mb-2 relative z-10">Bronze Welcome</h4>
                <p className="text-slate-500 text-[15px] mb-8 relative z-10">Dành cho thành viên mới bắt đầu hành trình.</p>
                <ul className="space-y-4 mb-10 relative z-10">
                  <li className="flex items-start text-slate-700 font-medium"><i className="fa-solid fa-check text-amber-500 mr-3 mt-1 text-lg"></i>Giảm 5% cho lần đặt phòng đầu tiên</li>
                  <li className="flex items-start text-slate-700 font-medium"><i className="fa-solid fa-check text-amber-500 mr-3 mt-1 text-lg"></i>Trà chiều miễn phí (1 lần)</li>
                  <li className="flex items-start text-slate-700 font-medium"><i className="fa-solid fa-check text-amber-500 mr-3 mt-1 text-lg"></i>Check-out muộn 13:00 (Tùy tình trạng)</li>
                </ul>
                <button onClick={() => handleClaimOffer("bronze")} className="w-full bg-amber-50 text-amber-700 py-3.5 rounded-xl font-bold hover:bg-amber-600 hover:text-white transition-all shadow-sm relative z-10 border border-amber-200">Kích hoạt ưu đãi</button>
              </div>

              {/* Silver */}
              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-xl hover:-translate-y-2 transition-all duration-500">
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-slate-200 to-transparent rounded-bl-full -mr-10 -mt-10 opacity-50 group-hover:scale-110 transition-transform duration-700"></div>
                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 border border-slate-200 shadow-sm relative z-10">
                  <i className="fa-solid fa-star text-3xl text-slate-500"></i>
                </div>
                <h4 className="text-2xl font-bold text-slate-900 mb-2 relative z-10">Silver Weekend</h4>
                <p className="text-slate-500 text-[15px] mb-8 relative z-10">Thư giãn cuối tuần cực chill dành cho bạn.</p>
                <ul className="space-y-4 mb-10 relative z-10">
                  <li className="flex items-start text-slate-700 font-medium"><i className="fa-solid fa-check text-slate-400 mr-3 mt-1 text-lg"></i>Giảm 10% các đêm thứ 7, Chủ Nhật</li>
                  <li className="flex items-start text-slate-700 font-medium"><i className="fa-solid fa-check text-slate-400 mr-3 mt-1 text-lg"></i>Tặng kèm Buffet sáng cho 2 người</li>
                  <li className="flex items-start text-slate-700 font-medium"><i className="fa-solid fa-check text-slate-400 mr-3 mt-1 text-lg"></i>Hỗ trợ phí nâng cấp phòng lên tới 30%</li>
                </ul>
                <button onClick={() => handleClaimOffer("silver")} className="w-full bg-slate-50 text-slate-700 py-3.5 rounded-xl font-bold hover:bg-slate-600 hover:text-white transition-all shadow-sm relative z-10 border border-slate-200">Kích hoạt ưu đãi</button>
              </div>

              {/* Gold */}
              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-yellow-200 relative overflow-hidden group hover:shadow-xl hover:-translate-y-2 transition-all duration-500">
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-yellow-200 to-transparent rounded-bl-full -mr-10 -mt-10 opacity-50 group-hover:scale-110 transition-transform duration-700"></div>
                <div className="absolute top-4 right-4 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-yellow-200">Bán chạy</div>
                <div className="w-16 h-16 rounded-2xl bg-yellow-50 flex items-center justify-center mb-6 border border-yellow-200 shadow-sm relative z-10">
                  <i className="fa-solid fa-medal text-3xl text-yellow-500"></i>
                </div>
                <h4 className="text-2xl font-bold text-slate-900 mb-2 relative z-10">Gold Luxury</h4>
                <p className="text-slate-500 text-[15px] mb-8 relative z-10">Tận hưởng dịch vụ đẳng cấp thượng lưu.</p>
                <ul className="space-y-4 mb-10 relative z-10">
                  <li className="flex items-start text-slate-700 font-medium"><i className="fa-solid fa-check text-yellow-500 mr-3 mt-1 text-lg"></i>Giảm 15% tất cả hóa đơn dịch vụ</li>
                  <li className="flex items-start text-slate-700 font-medium"><i className="fa-solid fa-check text-yellow-500 mr-3 mt-1 text-lg"></i>Miễn phí gói Spa Relax 60 phút</li>
                  <li className="flex items-start text-slate-700 font-medium"><i className="fa-solid fa-check text-yellow-500 mr-3 mt-1 text-lg"></i>Đón tiễn sân bay bằng xe riêng</li>
                </ul>
                <button onClick={() => handleClaimOffer("gold")} className="w-full bg-yellow-50 text-yellow-700 py-3.5 rounded-xl font-bold hover:bg-yellow-500 hover:text-white transition-all shadow-sm relative z-10 border border-yellow-200">Kích hoạt ưu đãi</button>
              </div>
            </div>
          </div>

          {/* Mã Giảm Giá & Voucher */}
          <div className="mb-20">
            <h3 className="text-3xl md:text-4xl font-playfair font-bold text-slate-900 mb-10 flex items-center">
              <i className="fa-solid fa-ticket-simple text-blue-600 mr-4 text-3xl"></i>Mã Giảm Giá & Voucher
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {loading ? (
                <div className="col-span-3 text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-500 font-medium">Đang tìm kiếm mã giảm giá khả dụng...</p>
                </div>
              ) : promotions.length === 0 ? (
                <div className="col-span-3 text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fa-solid fa-tags text-3xl text-slate-300"></i>
                  </div>
                  <p className="text-slate-500 font-medium">Hiện chưa có chương trình khuyến mãi nào</p>
                </div>
              ) : (
                promotions.map((p, i) => {
                  const daysLeft = Math.ceil((new Date(p.endDate) - new Date()) / (1000 * 60 * 60 * 24));
                  const discountType = p.type === "percent" ? "% Giảm giá" : "₫ Giảm tiền";
                  const discountValue = p.type === "percent" ? `${p.value}%` : `${p.value / 1000}K`;
                  const conditionText = p.condition === "all" ? "Áp dụng mọi đơn" : p.condition === "min_amount" ? `Đơn từ ${formatCurrency(p.minAmount)}` : "Chỉ lần đầu";
                  const daysColor = daysLeft <= 3 ? "text-red-500 font-bold" : "text-slate-500";
                  const daysIconColor = daysLeft <= 3 ? "text-red-500" : "text-blue-500";

                  return (
                    <div key={p.id} className="bg-white rounded-[2rem] shadow-sm border border-slate-100 flex flex-col group hover:shadow-xl hover:-translate-y-1 transition-all duration-300" style={{ animationDelay: `${i * 0.1}s` }}>
                      {/* Đầu Voucher */}
                      <div className="h-32 bg-gradient-to-r from-blue-600 to-blue-800 rounded-t-[2rem] p-6 relative overflow-hidden flex items-center justify-between">
                        <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiNmZmZmZmYiLz48L3N2Zz4=')]"></div>
                        <div className="relative z-10">
                          <span className="bg-white/20 backdrop-blur-md text-white px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border border-white/30">{discountType}</span>
                          <h4 className="text-2xl font-bold text-white mt-2 font-mono tracking-widest drop-shadow-md">{p.code}</h4>
                        </div>
                        <div className="relative z-10 w-16 h-16 bg-white text-blue-700 rounded-2xl flex items-center justify-center transform -rotate-12 shadow-lg border-2 border-blue-100">
                          <span className="font-bold text-xl">{discountValue}</span>
                        </div>
                      </div>

                      {/* Nếp gấp đứt đoạn (Ticket Cutout) - Sử dụng class thay thế của Tailwind */}
                      <div className="relative h-6 w-full flex items-center before:absolute before:w-6 before:h-6 before:bg-[#f8fafc] before:rounded-full before:-left-3 before:top-1/2 before:-translate-y-1/2 before:shadow-[inset_-3px_0_5px_rgba(0,0,0,0.05)] after:absolute after:w-6 after:h-6 after:bg-[#f8fafc] after:rounded-full after:-right-3 after:top-1/2 after:-translate-y-1/2 after:shadow-[inset_3px_0_5px_rgba(0,0,0,0.05)]">
                        <div className="w-full h-[2px] border-t-2 border-dashed border-slate-200"></div>
                      </div>

                      {/* Nội dung Voucher */}
                      <div className="p-6 pt-2 flex flex-col flex-grow">
                        <h5 className="text-xl font-bold text-slate-900 mb-2 leading-tight">{p.name}</h5>
                        <p className="text-slate-500 text-[14px] mb-6 flex-grow line-clamp-2">{p.description || "Ưu đãi dành riêng cho đặt phòng trực tiếp tại hệ thống Luna Hotel."}</p>
                        
                        <div className="space-y-3 mb-6 bg-slate-50 rounded-xl p-4 border border-slate-100">
                          <div className="flex items-center text-[13px] font-medium">
                            <i className="fa-regular fa-calendar-check text-blue-500 w-6 text-center"></i>
                            <span className="text-slate-600">HSD: {formatDate(p.endDate)}</span>
                          </div>
                          <div className="flex items-center text-[13px] font-medium">
                            <i className="fa-solid fa-circle-exclamation text-blue-500 w-6 text-center"></i>
                            <span className="text-slate-600">{conditionText}</span>
                          </div>
                          <div className="flex items-center text-[13px] font-medium">
                            <i className={`fa-regular fa-clock ${daysIconColor} w-6 text-center`}></i>
                            <span className={daysColor}>{daysLeft > 0 ? `Còn lại ${daysLeft} ngày` : 'Sắp hết hạn'}</span>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button onClick={() => copyPromoCode(p.code)} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-blue-600 shadow-md transition-all text-sm flex items-center justify-center">
                            <i className="fa-regular fa-copy mr-2"></i>Copy Mã
                          </button>
                          <button onClick={() => viewPromoDetails(p)} className="w-12 h-12 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 hover:text-blue-600 flex items-center justify-center transition-all" title="Xem chi tiết">
                            <i className="fa-solid fa-circle-info"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Phần Quà Bất Ngờ */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-[3rem] p-8 md:p-14 text-white relative overflow-hidden shadow-2xl mb-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full -mr-48 -mt-48 blur-3xl mix-blend-screen"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full -ml-48 -mb-48 blur-3xl mix-blend-screen"></div>

            <div className="relative z-10">
              <span className="bg-white/10 backdrop-blur-md text-white border border-white/20 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6 inline-block">🎯 Gợi Ý Riêng Cho Bạn</span>
              <h3 className="text-4xl md:text-5xl font-playfair font-bold mb-4 leading-tight">Phần Quà Bất Ngờ</h3>
              <p className="text-lg text-blue-100 mb-10 max-w-2xl font-light">Dựa trên lịch sử lưu trú, Luna Hotel đã chuẩn bị những đặc quyền bất ngờ gửi đến bạn. Đừng bỏ lỡ!</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20 hover:bg-white/15 transition-all group">
                  <div className="flex items-center mb-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-amber-300 to-amber-500 rounded-2xl flex items-center justify-center mr-4 shadow-lg group-hover:scale-110 transition-transform">
                      <i className="fa-solid fa-cake-candles text-white text-2xl"></i>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold">Tháng sinh nhật</h4>
                      <p className="text-sm text-blue-100">Giảm 30% hóa đơn nhà hàng</p>
                    </div>
                  </div>
                  <button onClick={() => handleClaimOffer("birthday")} className="w-full bg-white text-slate-900 py-3.5 rounded-xl font-bold shadow-md hover:bg-amber-400 hover:text-white transition-all">Nhận quà ngay</button>
                </div>

                <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20 hover:bg-white/15 transition-all group">
                  <div className="flex items-center mb-5">
                    <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center mr-4 shadow-lg group-hover:scale-110 transition-transform">
                      <i className="fa-solid fa-arrow-trend-up text-white text-2xl"></i>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold">Sắp lên hạng Platinum</h4>
                      <p className="text-sm text-blue-100">Chỉ còn 500 điểm nữa</p>
                    </div>
                  </div>
                  <div className="w-full bg-black/20 rounded-full h-2.5 mb-5 shadow-inner">
                    <div className="bg-emerald-400 h-2.5 rounded-full relative" style={{ width: '85%' }}>
                      <div className="absolute right-0 top-0 bottom-0 w-3 bg-white/50 blur-[1px]"></div>
                    </div>
                  </div>
                  <button onClick={() => router.push('/loyalty')} className="w-full bg-white/10 border border-white/30 hover:bg-white/20 text-white py-3.5 rounded-xl font-bold transition-all">Xem chi tiết hạng</button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
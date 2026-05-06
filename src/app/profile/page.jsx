// src/app/profile/page.jsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";

// Hàm tiện ích format tiền
const formatCurrency = (amount) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

// HÀM ĐÃ ĐƯỢC FIX LỖI "INVALID DATE"
const formatDate = (dateData) => {
  if (!dateData) return "Chưa cập nhật";
  try {
    const date = dateData?.toDate ? dateData.toDate() : new Date(dateData);
    if (isNaN(date.getTime())) return "Chưa rõ";
    return date.toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (error) {
    return "Chưa rõ";
  }
};

// Cấu hình thẻ thành viên VIP
const getMemberTier = (points) => {
  if (points >= 10000) return { tier: "Platinum", next: "Max", progress: 100, icon: "fa-gem", color: "from-slate-800 via-slate-700 to-slate-900", text: "text-slate-100", bgCard: "from-slate-900 via-slate-700 to-black", glow: "shadow-slate-500/50" };
  if (points >= 5000) return { tier: "Gold", next: "Platinum", progress: ((points - 5000) / 50), icon: "fa-crown", color: "from-yellow-500 via-amber-400 to-yellow-600", text: "text-yellow-50", bgCard: "from-amber-600 via-yellow-500 to-orange-600", glow: "shadow-amber-500/50" };
  if (points >= 1000) return { tier: "Silver", next: "Gold", progress: ((points - 1000) / 40), icon: "fa-star", color: "from-slate-300 via-slate-200 to-slate-400", text: "text-slate-800", bgCard: "from-slate-400 via-slate-300 to-slate-500", glow: "shadow-slate-400/50" };
  return { tier: "Bronze", next: "Silver", progress: points / 10, icon: "fa-medal", color: "from-orange-700 via-amber-600 to-orange-800", text: "text-orange-50", bgCard: "from-orange-800 via-amber-700 to-red-900", glow: "shadow-orange-500/50" };
};

export default function UltimateProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("profile");

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatar, setAvatar] = useState(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false); // State quản lý loading ảnh đại diện
  const [bookings, setBookings] = useState([]);
  const [promotions, setPromotions] = useState([]);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", new: "" });
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", birthday: "", address: "", preferences: "", createdAt: new Date().toISOString()
  });

  // 1. Fetch Dữ liệu
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setFormData({
            name: data.name || "", email: currentUser.email || "", phone: data.phone || "",
            birthday: data.birthday || "", address: data.address || "", preferences: data.preferences || "",
            createdAt: data.createdAt || new Date().toISOString()
          });
          // Lấy avatar từ Firestore thay vì localStorage
          if (data.avatar) setAvatar(data.avatar);
        } else {
          setFormData(prev => ({ ...prev, email: currentUser.email, name: currentUser.email.split("@")[0] }));
        }

        const qBookings = query(collection(db, "bookings"), where("userEmail", "==", currentUser.email));
        const snapBookings = await getDocs(qBookings);
        setBookings(snapBookings.docs.map(d => ({ id: d.id, ...d.data() })));

        const snapPromos = await getDocs(collection(db, "promotions"));
        setPromotions(snapPromos.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.active));

      } catch (error) {
        console.error("Lỗi tải dữ liệu:", error);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Tính toán Thống kê
  const stats = useMemo(() => {
    const paidBookings = bookings.filter(b => b.paymentStatus === "paid").sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const totalSpent = paidBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const points = Math.floor(totalSpent / 100000);
    const tierInfo = getMemberTier(points);
    return { paidBookings, totalSpent, points, tierInfo, totalBookings: bookings.length };
  }, [bookings]);

  // 3. Xử lý Cập nhật Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        name: formData.name,
        phone: formData.phone,
        birthday: formData.birthday,
        address: formData.address,
        preferences: formData.preferences,
        avatar: avatar, // Lưu URL ImgBB lên Firestore
        updatedAt: new Date().toISOString()
      });

      const currentLocal = JSON.parse(localStorage.getItem("currentUser") || "{}");
      localStorage.setItem("currentUser", JSON.stringify({ ...currentLocal, name: formData.name, phone: formData.phone }));

      if (passwords.new) {
        if (passwords.new.length < 6) return alert("Mật khẩu mới phải có ít nhất 6 ký tự");
        if (!passwords.current) return alert("Vui lòng nhập mật khẩu hiện tại");
        const credential = EmailAuthProvider.credential(user.email, passwords.current);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, passwords.new);
        alert("Đã đổi mật khẩu thành công!");
        setPasswords({ current: "", new: "" });
      } else {
        alert("Đã cập nhật hồ sơ cá nhân thành công!");
      }
    } catch (error) {
      alert("Lỗi: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Hàm xử lý UPLOAD ẢNH LÊN IMGBB
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return alert("Ảnh quá lớn. Vui lòng chọn ảnh < 2MB");

    setIsUploadingAvatar(true);
    try {
      // Chuẩn bị form data như API yêu cầu
      const imgData = new FormData();
      imgData.append("image", file);

      // THAY KEY CỦA BẠN VÀO ĐÂY (hoặc dùng process.env)
      const IMGBB_API_KEY = process.env.NEXT_PUBLIC_IMGBB_API_KEY || "ec72a78154d0c398eb6dad6b06947246";

      // Khuyến nghị dùng URL POST theo docs
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: "POST",
        body: imgData,
      });

      const data = await response.json();

      if (data.success) {
        const imageUrl = data.data.url; // Lấy URL từ cục phản hồi JSON của ImgBB
        setAvatar(imageUrl);
        // Lưu ý cho user biết cần ấn nút Lưu
        // Không gọi alert để tránh phiền người dùng, họ nhìn thấy ảnh đổi là hiểu, 
        // nhưng URL chưa vào DB cho đến khi bấm "Đồng bộ dữ liệu"
      } else {
        alert("Lỗi từ ImgBB: " + data.status);
      }
    } catch (error) {
      console.error("Lỗi khi upload lên ImgBB:", error);
      alert("Lỗi mạng! Không thể tải ảnh lên.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleClaimOffer = (type) => alert(`Tuyệt vời! Ưu đãi ${type.toUpperCase()} đã được kích hoạt.`);
  const copyPromoCode = (code) => { navigator.clipboard.writeText(code); alert(`Đã sao chép mã: ${code}`); };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0f172a] z-[9999] flex items-center justify-center flex-col">
        <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
          <div className="absolute inset-0 border-4 border-blue-900/30 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <i className="fa-solid fa-crown text-4xl text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]"></i>
        </div>
        <h2 className="text-3xl font-playfair font-bold text-white tracking-widest uppercase mb-3">Luna Premium</h2>
        <p className="text-blue-200 font-medium tracking-wide text-sm animate-pulse">Đang đồng bộ không gian đặc quyền...</p>
      </div>
    );
  }

  const displayName = formData.name || formData.email.split("@")[0] || "Khách hàng VIP";
  const shortUid = user?.uid?.slice(0, 4).toUpperCase() || "0000";
  const inputClass = "w-full pl-12 pr-4 py-4 bg-slate-50/80 border border-slate-200/60 rounded-[1.25rem] focus:bg-white focus:border-blue-500 focus:ring-[4px] focus:ring-blue-500/10 outline-none transition-all duration-300 text-[15px] text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 font-medium shadow-sm hover:shadow-md";

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-800 font-sans selection:bg-blue-200 overflow-x-hidden relative">
      <Header />

      {/* Khai báo hiệu ứng CSS Premium */}
      <style dangerouslySetInnerHTML={{
        __html: `
                @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } }
                @keyframes shine { 0% { left: -100%; } 20% { left: 100%; } 100% { left: 100%; } }
                @keyframes blob { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } 100% { transform: translate(0px, 0px) scale(1); } }
                .shimmer-card { position: relative; overflow: hidden; }
                .shimmer-card::before { content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%; background: linear-gradient(to right, transparent, rgba(255,255,255,0.3), transparent); transform: skewX(-20deg); animation: shine 4s infinite; z-index: 10; pointer-events: none; }
                .bento-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1); border-color: rgba(59,130,246,0.3); }
                .glass-pill { background: rgba(255,255,255,0.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.5); }
                .animate-blob { animation: blob 10s infinite; }
                .animation-delay-2000 { animation-delay: 2s; }
                .animation-delay-4000 { animation-delay: 4s; }
            `}} />

      <main className="pb-24 relative">

        {/* HERO BACKGROUND - MESH GRADIENT */}
        <div className="absolute top-0 left-0 right-0 h-[500px] w-full z-0 overflow-hidden bg-slate-900">
          <img src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=2500&auto=format&fit=crop" className="w-full h-full object-cover opacity-40 mix-blend-overlay" alt="Cover" />
          <div className="absolute top-0 -left-20 w-96 h-96 bg-blue-500 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-blob"></div>
          <div className="absolute top-20 -right-20 w-96 h-96 bg-purple-500 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-20 left-1/2 w-96 h-96 bg-emerald-500 rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-blob animation-delay-4000"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/60 to-[#f1f5f9]"></div>
        </div>

        <div className="max-w-[1400px] mx-auto px-4 md:px-8 relative z-10 pt-20">

          {/* KHỐI PROFILE HEADER ĐỈNH CAO */}
          <div className="flex flex-col xl:flex-row items-center justify-between gap-10 mb-16 animate-in slide-in-from-bottom-8 duration-700">
            {/* Cột trái: Avatar & Name */}
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 text-center md:text-left">
              <div className="relative group shrin  k-0" style={{ animation: 'float 6s ease-in-out infinite' }}>
                <div className={`absolute -inset-1 rounded-full bg-gradient-to-br ${stats.tierInfo.color} blur opacity-50 group-hover:opacity-100 transition duration-500`}></div>

                <div className={`relative w-40 h-40 rounded-full p-1.5 bg-gradient-to-br ${stats.tierInfo.color} shadow-2xl overflow-hidden`}>
                  <div className="w-full h-full rounded-full border-4 border-slate-900 overflow-hidden bg-slate-800 flex items-center justify-center relative z-10">

                    {/* Hiệu ứng Đang tải ảnh lên (Spinner mờ) */}
                    {isUploadingAvatar && (
                      <div className="absolute inset-0 bg-black/60 z-30 flex flex-col items-center justify-center rounded-full backdrop-blur-[2px]">
                        <i className="fa-solid fa-spinner fa-spin text-white text-3xl mb-1"></i>
                      </div>
                    )}

                    {avatar ?
                      <img src={avatar} className="w-full h-full object-cover" alt="Avatar" /> :
                      <span className="text-6xl font-black text-white">{displayName.charAt(0).toUpperCase()}</span>
                    }
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                      <i className="fa-solid fa-camera text-white text-3xl"></i>
                    </div>
                  </div>
                </div>

                {/* Input chọn ảnh - Khoá khi đang tải ảnh */}
                <input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-40"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  title="Đổi ảnh đại diện"
                  disabled={isUploadingAvatar}
                />

                {/* Badge Hạng nổi bật */}
                <div className={`absolute -bottom-2 -right-2 w-14 h-14 rounded-full bg-gradient-to-br ${stats.tierInfo.color} border-[3px] border-slate-900 flex items-center justify-center text-white shadow-xl z-50 transform group-hover:scale-110 transition-transform`}>
                  <i className={`fa-solid ${stats.tierInfo.icon} text-xl drop-shadow-md`}></i>
                </div>
              </div>

              <div className="pt-4">
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/80 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm backdrop-blur-md mb-3 inline-block">
                  Member ID: LUNA-{shortUid}
                </span>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-playfair font-black text-white mb-4 tracking-wide drop-shadow-xl">{displayName}</h2>
                <p className="text-blue-100 font-medium flex items-center justify-center md:justify-start gap-2 text-sm md:text-base opacity-90">
                  <i className="fa-regular fa-calendar-check text-emerald-400"></i>
                  Tham gia hệ thống từ <span className="font-bold text-white ml-1">{formatDate(formData.createdAt)}</span>
                </p>
              </div>
            </div>

            {/* Cột phải: Thông số VIP */}
            <div className="flex gap-4 shrink-0 w-full xl:w-auto">
              <div className="flex-1 xl:flex-none glass-pill rounded-[2rem] p-6 min-w-[160px] text-center shadow-xl hover:bg-white transition-colors duration-300 group">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Quỹ Điểm Luna</p>
                <p className="text-4xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-br from-amber-400 to-orange-600 group-hover:scale-105 transition-transform">{stats.points.toLocaleString()}</p>
              </div>
              <div className="flex-1 xl:flex-none glass-pill rounded-[2rem] p-6 min-w-[160px] text-center shadow-xl hover:bg-white transition-colors duration-300 group">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Kỳ nghỉ đã lưu</p>
                <p className="text-4xl font-black font-mono text-slate-800 group-hover:scale-105 transition-transform">{stats.totalBookings} <span className="text-sm text-slate-400">Đêm</span></p>
              </div>
            </div>
          </div>

          {/* MENU FLOATING TABS */}
          <div className="flex justify-center mb-12 sticky top-24 z-40">
            <div className="glass-pill p-1.5 rounded-full flex flex-nowrap overflow-x-auto hide-scrollbar shadow-xl shadow-slate-200/50 w-full sm:w-auto">
              {[
                { id: "profile", icon: "fa-user-astronaut", label: "Hồ Sơ Định Danh" },
                { id: "loyalty", icon: "fa-ranking-star", label: "Đặc Quyền Hội Viên" },
                { id: "offers", icon: "fa-ticket-simple", label: "Kho Báu Voucher" }
              ].map((tab) => (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`flex-1 sm:flex-none min-w-[160px] py-3.5 px-6 rounded-full font-bold text-[13px] uppercase tracking-wide transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap 
                                    ${activeTab === tab.id ? "bg-blue-600 text-white shadow-[0_4px_15px_rgba(37,99,235,0.4)] transform scale-100" : "text-slate-600 hover:text-blue-600 hover:bg-blue-50/50 scale-95"}`}>
                  <i className={`fa-solid ${tab.icon} ${activeTab === tab.id ? "text-blue-200" : "text-slate-400"} text-base`}></i> {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* --- TAB 1: TÀI KHOẢN (BENTO GRID STYLE) --- */}
          {activeTab === "profile" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">

              <div className="lg:col-span-4 space-y-6 flex flex-col">
                <div onClick={() => setIsPaymentModalOpen(true)} className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer border border-slate-700 group shimmer-card overflow-hidden">
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md border border-white/20 group-hover:rotate-12 transition-transform">
                    <i className="fa-solid fa-file-invoice-dollar text-3xl text-emerald-400"></i>
                  </div>
                  <h3 className="text-2xl font-playfair font-bold mb-2">Lịch Sử Giao Dịch</h3>
                  <p className="text-slate-400 text-sm mb-6">Bạn có <strong className="text-white">{stats.paidBookings.length}</strong> hóa đơn điện tử đã thanh toán thành công.</p>
                  <div className="flex items-center text-emerald-400 text-sm font-bold uppercase tracking-wider group-hover:text-white transition-colors">
                    Xem chi tiết hóa đơn <i className="fa-solid fa-arrow-right ml-2 transform group-hover:translate-x-2 transition-transform"></i>
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200 bento-hover flex-1">
                  <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mb-5 text-rose-500">
                    <i className="fa-solid fa-shield-halved text-2xl"></i>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-6">Trung Tâm Bảo Mật</h3>
                  <div className="space-y-5">
                    <div>
                      <input type="password" placeholder="Nhập mật khẩu hiện tại" className={inputClass} value={passwords.current} onChange={e => setPasswords({ ...passwords, current: e.target.value })} />
                    </div>
                    <div>
                      <input type="password" placeholder="Thiết lập mật khẩu mới (Tối thiểu 6 ký tự)" className={inputClass} value={passwords.new} onChange={e => setPasswords({ ...passwords, new: e.target.value })} />
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium text-center italic mt-2">Mật khẩu mới sẽ được cập nhật cùng lúc khi bạn lưu hồ sơ ở bảng bên cạnh.</p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8 bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-slate-200 relative overflow-hidden bento-hover">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 rounded-full blur-3xl -mr-48 -mt-48 opacity-70 pointer-events-none"></div>
                <h3 className="text-3xl font-playfair font-bold text-slate-900 mb-2 relative z-10">Cập Nhật Định Danh</h3>
                <p className="text-slate-500 text-[15px] mb-10 relative z-10">Vui lòng cung cấp thông tin chính xác để Luna Hotel hỗ trợ bạn tốt nhất trong các kỳ nghỉ.</p>

                <form onSubmit={handleSaveProfile} className="space-y-7 relative z-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
                    <div className="group">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5 block ml-2 group-focus-within:text-blue-600 transition-colors">Họ và tên</label>
                      <div className="relative">
                        <i className="fa-regular fa-user absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors"></i>
                        <input type="text" className={inputClass} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Nguyễn Văn A" />
                      </div>
                    </div>
                    <div className="group">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5 block ml-2">Email (Đã xác thực)</label>
                      <div className="relative">
                        <i className="fa-regular fa-envelope absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input type="email" disabled className={inputClass} value={formData.email} />
                      </div>
                    </div>
                    <div className="group">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5 block ml-2 group-focus-within:text-blue-600 transition-colors">Số điện thoại liên lạc</label>
                      <div className="relative">
                        <i className="fa-solid fa-mobile-screen-button absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors"></i>
                        <input type="tel" className={inputClass} value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="09xx xxx xxx" />
                      </div>
                    </div>
                    <div className="group">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5 block ml-2 group-focus-within:text-blue-600 transition-colors">Ngày tháng năm sinh</label>
                      <div className="relative">
                        <i className="fa-regular fa-calendar absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors"></i>
                        <input type="date" className={inputClass} value={formData.birthday} onChange={e => setFormData({ ...formData, birthday: e.target.value })} />
                      </div>
                    </div>
                  </div>
                  <div className="group">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5 block ml-2 group-focus-within:text-blue-600 transition-colors">Địa chỉ thường trú</label>
                    <div className="relative">
                      <i className="fa-solid fa-map-location-dot absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors"></i>
                      <input type="text" className={inputClass} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Số nhà, Tên đường, Quận/Huyện, Tỉnh/TP..." />
                    </div>
                  </div>
                  <div className="group">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5 block ml-2 group-focus-within:text-blue-600 transition-colors">Ghi chú & Sở thích lưu trú</label>
                    <textarea rows="4" className="w-full p-5 bg-slate-50/80 border border-slate-200/60 rounded-[1.25rem] focus:bg-white focus:border-blue-500 focus:ring-[4px] focus:ring-blue-500/10 outline-none transition-all duration-300 text-[15px] leading-relaxed text-slate-800 shadow-sm hover:shadow-md" placeholder="Ví dụ: Tôi bị dị ứng lông vũ, vui lòng sử dụng gối cao su non..." value={formData.preferences} onChange={e => setFormData({ ...formData, preferences: e.target.value })}></textarea>
                  </div>

                  <div className="pt-6 flex justify-end border-t border-slate-100">
                    <button type="submit" disabled={isSaving || isUploadingAvatar} className="w-full lg:w-auto px-12 py-4 bg-slate-900 text-white rounded-[1.25rem] font-bold text-[15px] hover:bg-blue-600 shadow-xl shadow-slate-900/20 hover:shadow-blue-600/40 hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:transform-none flex items-center justify-center">
                      {isSaving ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i>ĐANG LƯU HỒ SƠ...</> : <><i className="fa-solid fa-cloud-arrow-up mr-2"></i>ĐỒNG BỘ DỮ LIỆU</>}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* CÁC TAB KHÁC BÊN DƯỚI GIỮ NGUYÊN HOÀN TOÀN NHƯ CŨ */}
          {/* --- TAB 2: THẺ THÀNH VIÊN --- */}
          {activeTab === "loyalty" && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 max-w-5xl mx-auto">
              <div className="relative w-full max-w-[650px] mx-auto mb-20 [perspective:2500px] group cursor-pointer z-20">
                <div className="relative transition-transform duration-[1000ms] ease-[cubic-bezier(0.175,0.885,0.32,1.275)] [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] min-h-[400px] md:min-h-[450px]">
                  {/* MẶT TRƯỚC */}
                  <div className={`absolute inset-0 [backface-visibility:hidden] rounded-[3rem] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] border border-white/20 shimmer-card bg-gradient-to-br ${stats.tierInfo.bgCard}`}>
                    <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
                    <div className={`absolute -right-20 -top-20 w-80 h-80 ${stats.tierInfo.glow} rounded-full blur-3xl mix-blend-screen opacity-50`}></div>
                    <div className="relative h-full p-10 md:p-14 flex flex-col justify-between text-white z-10 font-sans">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] md:text-xs uppercase tracking-[0.4em] opacity-90 mb-2 font-bold text-white drop-shadow-md">Luna Hotel & Resort</p>
                          <h3 className="text-3xl md:text-5xl font-playfair font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/60 drop-shadow-sm">Member</h3>
                        </div>
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/40 shadow-inner">
                          <i className={`fa-solid ${stats.tierInfo.icon} text-3xl md:text-4xl ${stats.tierInfo.text} drop-shadow-lg`}></i>
                        </div>
                      </div>
                      <div className="mt-auto mb-8">
                        <p className="text-[10px] uppercase tracking-[0.3em] opacity-80 font-bold mb-1">Cấp bậc tinh hoa</p>
                        <p className={`text-5xl md:text-6xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-br ${stats.tierInfo.color} drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]`}>{stats.tierInfo.tier}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-6 pt-6 border-t border-white/20">
                        <div>
                          <p className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] opacity-80 mb-1.5 font-bold">Mã thẻ định danh</p>
                          <p className="text-xl md:text-2xl font-mono tracking-[0.25em] drop-shadow-md font-medium text-white/90">LUNA {shortUid} 8888</p>
                        </div>
                        <div className="sm:text-right">
                          <p className="font-black text-lg md:text-xl uppercase tracking-[0.15em] drop-shadow-md truncate max-w-[250px]">{displayName}</p>
                          <p className="text-[10px] opacity-70 font-mono tracking-widest mt-1 uppercase font-bold">Valid: Lifetime</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MẶT SAU */}
                  <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-gradient-to-bl from-slate-900 via-slate-950 to-black rounded-[3rem] p-10 md:p-14 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] border border-slate-700 text-white flex flex-col justify-between">
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800">
                        <h4 className="text-2xl font-playfair font-bold text-slate-200 tracking-wide">Quyền lợi Sở hữu</h4>
                        <i className="fa-solid fa-fingerprint text-4xl text-slate-600"></i>
                      </div>
                      <ul className="space-y-5 text-slate-300 text-[15px] font-medium leading-relaxed">
                        <li className="flex items-start"><div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center mr-4 mt-0.5 shrink-0"><i className="fa-solid fa-check text-emerald-400 text-xs"></i></div>Thẻ kỹ thuật số bảo mật cao, không thể chuyển nhượng.</li>
                        <li className="flex items-start"><div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center mr-4 mt-0.5 shrink-0"><i className="fa-solid fa-check text-emerald-400 text-xs"></i></div>Điểm thưởng (Luna Coin) được quy đổi tự động từ hóa đơn.</li>
                        <li className="flex items-start"><div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center mr-4 mt-0.5 shrink-0"><i className="fa-solid fa-check text-emerald-400 text-xs"></i></div>Xuất trình QR/Mã thẻ này để ưu tiên Check-in VIP.</li>
                      </ul>
                    </div>
                    <div className="w-full h-16 bg-slate-100 rounded flex items-center justify-center opacity-90 px-4">
                      <div className="w-full h-10 border-x-4 border-slate-800 border-l-[8px] border-r-[12px] opacity-70 flex justify-around">
                        {[...Array(20)].map((_, i) => <div key={i} className={`h-full bg-slate-800 ${i % 2 == 0 ? 'w-1' : (i % 3 == 0 ? 'w-2' : 'w-0.5')}`}></div>)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-center mt-8">
                  <span className="bg-slate-200/50 backdrop-blur-md text-slate-700 px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.2em] animate-pulse inline-flex items-center gap-2 border border-slate-300 shadow-sm">
                    <i className="fa-solid fa-rotate"></i> Lật thẻ để quét mã
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-slate-200 mb-16 relative overflow-hidden bento-hover">
                <div className="flex justify-between items-end mb-6 relative z-10">
                  <div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Hành trình thăng hạng</p>
                    <p className="text-3xl font-playfair font-black text-slate-900 flex items-center">
                      {stats.tierInfo.tier} <span className="mx-4 text-slate-300 font-sans font-light">⟶</span> <span className="text-slate-400">{stats.tierInfo.next}</span>
                    </p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Điểm tích lũy</p>
                    <p className="text-3xl font-mono font-black text-amber-500">{stats.points.toLocaleString()}</p>
                  </div>
                </div>
                <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] relative z-10 border border-slate-200">
                  <div className={`h-full bg-gradient-to-r ${stats.tierInfo.color} rounded-full transition-all duration-[1500ms] ease-out relative`} style={{ width: `${Math.min(stats.tierInfo.progress, 100)}%` }}>
                    <div className="absolute top-0 bottom-0 left-0 right-0 overflow-hidden rounded-full">
                      <div className="w-[50px] h-full bg-white/40 blur-[4px] absolute top-0 -left-[50px]" style={{ animation: 'shine 3s infinite' }}></div>
                    </div>
                  </div>
                </div>
                <p className="text-center text-xs font-bold text-slate-400 mt-6 sm:hidden">Cần thêm {(5000 - stats.points > 0 ? 5000 - stats.points : 0).toLocaleString()} điểm để lên hạng.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { id: 'bronze', tier: 'Bronze', icon: 'fa-medal', color: 'from-orange-600 to-orange-800', discount: '5%' },
                  { id: 'silver', tier: 'Silver', icon: 'fa-star', color: 'from-slate-400 to-slate-600', discount: '10%' },
                  { id: 'gold', tier: 'Gold', icon: 'fa-crown', color: 'from-amber-400 to-amber-600', discount: '15%' },
                  { id: 'platinum', tier: 'Platinum', icon: 'fa-gem', color: 'from-slate-700 to-slate-900', discount: '20%' }
                ].map((item) => (
                  <div key={item.id} className={`bg-white rounded-[2rem] p-8 border-2 transition-all duration-500 flex flex-col items-center text-center group hover:-translate-y-2 hover:shadow-xl ${stats.tierInfo.tier === item.tier ? `border-${item.id === 'gold' ? 'amber-500' : 'slate-800'} shadow-[0_10px_30px_rgba(0,0,0,0.08)] scale-105 z-10` : 'border-slate-100 shadow-sm'}`}>
                    <div className={`w-20 h-20 rounded-[1.25rem] bg-gradient-to-br ${item.color} text-white flex items-center justify-center mb-6 shadow-lg group-hover:rotate-12 transition-transform`}>
                      <i className={`fa-solid ${item.icon} text-4xl drop-shadow-md`}></i>
                    </div>
                    <h4 className="font-bold text-2xl text-slate-900 mb-2">{item.tier}</h4>
                    <p className="text-4xl font-black text-blue-600 my-2 font-mono">{item.discount}</p>
                    <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Giảm giá đặt phòng</p>
                    {stats.tierInfo.tier === item.tier && <div className="mt-6 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full w-full">Hạng Của Bạn</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- TAB 3: MÃ ƯU ĐÃI --- */}
          {activeTab === "offers" && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 max-w-6xl mx-auto">
              <div className="bg-slate-900 rounded-[3rem] p-8 md:p-14 text-white relative overflow-hidden shadow-2xl mb-16 flex flex-col md:flex-row items-center justify-between gap-10 border border-slate-700 group cursor-pointer hover:shadow-blue-500/20 transition-all duration-500">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/30 rounded-full blur-[80px] -mr-48 -mt-48 mix-blend-screen group-hover:bg-blue-500/40 transition-colors"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-600/30 rounded-full blur-[80px] -ml-48 -mb-48 mix-blend-screen"></div>

                <div className="relative z-10 max-w-xl text-center md:text-left">
                  <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] mb-6 inline-flex items-center shadow-lg shadow-amber-500/30 border border-amber-300">
                    <i className="fa-solid fa-gift mr-2"></i> Đặc Quyền Riêng Biệt
                  </span>
                  <h3 className="text-4xl md:text-5xl font-playfair font-black mb-5 leading-tight tracking-wide drop-shadow-md">Voucher Sinh Nhật</h3>
                  <p className="text-slate-300 text-[15px] font-medium leading-relaxed">Kỷ niệm ngày sinh của bạn cùng Luna Hotel! Tặng ngay 1 set bánh trà chiều hoàng gia và giảm 30% khi dùng bữa tại nhà hàng 5 sao.</p>
                </div>
                <button onClick={() => handleClaimOffer("birthday")} className="w-full md:w-auto shrink-0 bg-white text-slate-900 px-12 py-5 rounded-[1.5rem] font-black text-[15px] hover:bg-blue-600 hover:text-white transition-all shadow-[0_10px_30px_rgba(255,255,255,0.1)] hover:scale-105 z-10">
                  NHẬN QUÀ NGAY
                </button>
              </div>

              <div className="flex items-center justify-between mb-8">
                <h3 className="text-3xl font-playfair font-bold text-slate-900 flex items-center">
                  <i className="fa-solid fa-ticket-simple text-blue-500 mr-4"></i>Kho Mã Giảm Giá
                </h3>
                <span className="bg-slate-100 text-slate-600 border border-slate-200 text-xs font-black px-4 py-1.5 rounded-xl uppercase tracking-widest">{promotions.length} Khả dụng</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {promotions.length === 0 ? (
                  <div className="col-span-2 text-center py-24 bg-white rounded-[3rem] border border-dashed border-slate-300 shadow-sm">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300"><i className="fa-solid fa-box-open text-4xl"></i></div>
                    <h4 className="text-2xl font-bold text-slate-800 mb-2">Trống trơn</h4>
                    <p className="text-slate-500 font-medium">Bạn đã thu thập hết mã giảm giá. Hãy quay lại sau nhé!</p>
                  </div>
                ) : (
                  promotions.map((p, i) => {
                    const discountType = p.type === "percent" ? "% OFF" : "VNĐ OFF";
                    const discountValue = p.type === "percent" ? `${p.value}%` : `${p.value / 1000}K`;

                    return (
                      <div key={p.id} className="bg-white rounded-[2rem] shadow-sm border border-slate-200 flex flex-col sm:flex-row overflow-hidden bento-hover" style={{ animationDelay: `${i * 100}ms` }}>
                        <div className="bg-slate-900 sm:w-2/5 p-8 flex flex-col justify-center items-center text-white relative overflow-hidden shrink-0">
                          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30 mix-blend-overlay"></div>
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-400 mb-3 relative z-10">{discountType}</span>
                          <div className="text-5xl md:text-6xl font-black font-mono tracking-tighter text-white drop-shadow-lg relative z-10">{discountValue}</div>
                        </div>

                        <div className="hidden sm:flex flex-col justify-between -ml-4 z-10 relative">
                          <div className="w-8 h-8 bg-[#f1f5f9] rounded-full -mt-4 shadow-[inset_-2px_-2px_4px_rgba(0,0,0,0.05)] border-b border-r border-slate-200"></div>
                          <div className="h-full border-l-2 border-dashed border-slate-300 my-2"></div>
                          <div className="w-8 h-8 bg-[#f1f5f9] rounded-full -mb-4 shadow-[inset_-2px_2px_4px_rgba(0,0,0,0.05)] border-t border-r border-slate-200"></div>
                        </div>

                        <div className="p-8 flex flex-col flex-1 bg-white relative z-0">
                          <h5 className="font-bold text-xl text-slate-900 mb-3">{p.name}</h5>
                          <p className="text-slate-500 text-[14px] mb-6 line-clamp-2 leading-relaxed">{p.description}</p>
                          <div className="bg-slate-50 border border-slate-100 rounded-[1rem] p-4 mb-6 flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Mã Ưu Đãi:</span>
                            <span className="text-blue-600 font-mono font-black text-xl tracking-widest">{p.code}</span>
                          </div>
                          <div className="mt-auto">
                            <button onClick={() => copyPromoCode(p.code)} className="w-full bg-slate-900 text-white py-4 rounded-[1rem] text-[13px] font-black uppercase tracking-widest hover:bg-blue-600 shadow-lg shadow-slate-900/20 hover:shadow-blue-600/30 transition-all flex items-center justify-center group/btn">
                              <i className="fa-regular fa-copy mr-2 group-hover/btn:scale-125 transition-transform"></i> COPY MÃ ĐỂ ĐẶT
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Modal Lịch sử Giao dịch */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 z-0" onClick={() => setIsPaymentModalOpen(false)}></div>
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative z-10 animate-in zoom-in duration-300 overflow-hidden border border-white">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-2xl font-playfair font-bold text-slate-900">Lịch sử giao dịch</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">Danh sách các khoản thanh toán đã hoàn tất</p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-500 hover:text-rose-500 hover:border-rose-200 transition-all"><i className="fa-solid fa-xmark text-lg"></i></button>
            </div>
            <div className="p-8 overflow-y-auto custom-scroll flex-1 bg-slate-50 space-y-4">
              {stats.paidBookings.length === 0 ? (
                <div className="text-center py-16">
                  <i className="fa-solid fa-file-invoice-dollar text-6xl text-slate-200 mb-4 block"></i>
                  <p className="text-slate-500 font-medium">Bạn chưa có lịch sử thanh toán nào.</p>
                </div>
              ) : (
                stats.paidBookings.map((b, i) => (
                  <div key={b.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-blue-200 hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-lg group-hover:scale-110 transition-transform"><i className="fa-solid fa-check-double"></i></div>
                      <div>
                        <p className="font-bold text-[15px] text-slate-800 mb-0.5">Thanh toán Phòng {b.roomCode}</p>
                        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                          <span>{formatDate(b.createdAt)}</span>
                          <span>•</span>
                          <span className="uppercase font-mono bg-slate-100 px-1.5 py-0.5 rounded">ID: {b.id.slice(-6)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-slate-900 font-mono mb-0.5">{formatCurrency(b.totalPrice)}</p>
                      <span className="text-[10px] font-black text-amber-500 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg uppercase tracking-wider">
                        +{Math.floor(b.totalPrice / 100000)} LUNA COIN
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
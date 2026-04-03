// src/app/profile/page.jsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";

// Hàm tiện ích
const formatCurrency = (amount) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString("vi-VN") : "";

const getMemberTier = (points) => {
  if (points >= 10000) return { tier: "Platinum", next: "Max", progress: 100, color: "from-slate-700 to-slate-900", icon: "fa-gem" };
  if (points >= 5000) return { tier: "Gold", next: "Platinum", progress: ((points - 5000) / 50), color: "from-yellow-400 to-yellow-600", icon: "fa-crown" };
  if (points >= 1000) return { tier: "Silver", next: "Gold", progress: ((points - 1000) / 40), color: "from-slate-300 to-slate-500", icon: "fa-star" };
  return { tier: "Bronze", next: "Silver", progress: points / 10, color: "from-amber-500 to-amber-700", icon: "fa-medal" }; // Sửa lại màu Bronze cho giống HTML
};

export default function ProfilePage() {
  const router = useRouter();
  
  // States
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatar, setAvatar] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    birthday: "",
    address: "",
    preferences: "",
    createdAt: new Date().toISOString()
  });

  // Password State
  const [passwords, setPasswords] = useState({
    current: "",
    new: ""
  });

  // 1. Kiểm tra đăng nhập và lấy dữ liệu
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      
      setUser(currentUser);
      
      try {
        // Lấy thông tin user
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setFormData({
            name: data.name || "",
            email: currentUser.email || "",
            phone: data.phone || "",
            birthday: data.birthday || "",
            address: data.address || "",
            preferences: data.preferences || "",
            createdAt: data.createdAt || new Date().toISOString()
          });
        } else {
          setFormData(prev => ({ ...prev, email: currentUser.email, name: currentUser.email.split("@")[0] }));
        }

        // Lấy ảnh đại diện từ localStorage
        const savedAvatar = localStorage.getItem("userAvatar");
        if (savedAvatar) setAvatar(savedAvatar);

        // Lấy lịch sử đặt phòng
        const q = query(collection(db, "bookings"), where("userEmail", "==", currentUser.email));
        const querySnapshot = await getDocs(q);
        setBookings(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      } catch (error) {
        console.error("Lỗi tải dữ liệu hồ sơ:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // 2. Tính toán các chỉ số thống kê
  const stats = useMemo(() => {
    const paidBookings = bookings.filter(b => b.paymentStatus === "paid");
    const totalSpent = paidBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const points = Math.floor(totalSpent / 100000);
    const tierInfo = getMemberTier(points);
    const recentActivities = [...bookings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
    
    return { paidBookings, totalSpent, points, tierInfo, recentActivities, totalBookings: bookings.length };
  }, [bookings]);

  // 3. Xử lý lưu hồ sơ và đổi mật khẩu
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Cập nhật thông tin cơ bản
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        name: formData.name,
        phone: formData.phone,
        birthday: formData.birthday,
        address: formData.address,
        preferences: formData.preferences,
        updatedAt: new Date().toISOString()
      });

      // Cập nhật localStorage cho Header
      const currentLocal = JSON.parse(localStorage.getItem("currentUser") || "{}");
      localStorage.setItem("currentUser", JSON.stringify({ ...currentLocal, name: formData.name, phone: formData.phone }));

      // Xử lý đổi mật khẩu
      if (passwords.new) {
        if (passwords.new.length < 6) {
          alert("Mật khẩu mới phải có ít nhất 6 ký tự");
          setIsSaving(false);
          return;
        }
        if (passwords.current) {
          const credential = EmailAuthProvider.credential(user.email, passwords.current);
          await reauthenticateWithCredential(user, credential);
          await updatePassword(user, passwords.new);
          alert("Đã đổi mật khẩu thành công!");
          setPasswords({ current: "", new: "" });
        } else {
          alert("Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu mới");
        }
      }

      alert("Đã cập nhật hồ sơ cá nhân!");
    } catch (error) {
      alert("Lỗi: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Xử lý đổi Avatar
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return alert("Ảnh quá lớn. Vui lòng chọn ảnh < 2MB");
      const reader = new FileReader();
      reader.onload = (event) => {
        const imgUrl = event.target.result;
        setAvatar(imgUrl);
        localStorage.setItem("userAvatar", imgUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center flex-col">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="fa-solid fa-user-check text-4xl text-blue-600"></i>
        </div>
        <h2 className="text-3xl font-playfair font-bold text-slate-900 mb-4">Luna Hotel</h2>
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Đang tải hồ sơ của bạn...</p>
      </div>
    );
  }

  const displayName = formData.name || formData.email.split("@")[0] || "Khách hàng";
  const avatarLetter = displayName.charAt(0).toUpperCase();

  // Class chung cho input
  const inputClass = "w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-all text-[15px] text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed";

  return (
    <div id="main-content" className="loaded min-h-screen bg-[#f8fafc] text-slate-800">
      <Header />

      <main className="min-h-[calc(100vh-80px)] pb-24">
        {/* Banner Cover */}
        <div className="relative h-72 md:h-80 lg:h-96 w-full">
          <img src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=2000&auto=format&fit=crop" className="w-full h-full object-cover" alt="Cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-24 md:-mt-32 relative z-10">
          
          {/* Thông tin Header của Profile */}
          <div className="flex flex-col md:flex-row items-center md:items-end justify-between mb-10 gap-6">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
              <div className="relative group">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2rem] bg-white p-2 shadow-2xl transition-transform duration-300 group-hover:scale-105">
                  <div className="w-full h-full rounded-[1.5rem] bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center border border-blue-200 overflow-hidden">
                    {avatar ? (
                      <img src={avatar} className="w-full h-full object-cover" alt="Avatar" />
                    ) : (
                      <span className="text-6xl font-bold text-blue-600">{avatarLetter}</span>
                    )}
                  </div>
                </div>
                <label className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-blue-600 border-4 border-white flex items-center justify-center text-white hover:bg-blue-700 transition-colors shadow-lg cursor-pointer">
                  <i className="fa-solid fa-camera"></i>
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                </label>
              </div>
              <div className="mb-2">
                <h2 className="text-3xl md:text-4xl font-playfair font-bold text-white mb-2">{displayName}</h2>
                <p className="text-blue-200 font-medium flex items-center justify-center md:justify-start">
                  <i className="fa-regular fa-calendar mr-2"></i>Thành viên từ <span className="ml-1">{formatDate(formData.createdAt)}</span>
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 text-white border border-white/20 text-center">
                <p className="text-[13px] uppercase tracking-wider opacity-80 mb-1">Tổng đặt phòng</p>
                <p className="text-3xl font-bold font-mono">{stats.totalBookings}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 text-white border border-white/20 text-center">
                <p className="text-[13px] uppercase tracking-wider opacity-80 mb-1">Điểm tích lũy</p>
                <p className="text-3xl font-bold font-mono text-amber-300">{stats.points.toLocaleString("vi-VN")}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cột trái: Thẻ thành viên & Thống kê */}
            <div className="lg:col-span-1 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Thẻ thành viên */}
              <div className={`bg-gradient-to-br ${stats.tierInfo.color} rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden group hover:shadow-2xl transition-all duration-300`}>
                <div className="absolute -right-10 -top-10 text-white/10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700">
                  <i className={`fa-solid ${stats.tierInfo.icon} text-9xl`}></i>
                </div>
                <div className="relative z-10 flex justify-between items-start mb-10">
                  <div>
                    <p className="text-xs uppercase tracking-widest opacity-80 mb-1 font-semibold">Hạng thành viên</p>
                    <h3 className="text-3xl font-playfair font-bold flex items-center">{stats.tierInfo.tier}</h3>
                  </div>
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/30">
                    <i className="fa-solid fa-medal text-2xl"></i>
                  </div>
                </div>
                <div className="relative z-10 space-y-6">
                  <div>
                    <p className="text-xs uppercase tracking-widest opacity-80 mb-1 font-semibold">Điểm hiện tại</p>
                    <p className="text-4xl font-mono font-bold tracking-tight">{stats.points.toLocaleString("vi-VN")}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest opacity-80 mb-1 font-semibold">Tổng chi tiêu</p>
                    <p className="text-2xl font-mono font-bold">{formatCurrency(stats.totalSpent)}</p>
                  </div>
                </div>
                <div className="relative z-10 mt-8 pt-6 border-t border-white/20">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-3">
                    <span className="opacity-100">{stats.tierInfo.tier}</span>
                    <span className="opacity-60">{stats.tierInfo.next}</span>
                  </div>
                  <div className="w-full h-2.5 bg-black/20 rounded-full overflow-hidden shadow-inner relative">
                    <div className="h-full bg-white rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${Math.min(stats.tierInfo.progress, 100)}%` }}>
                      <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/50 blur-[2px]"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Thống kê nhanh */}
              <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50">
                <h4 className="font-bold text-slate-900 mb-6 text-lg"><i className="fa-solid fa-chart-pie text-blue-600 mr-2"></i>Thống kê nhanh</h4>
                <div className="space-y-5">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-slate-600 font-medium">Điểm thưởng</span>
                    <span className="font-bold text-amber-600 text-lg">{stats.points.toLocaleString("vi-VN")}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-slate-600 font-medium">Đánh giá đã viết</span>
                    <span className="font-bold text-blue-600 text-lg">0</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-slate-600 font-medium">Ưu đãi đã dùng</span>
                    <span className="font-bold text-green-600 text-lg">0</span>
                  </div>
                </div>
              </div>

              {/* Hoạt động gần đây */}
              <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50">
                <h4 className="font-bold text-slate-900 mb-6 text-lg"><i className="fa-solid fa-clock-rotate-left text-blue-600 mr-2"></i>Hoạt động gần đây</h4>
                <div className="space-y-4">
                  {stats.recentActivities.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4 bg-slate-50 rounded-xl">Chưa có hoạt động nào</p>
                  ) : (
                    stats.recentActivities.map(b => {
                      const statusConfig = {
                        'completed': { label: 'Hoàn tất', color: 'bg-green-100 text-green-700' },
                        'cancelled': { label: 'Đã hủy', color: 'bg-red-100 text-red-700' },
                        'pending': { label: 'Sắp tới', color: 'bg-blue-100 text-blue-700' },
                        'confirmed': { label: 'Sắp tới', color: 'bg-blue-100 text-blue-700' }
                      };
                      const currentStatus = statusConfig[b.status] || statusConfig['pending'];

                      return (
                        <div key={b.id} className="flex items-center p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-colors">
                          <div className="w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center mr-4">
                            <i className="fa-solid fa-bed text-blue-600 text-[15px]"></i>
                          </div>
                          <div className="flex-1">
                            <p className="text-[15px] font-bold text-slate-900">Phòng {b.roomCode}</p>
                            <p className="text-[13px] text-slate-500">{formatDate(b.checkIn)} ({b.nights} đêm)</p>
                          </div>
                          <span className={`text-xs font-bold px-3 py-1 rounded-full ${currentStatus.color}`}>
                            {currentStatus.label}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Cột phải: Form thông tin cá nhân */}
            <div className="lg:col-span-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both">
              <div className="bg-white rounded-[2rem] p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50 h-full">
                <div className="flex justify-between items-center border-b border-slate-100 pb-6 mb-8">
                  <h3 className="text-2xl font-playfair font-bold text-slate-900">Thông tin cá nhân</h3>
                  <button onClick={() => setIsPaymentModalOpen(true)} className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center bg-blue-50 px-4 py-2 rounded-lg transition-colors">
                    <i className="fa-solid fa-receipt mr-2"></i>Lịch sử GD
                  </button>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-600 mb-2">Họ và tên</label>
                      <div className="relative">
                        <i className="fa-regular fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input type="text" className={inputClass} placeholder="Nhập họ và tên" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-600 mb-2">Email (Cố định)</label>
                      <div className="relative">
                        <i className="fa-regular fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input type="email" disabled className={inputClass} value={formData.email} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-600 mb-2">Số điện thoại</label>
                      <div className="relative">
                        <i className="fa-solid fa-phone absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input type="tel" className={inputClass} placeholder="090 123 4567" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-600 mb-2">Ngày sinh</label>
                      <div className="relative">
                        <i className="fa-regular fa-calendar absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input type="date" className={inputClass} value={formData.birthday} onChange={e => setFormData({...formData, birthday: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-[13px] font-semibold text-slate-600 mb-2">Địa chỉ</label>
                    <div className="relative">
                      <i className="fa-solid fa-location-dot absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                      <input type="text" className={inputClass} placeholder="123 Đường ABC, Quận 1, TP.HCM" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-[13px] font-semibold text-slate-600 mb-2">Sở thích / Yêu cầu đặc biệt (Ghi chú chung)</label>
                    <textarea rows="3" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-all text-[15px] text-slate-800" placeholder="Ví dụ: Thích phòng không hút thuốc, gối cao su non, thường xuyên ăn chay..." value={formData.preferences} onChange={e => setFormData({...formData, preferences: e.target.value})}></textarea>
                  </div>

                  <div className="border-t border-slate-100 pt-8 mt-8">
                    <h4 className="font-bold text-slate-900 mb-6 flex items-center text-lg"><i className="fa-solid fa-lock text-blue-600 mr-2"></i>Bảo mật & Đổi mật khẩu</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[13px] font-semibold text-slate-600 mb-2">Mật khẩu hiện tại</label>
                        <input type="password" placeholder="••••••••" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-all text-[15px] text-slate-800" value={passwords.current} onChange={e => setPasswords({...passwords, current: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[13px] font-semibold text-slate-600 mb-2">Mật khẩu mới (Tối thiểu 6 ký tự)</label>
                        <input type="password" placeholder="••••••••" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-all text-[15px] text-slate-800" value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-8">
                    <button type="submit" disabled={isSaving} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-[15px] shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-50 disabled:shadow-none disabled:transform-none disabled:cursor-not-allowed transition-all duration-300">
                      {isSaving ? <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i>Đang lưu...</> : <><i className="fa-regular fa-floppy-disk mr-2"></i>Cập nhật hồ sơ</>}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Modal Lịch sử giao dịch */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 z-0" onClick={() => setIsPaymentModalOpen(false)}></div>
          <div className="bg-white rounded-[2rem] w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl relative z-10 animate-in fade-in zoom-in duration-300">
            <div className="flex-none bg-white rounded-t-[2rem] border-b border-slate-100 p-6 md:p-8 flex justify-between items-center sticky top-0 z-10">
              <div>
                <h3 className="text-2xl font-playfair font-bold text-slate-900">Lịch sử giao dịch</h3>
                <p className="text-slate-500 text-sm font-medium mt-1">Các thanh toán và chi tiêu của bạn</p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-all">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 bg-slate-50/50 rounded-b-[2rem]">
              {stats.paidBookings.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-100">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fa-regular fa-credit-card text-4xl text-slate-300"></i>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Chưa có giao dịch</h3>
                  <p className="text-slate-500 text-sm">Bạn chưa thực hiện thanh toán nào trên hệ thống.</p>
                </div>
              ) : (
                stats.paidBookings.map(b => (
                  <div key={b.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4 border-b border-slate-50 pb-3">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center mr-3 text-green-600">
                          <i className="fa-solid fa-check-double"></i>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Mã giao dịch / Booking</p>
                          <p className="font-mono font-bold text-slate-800">#{b.paymentId?.slice(-8).toUpperCase() || b.id.slice(-8).toUpperCase()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-blue-600 font-mono">{formatCurrency(b.totalPrice)}</p>
                        <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide bg-green-100 text-green-700 mt-1">Đã thanh toán</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-[14px]">
                      <div>
                        <p className="text-slate-500 mb-1">Nội dung</p>
                        <p className="font-semibold text-slate-800">Thanh toán Phòng {b.roomCode}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-500 mb-1">Thời gian</p>
                        <p className="font-medium text-slate-700">{formatDate(b.updatedAt || b.createdAt)}</p>
                      </div>
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
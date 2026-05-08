// src/app/admin/services/page.jsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, Timestamp } from "firebase/firestore";

// Hàm tiện ích
const formatCurrency = (amount) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount || 0);

const getDefaultImage = (icon) => {
    const images = {
        utensils: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=800",
        spa: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=800",
        car: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=800",
        dumbbell: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800",
        swimmer: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?q=80&w=800",
        cocktail: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=800",
        cake: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?q=80&w=800",
    };
    return images[icon] || "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800";
};

const getCategoryName = (icon) => {
    if (["utensils", "cocktail", "cake"].includes(icon)) return "Ẩm thực";
    if (["spa", "swimmer", "dumbbell"].includes(icon)) return "Sức khỏe";
    if (["car", "motorcycle"].includes(icon)) return "Di chuyển";
    return "Tiện ích";
};

const initialFormState = {
    id: "",
    name: "",
    description: "",
    price: "",
    unit: "person",
    icon: "utensils",
    image: "",
};

export default function AdminServices() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);

    // States Lọc & Tìm kiếm
    const [searchQuery, setSearchQuery] = useState("");
    const [catFilter, setCatFilter] = useState("all");

    // States Phân trang
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(8);

    // States Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [isSaving, setIsSaving] = useState(false);

    // 1. Lấy dữ liệu Real-time
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "services"), (snap) => {
            const loadedServices = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            setServices(loadedServices.sort((a, b) => b.createdAt - a.createdAt));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. Logic Lọc, Phân trang và Thống kê
    const { filteredServices, paginatedServices, activeCount, avgPrice, totalPages } = useMemo(() => {
        const query = searchQuery.toLowerCase();

        const filtered = services.filter((s) => {
            const matchSearch = (s.name || "").toLowerCase().includes(query) || (s.description || "").toLowerCase().includes(query);

            let sCat = "other";
            if (["utensils", "cocktail", "cake"].includes(s.icon)) sCat = "dining";
            if (["spa", "swimmer", "dumbbell"].includes(s.icon)) sCat = "wellness";
            if (["car", "motorcycle"].includes(s.icon)) sCat = "transport";

            const matchCat = catFilter === "all" || sCat === catFilter;
            return matchSearch && matchCat;
        });

        const active = services.filter((s) => s.available !== false).length;
        const avg = services.length > 0 ? services.reduce((acc, s) => acc + (s.price || 0), 0) / services.length : 0;

        // Tính toán phân trang
        const totalPagesCount = Math.ceil(filtered.length / limit);
        const start = page * limit;
        const paginated = filtered.slice(start, start + limit);

        return {
            filteredServices: filtered,
            paginatedServices: paginated,
            activeCount: active,
            avgPrice: avg,
            totalPages: totalPagesCount
        };
    }, [services, searchQuery, catFilter, page, limit]);

    // Đặt lại trang về 0 khi tìm kiếm hoặc lọc thay đổi
    useEffect(() => {
        setPage(0);
    }, [searchQuery, catFilter, limit]);

    // 3. Xử lý Form Modal
    const openModal = (service = null) => {
        if (service) {
            setFormData({
                id: service.id,
                name: service.name || "",
                description: service.description || "",
                price: service.price || "",
                unit: service.unit || "person",
                icon: service.icon || "utensils",
                image: service.image || "",
            });
        } else {
            setFormData(initialFormState);
        }
        setIsModalOpen(true);
    };

    const handleSaveService = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const serviceData = {
            name: formData.name,
            description: formData.description,
            price: parseInt(formData.price) || 0,
            unit: formData.unit,
            icon: formData.icon,
            image: formData.image || "",
            available: true,
            updatedAt: Timestamp.now(),
        };

        try {
            if (formData.id) {
                await updateDoc(doc(db, "services", formData.id), serviceData);
                alert("Cập nhật dịch vụ thành công!");
            } else {
                await addDoc(collection(db, "services"), {
                    ...serviceData,
                    createdAt: Timestamp.now(),
                    category: "other",
                });
                alert("Thêm dịch vụ mới thành công!");
            }
            setIsModalOpen(false);
        } catch (error) {
            alert("Lỗi: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteService = async (id, name) => {
        if (confirm(`Bạn có chắc chắn muốn xóa dịch vụ "${name}"?`)) {
            try {
                await deleteDoc(doc(db, "services", id));
            } catch (error) {
                alert("Lỗi xóa dịch vụ: " + error.message);
            }
        }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    const formInputClass = "w-full p-2.5 md:p-3 text-sm md:text-base bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all";

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes float-orb { 0%, 100% { transform: translateY(0px) translateX(0px) scale(1); } 50% { transform: translateY(-30px) translateX(20px) scale(1.1); } }
        @keyframes fadeUpIn { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .animate-float-1 { animation: float-orb 8s ease-in-out infinite; }
        .animate-float-2 { animation: float-orb 10s ease-in-out infinite reverse; }
        .premium-card { transition: all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); transform-style: preserve-3d; animation: fadeUpIn 0.6s ease-out forwards; opacity: 0; }
        .premium-card:hover { transform: translateY(-10px); box-shadow: 0 25px 50px -12px rgba(37, 99, 235, 0.15), 0 0 20px -5px rgba(0, 0, 0, 0.05); }
        .premium-img-wrap img { transition: transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1); }
        .premium-card:hover .premium-img-wrap img { transform: scale(1.08) rotate(-1deg); }
        .ultra-glass-pill { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 1); box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); }
      `}} />

            <div className="pb-12 max-w-[1600px] mx-auto fade-in w-full">
                {/* Banner Tổng Quan */}
                <div className="mb-6 md:mb-10 grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 relative">
                    <div className="lg:col-span-2 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 text-white relative overflow-hidden shadow-2xl">
                        <div className="absolute -right-10 md:-right-20 -top-10 md:-top-20 w-40 md:w-80 h-40 md:h-80 bg-blue-500 rounded-full mix-blend-screen filter blur-[40px] md:blur-[80px] opacity-40 animate-float-1"></div>
                        <div className="absolute right-20 md:right-40 -bottom-10 md:-bottom-20 w-32 md:w-64 h-32 md:h-64 bg-purple-500 rounded-full mix-blend-screen filter blur-[30px] md:blur-[60px] opacity-30 animate-float-2"></div>
                        
                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center h-full gap-5 md:gap-6">
                            <div className="max-w-lg">
                                <span className="inline-block py-1 px-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-blue-200 text-[10px] md:text-xs font-bold tracking-widest uppercase mb-3 md:mb-4">Luna Experiences</span>
                                <h2 className="text-3xl md:text-4xl lg:text-5xl font-playfair font-bold mb-2 md:mb-4 leading-tight">Dịch vụ & Tiện ích</h2>
                                <p className="text-slate-300 text-xs md:text-sm leading-relaxed">Nâng tầm kỳ nghỉ của khách hàng bằng những trải nghiệm đẳng cấp và dịch vụ cá nhân hóa tinh tế.</p>
                            </div>
                            <button onClick={() => openModal()} className="w-full md:w-auto justify-center bg-white text-slate-900 hover:bg-blue-50 hover:text-blue-700 px-5 md:px-7 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold shadow-[0_0_30px_rgba(255,255,255,0.2)] md:shadow-[0_0_40px_rgba(255,255,255,0.3)] transition-all transform hover:-translate-y-1 flex items-center group whitespace-nowrap text-sm md:text-base mt-2 md:mt-0">
                                <i className="fa-solid fa-plus mr-2 group-hover:rotate-180 transition-transform duration-500"></i>Thêm dịch vụ mới
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-1 lg:grid-rows-2 gap-4 md:gap-5">
                        <div className="bg-white rounded-2xl md:rounded-[2rem] p-4 md:p-6 border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-md transition-all gap-3 md:gap-0">
                            <div>
                                <p className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1 md:mb-2">Đang phục vụ</p>
                                <div className="flex items-baseline">
                                    <p className="text-2xl md:text-4xl font-bold text-slate-800 font-playfair">{activeCount}</p>
                                    <span className="text-[10px] md:text-sm font-medium text-slate-400 ml-1 md:ml-2">/ {services.length}</span>
                                </div>
                            </div>
                            <div className="w-10 h-10 md:w-16 md:h-16 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-full flex items-center justify-center text-emerald-500 text-lg md:text-2xl shadow-inner self-end md:self-auto">
                                <i className="fa-solid fa-bell-concierge"></i>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl md:rounded-[2rem] p-4 md:p-6 border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-md transition-all gap-3 md:gap-0">
                            <div>
                                <p className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1 md:mb-2">Mức giá TB</p>
                                <p className="text-lg md:text-2xl font-bold text-blue-600 font-mono tracking-tight leading-none md:leading-normal">{formatCurrency(avgPrice).replace("₫", "")}<span className="text-[10px] md:text-xs text-slate-500 ml-0.5 font-sans">đ</span></p>
                            </div>
                            <div className="w-10 h-10 md:w-16 md:h-16 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full flex items-center justify-center text-blue-500 text-lg md:text-2xl shadow-inner self-end md:self-auto">
                                <i className="fa-solid fa-tags"></i>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Thanh Lọc & Tìm kiếm */}
                <div className="bg-white/90 backdrop-blur-xl p-2 md:p-2.5 rounded-2xl md:rounded-3xl border border-slate-200/60 shadow-sm mb-6 md:mb-10 flex flex-col xl:flex-row justify-between gap-3 md:gap-4 transition-all w-full">
                    <div className="flex overflow-x-auto gap-2 items-center px-1 md:px-2 hide-scrollbar pb-1 xl:pb-0">
                        <button onClick={() => setCatFilter("all")} className={`px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm transition-all border whitespace-nowrap flex-shrink-0 ${catFilter === "all" ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20" : "text-slate-600 hover:bg-slate-50 border-transparent"}`}>Tất cả</button>
                        <div className="w-px h-5 md:h-6 bg-slate-200 mx-1 md:mx-2 hidden sm:block"></div>
                        <button onClick={() => setCatFilter("dining")} className={`px-3 md:px-5 py-2 md:py-3 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm transition-all border whitespace-nowrap flex items-center flex-shrink-0 ${catFilter === "dining" ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/30" : "text-orange-600 hover:bg-orange-50 border-transparent"}`}><i className="fa-solid fa-utensils mr-1.5 md:mr-2"></i>Ẩm thực</button>
                        <button onClick={() => setCatFilter("wellness")} className={`px-3 md:px-5 py-2 md:py-3 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm transition-all border whitespace-nowrap flex items-center flex-shrink-0 ${catFilter === "wellness" ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/30" : "text-emerald-600 hover:bg-emerald-50 border-transparent"}`}><i className="fa-solid fa-spa mr-1.5 md:mr-2"></i>Sức khỏe</button>
                        <button onClick={() => setCatFilter("transport")} className={`px-3 md:px-5 py-2 md:py-3 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm transition-all border whitespace-nowrap flex items-center flex-shrink-0 ${catFilter === "transport" ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/30" : "text-blue-600 hover:bg-blue-50 border-transparent"}`}><i className="fa-solid fa-car mr-1.5 md:mr-2"></i>Di chuyển</button>
                    </div>
                    <div className="relative w-full xl:w-[400px] flex-shrink-0">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 md:left-5 top-3.5 md:top-4 text-slate-400"></i>
                        <input type="text" placeholder="Tìm trải nghiệm, dịch vụ..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 md:pl-12 pr-4 md:pr-5 py-2.5 md:py-3.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none font-medium text-xs md:text-sm" />
                    </div>
                </div>

                {/* Danh sách Dịch vụ */}
                {paginatedServices.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 md:gap-x-8 gap-y-6 md:gap-y-10">
                        {paginatedServices.map((s, index) => {
                            const catName = getCategoryName(s.icon);
                            const displayImage = s.image || getDefaultImage(s.icon);

                            return (
                                <div key={s.id} className="premium-card bg-white rounded-2xl md:rounded-[2rem] border border-slate-100/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative flex flex-col h-full group" style={{ animationDelay: `${(index % 12) * 0.08}s` }}>

                                    {/* Wrapper cho ảnh */}
                                    <div className="relative h-48 md:h-60 w-full rounded-t-2xl md:rounded-t-[2rem]">
                                        {/* Ảnh bọc overflow-hidden riêng để không cắt thẻ Giá */}
                                        <div className="absolute inset-0 overflow-hidden rounded-t-2xl md:rounded-t-[2rem] bg-slate-100 premium-img-wrap">
                                            <img src={displayImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={s.name} />
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent"></div>
                                        </div>

                                        <div className="absolute top-3 md:top-4 left-3 md:left-4 bg-white/90 backdrop-blur-md px-2.5 md:px-3 py-1 md:py-1.5 rounded-full shadow-sm flex items-center gap-1.5 md:gap-2">
                                            <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${s.available !== false ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
                                            <span className="text-[9px] md:text-[10px] font-bold text-slate-700 tracking-wider uppercase">{s.available !== false ? "Hoạt động" : "Đã ngưng"}</span>
                                        </div>

                                        <div className="absolute top-3 md:top-4 right-3 md:right-4 bg-black/40 backdrop-blur-md border border-white/10 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full flex items-center text-white">
                                            <i className={`fa-solid fa-${s.icon} text-[9px] md:text-[10px] mr-1.5`}></i>
                                            <span className="text-[9px] md:text-[10px] font-bold tracking-widest uppercase">{catName}</span>
                                        </div>
                                        
                                        {/* Thẻ giá neo vào bottom của ảnh giúp Responsive chuẩn không đè vỡ */}
                                        <div className="absolute -bottom-4 md:-bottom-5 right-4 md:right-6 ultra-glass-pill px-4 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl z-20 flex items-baseline gap-1">
                                            <span className="text-lg md:text-xl font-bold font-mono text-blue-600 tracking-tight">{formatCurrency(s.price).replace("₫", "")}</span>
                                            <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase">đ / {s.unit === "person" ? "Khách" : s.unit === "room" ? "Phòng" : s.unit === "hour" ? "Giờ" : s.unit}</span>
                                        </div>
                                    </div>

                                    <div className="p-5 pt-8 md:p-7 md:pt-10 flex-1 flex flex-col relative z-10 bg-white rounded-b-2xl md:rounded-b-[2rem]">
                                        <h4 className="text-lg md:text-xl font-playfair font-bold text-slate-800 mb-2 md:mb-3 group-hover:text-blue-600 transition-colors duration-300 line-clamp-2 pr-2 md:pr-4">{s.name}</h4>
                                        <p className="text-xs md:text-sm text-slate-500 line-clamp-3 mb-8 md:mb-6 flex-1 leading-relaxed">{s.description || "Chưa có thông tin mô tả chi tiết cho dịch vụ này."}</p>
                                    </div>

                                    {/* Action Dock (Luôn hiện trên Mobile, Ẩn và hiện khi hover trên Desktop) */}
                                    <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex lg:opacity-0 lg:translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 z-30 gap-2 ultra-glass-pill px-2 py-2 rounded-full border border-slate-200/50">
                                        <button onClick={() => openModal(s)} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center shadow-sm transition-all" title="Chỉnh sửa">
                                            <i className="fa-solid fa-pen text-xs md:text-sm"></i>
                                        </button>
                                        <button onClick={() => handleDeleteService(s.id, s.name)} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center shadow-sm transition-all" title="Xóa dịch vụ">
                                            <i className="fa-solid fa-trash text-xs md:text-sm"></i>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-dashed border-slate-300 p-10 md:p-24 text-center shadow-sm mt-4 relative overflow-hidden">
                        <div className="absolute inset-0 bg-slate-50/50"></div>
                        <div className="relative z-10">
                            <div className="w-20 h-20 md:w-28 md:h-28 bg-white rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 text-slate-300 shadow-xl border border-slate-100 animate-bounce">
                                <i className="fa-solid fa-magnifying-glass text-3xl md:text-4xl"></i>
                            </div>
                            <h3 className="text-xl md:text-3xl font-playfair font-bold text-slate-800 mb-2 md:mb-3">Không tìm thấy trải nghiệm!</h3>
                            <p className="text-slate-500 text-xs md:text-base mb-6 md:mb-8 max-w-md mx-auto">Chúng tôi không tìm thấy dịch vụ nào khớp với bộ lọc của bạn. Vui lòng thử lại.</p>
                            <button onClick={() => { setCatFilter("all"); setSearchQuery(""); setPage(0); }} className="bg-slate-900 text-white hover:bg-blue-600 hover:-translate-y-1 transform rounded-xl md:rounded-2xl px-6 py-3 md:px-10 md:py-4 font-bold transition-all shadow-lg text-sm md:text-base">
                                Tải lại bộ lọc
                            </button>
                        </div>
                    </div>
                )}

                {/* Phân trang */}
                {paginatedServices.length > 0 && totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row justify-between items-center mt-8 md:mt-10 p-4 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm gap-4">
                        <div className="flex items-center gap-3">
                            <p className="text-xs md:text-sm text-slate-500 font-medium">Hiển thị</p>
                            <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(0); }} className="bg-slate-50 border border-slate-200 text-slate-700 text-xs md:text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none p-1.5 px-3 font-bold cursor-pointer hover:bg-white transition-colors">
                                <option value="8">8</option>
                                <option value="12">12</option>
                                <option value="24">24</option>
                            </select>
                            <p className="text-xs md:text-sm text-slate-500">/ {filteredServices.length} dịch vụ</p>
                        </div>

                        <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                            <button onClick={() => setPage(page - 1)} disabled={page === 0} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                <i className="fa-solid fa-chevron-left text-[10px] md:text-xs"></i>
                            </button>

                            {Array.from({ length: totalPages }).map((_, i) => {
                                if (totalPages > 5 && i !== 0 && i !== totalPages - 1 && Math.abs(i - page) > 1) {
                                    if (i === 1 || i === totalPages - 2) return <span key={i} className="px-1 text-slate-400 text-xs">...</span>;
                                    return null;
                                }
                                return (
                                    <button key={i} onClick={() => setPage(i)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs md:text-sm font-bold transition-all duration-300 ${page === i ? "bg-slate-800 text-white shadow-md scale-110" : "text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-sm"}`}>
                                        {i + 1}
                                    </button>
                                );
                            })}

                            <button onClick={() => setPage(page + 1)} disabled={page === totalPages - 1} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                <i className="fa-solid fa-chevron-right text-[10px] md:text-xs"></i>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Thêm/Sửa Dịch vụ */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl md:rounded-3xl w-full max-w-lg shadow-2xl animate-in zoom-in duration-300 my-auto">
                        <div className="p-5 md:p-8 max-h-[90vh] overflow-y-auto custom-scroll">
                            <div className="flex justify-between items-center mb-5 md:mb-6 border-b border-slate-100 pb-3 md:pb-4 sticky top-0 bg-white z-10">
                                <h3 className="text-xl md:text-2xl font-playfair font-bold text-slate-900">{formData.id ? "Cập nhật dịch vụ" : "Thêm dịch vụ mới"}</h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-full w-8 h-8 md:w-10 md:h-10 flex items-center justify-center transition-all flex-shrink-0"><i className="fa-solid fa-xmark text-lg md:text-xl"></i></button>
                            </div>

                            <form onSubmit={handleSaveService} className="space-y-4 md:space-y-5">
                                <div>
                                    <label className="block text-[12px] md:text-[13px] font-semibold text-slate-600 mb-1.5 md:mb-2">Tên dịch vụ <span className="text-red-500">*</span></label>
                                    <input type="text" required className={formInputClass} placeholder="VD: Buffet sáng" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>

                                <div>
                                    <label className="block text-[12px] md:text-[13px] font-semibold text-slate-600 mb-1.5 md:mb-2">Mô tả</label>
                                    <textarea rows="2" className={formInputClass} placeholder="Mô tả ngắn về dịch vụ" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}></textarea>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[12px] md:text-[13px] font-semibold text-slate-600 mb-1.5 md:mb-2">Giá (VNĐ) <span className="text-red-500">*</span></label>
                                        <input type="number" required className={formInputClass} placeholder="250000" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-[12px] md:text-[13px] font-semibold text-slate-600 mb-1.5 md:mb-2">Đơn vị</label>
                                        <select className={`${formInputClass} cursor-pointer`} value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                                            <option value="person">/ Người</option>
                                            <option value="room">/ Phòng</option>
                                            <option value="hour">/ Giờ</option>
                                            <option value="day">/ Ngày</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[12px] md:text-[13px] font-semibold text-slate-600 mb-1.5 md:mb-2">Icon danh mục</label>
                                    <select className={`${formInputClass} cursor-pointer`} value={formData.icon} onChange={e => setFormData({ ...formData, icon: e.target.value })}>
                                        <option value="utensils">🍽️ Nhà hàng</option>
                                        <option value="spa">💆 Spa</option>
                                        <option value="wifi">📶 WiFi</option>
                                        <option value="car">🚗 Xe đưa đón</option>
                                        <option value="dumbbell">🏋️ Gym</option>
                                        <option value="swimmer">🏊 Hồ bơi</option>
                                        <option value="cocktail">🍹 Đồ uống</option>
                                        <option value="cake">🎂 Sinh nhật</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[12px] md:text-[13px] font-semibold text-slate-600 mb-1.5 md:mb-2">Hình ảnh (URL)</label>
                                    <input type="url" className={formInputClass} placeholder="https://example.com/service.jpg" value={formData.image} onChange={e => setFormData({ ...formData, image: e.target.value })} />
                                    <p className="text-[10px] md:text-[11px] text-slate-400 mt-1">Bỏ trống hệ thống sẽ dùng ảnh tự động theo Icon</p>
                                </div>

                                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 md:pt-6 border-t border-slate-200 mt-4 md:mt-6">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors text-sm md:text-base">Hủy</button>
                                    <button type="submit" disabled={isSaving} className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 text-sm md:text-base">
                                        {isSaving ? "Đang lưu..." : "Lưu dịch vụ"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
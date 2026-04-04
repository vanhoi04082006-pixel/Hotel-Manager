// src/app/admin/promotions/page.jsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, Timestamp } from "firebase/firestore";

const formatCurrency = (amount) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount || 0);
const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString("vi-VN") : "";

const initialFormState = {
    id: "",
    code: "",
    name: "",
    type: "percent",
    value: "",
    startDate: "",
    endDate: "",
    description: "",
    condition: "all",
    minAmount: "",
    active: true,
};

export default function AdminPromotions() {
    const [promotions, setPromotions] = useState([]);
    const [loading, setLoading] = useState(true);

    // States Lọc & Tìm kiếm
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // States Phân trang
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(8);
    const listRef = useRef(null);

    // States Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [isSaving, setIsSaving] = useState(false);

    // 1. Lấy dữ liệu Real-time
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "promotions"), (snap) => {
            const loadedPromos = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            setPromotions(loadedPromos);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. Logic Lọc, Thống kê và Phân trang
    const { filteredPromos, paginatedPromos, activeCount, expiringSoonCount, totalPages } = useMemo(() => {
        const query = searchQuery.toLowerCase();
        const now = new Date();
        // Reset giờ phút giây để so sánh ngày chính xác
        now.setHours(0, 0, 0, 0);

        let active = 0;
        let expiring = 0;

        const filtered = promotions.filter((p) => {
            const endDate = new Date(p.endDate);
            endDate.setHours(23, 59, 59, 999);

            const isExpired = endDate < now;
            let status = p.active ? "active" : "paused";
            if (isExpired) status = "expired";

            // Tính thống kê
            if (p.active && !isExpired) {
                active++;
                const diffDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                if (diffDays > 0 && diffDays <= 7) expiring++;
            }

            // Lọc theo status và search
            const matchSearch = (p.name || "").toLowerCase().includes(query) || (p.code || "").toLowerCase().includes(query);
            const matchStatus = statusFilter === "all" || status === statusFilter;

            return matchSearch && matchStatus;
        });

        // Sắp xếp: Đang chạy lên đầu, hết hạn xuống cuối
        filtered.sort((a, b) => {
            const aExpired = new Date(a.endDate) < now;
            const bExpired = new Date(b.endDate) < now;
            if (aExpired && !bExpired) return 1;
            if (!aExpired && bExpired) return -1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // Tính toán phân trang
        const totalPagesCount = Math.ceil(filtered.length / limit);
        const start = page * limit;
        const paginated = filtered.slice(start, start + limit);

        return {
            filteredPromos: filtered,
            paginatedPromos: paginated,
            activeCount: active,
            expiringSoonCount: expiring,
            totalPages: totalPagesCount
        };
    }, [promotions, searchQuery, statusFilter, page, limit]);

    // Đặt lại trang về 0 khi bộ lọc thay đổi
    useEffect(() => {
        setPage(0);
    }, [searchQuery, statusFilter, limit]);

    const handlePageChange = (newPage) => {
        setPage(newPage);
        if (listRef.current) {
            listRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    // 3. Xử lý Thao tác
    const openModal = (promo = null) => {
        if (promo) {
            setFormData({
                id: promo.id,
                code: promo.code || "",
                name: promo.name || "",
                type: promo.type || "percent",
                value: promo.value || "",
                startDate: promo.startDate || "",
                endDate: promo.endDate || "",
                description: promo.description || "",
                condition: promo.condition || "all",
                minAmount: promo.minAmount || "",
                active: promo.active !== false,
            });
        } else {
            setFormData(initialFormState);
        }
        setIsModalOpen(true);
    };

    const handleSavePromo = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const promoData = {
            code: formData.code.toUpperCase().trim(),
            name: formData.name,
            type: formData.type,
            value: parseInt(formData.value) || 0,
            startDate: formData.startDate,
            endDate: formData.endDate,
            description: formData.description,
            condition: formData.condition,
            minAmount: parseInt(formData.minAmount) || 0,
            active: formData.active,
            updatedAt: Timestamp.now(),
        };

        try {
            if (formData.id) {
                await updateDoc(doc(db, "promotions", formData.id), promoData);
                alert("Cập nhật khuyến mãi thành công!");
            } else {
                await addDoc(collection(db, "promotions"), {
                    ...promoData,
                    createdAt: Timestamp.now(),
                });
                alert("Thêm khuyến mãi mới thành công!");
            }
            setIsModalOpen(false);
        } catch (error) {
            alert("Lỗi lưu khuyến mãi: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeletePromo = async (id, code) => {
        if (confirm(`Bạn có chắc chắn muốn xóa mã "${code}"?`)) {
            try {
                await deleteDoc(doc(db, "promotions", id));
            } catch (error) {
                alert("Lỗi xóa mã: " + error.message);
            }
        }
    };

    const togglePromoStatus = async (id, currentStatus) => {
        try {
            await updateDoc(doc(db, "promotions", id), { active: !currentStatus });
        } catch (error) {
            alert("Lỗi cập nhật trạng thái: " + error.message);
        }
    };

    const copyPromoCode = (code) => {
        navigator.clipboard.writeText(code);
        alert(`Đã sao chép mã: ${code}`);
    };

    if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes float-orb {
            0%, 100% { transform: translateY(0px) translateX(0px) scale(1); }
            50% { transform: translateY(-30px) translateX(20px) scale(1.1); }
        }
        @keyframes fadeUpIn {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-float-1 { animation: float-orb 8s ease-in-out infinite; }
        .animate-float-2 { animation: float-orb 10s ease-in-out infinite reverse; }

        .ticket-shape { position: relative; background: white; border-radius: 2rem; overflow: visible; }
        .ticket-shape::before, .ticket-shape::after {
            content: ''; position: absolute; top: 50%; width: 30px; height: 30px; background: #f8fafc;
            border-radius: 50%; transform: translateY(-50%); z-index: 10;
        }
        .ticket-shape::before { left: -15px; box-shadow: inset -5px 0 10px rgba(0,0,0,0.03); }
        .ticket-shape::after { right: -15px; box-shadow: inset 5px 0 10px rgba(0,0,0,0.03); }
        .ticket-divider { position: absolute; top: 15%; bottom: 15%; left: 30%; width: 2px; border-left: 2px dashed #e2e8f0; z-index: 5; }
        .promo-card-premium { transition: all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); animation: fadeUpIn 0.6s ease-out forwards; opacity: 0;}
        .promo-card-premium:hover { transform: scale(1.02) rotate(-1deg); box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.1); }
      `}} />

            <div className="fade-in max-w-[1600px] mx-auto pb-12">
                {/* Banner Tổng Quan */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                    <div className="lg:col-span-2 bg-gradient-to-br from-indigo-900 via-slate-900 to-black rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
                        <div className="absolute right-0 top-0 w-full h-full opacity-20 pointer-events-none">
                            <svg width="100%" height="100%" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="750" cy="50" r="150" fill="url(#grad1)" />
                                <defs>
                                    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#818cf8" stopOpacity="1" />
                                        <stop offset="100%" stopColor="#c084fc" stopOpacity="1" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>

                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center h-full gap-6">
                            <div className="max-w-lg">
                                <span className="inline-block py-1 px-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-blue-200 text-xs font-bold tracking-widest uppercase mb-6">Marketing Hub</span>
                                <h2 className="text-4xl lg:text-5xl font-playfair font-bold mb-4 leading-tight">Chiến dịch & Ưu đãi</h2>
                                <p className="text-slate-300 text-sm leading-relaxed">Tạo ra những ưu đãi không thể cưỡng lại để thu hút khách hàng và tối ưu hóa doanh thu vào mùa cao điểm.</p>
                            </div>
                            <button onClick={() => openModal()} className="bg-white text-slate-900 hover:bg-indigo-50 px-8 py-4 rounded-2xl font-bold shadow-xl transition-all flex items-center gap-3 transform hover:-translate-y-1 whitespace-nowrap">
                                <i className="fa-solid fa-plus-circle text-indigo-600 text-xl"></i> Tạo mã giảm giá mới
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-rows-2 gap-4">
                        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 flex items-center gap-5 shadow-sm">
                            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 text-2xl shadow-inner">
                                <i className="fa-solid fa-rocket"></i>
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Đang chạy</p>
                                <p className="text-3xl font-bold text-slate-800">{activeCount}</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 flex items-center gap-5 shadow-sm">
                            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 text-2xl shadow-inner">
                                <i className="fa-solid fa-hourglass-end"></i>
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sắp hết hạn (7 ngày)</p>
                                <p className="text-3xl font-bold text-slate-800">{expiringSoonCount}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Thanh Lọc & Tìm kiếm */}
                <div ref={listRef} className="bg-white/80 backdrop-blur-xl p-3 rounded-3xl border border-slate-200 shadow-sm mb-12 flex flex-col xl:flex-row justify-between gap-4">
                    <div className="flex overflow-x-auto gap-2 items-center px-2 hide-scrollbar">
                        <button onClick={() => setStatusFilter("all")} className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all ${statusFilter === "all" ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50 border border-transparent"}`}>Tất cả</button>
                        <div className="w-px h-6 bg-slate-200 mx-2"></div>
                        <button onClick={() => setStatusFilter("active")} className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all ${statusFilter === "active" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" : "text-emerald-600 hover:bg-emerald-50 border border-transparent"}`}>Đang chạy</button>
                        <button onClick={() => setStatusFilter("paused")} className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all ${statusFilter === "paused" ? "bg-amber-500 text-white shadow-lg shadow-amber-200" : "text-amber-600 hover:bg-amber-50 border border-transparent"}`}>Tạm dừng</button>
                        <button onClick={() => setStatusFilter("expired")} className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all ${statusFilter === "expired" ? "bg-rose-500 text-white shadow-lg shadow-rose-200" : "text-rose-600 hover:bg-rose-50 border border-transparent"}`}>Hết hạn</button>
                    </div>
                    <div className="relative w-full xl:w-[400px]">
                        <i className="fa-solid fa-search absolute left-5 top-4 text-slate-400"></i>
                        <input type="text" placeholder="Tìm tên chương trình hoặc mã..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-medium" />
                    </div>
                </div>

                {/* Danh sách Khuyến mãi */}
                {paginatedPromos.length > 0 ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        {paginatedPromos.map((p, index) => {
                            const now = new Date();
                            now.setHours(0, 0, 0, 0);
                            const endDate = new Date(p.endDate);
                            endDate.setHours(23, 59, 59, 999);

                            const isExpired = endDate < now;
                            const statusColor = !p.active ? "amber" : isExpired ? "rose" : "emerald";
                            const discountVal = p.type === "percent" ? `${p.value}%` : formatCurrency(p.value).replace("₫", "đ");
                            const conditionText = p.condition === "all" ? "Mọi đơn" : p.condition === "min_amount" ? `Đơn từ ${formatCurrency(p.minAmount)}` : "Khách mới";

                            return (
                                <div key={p.id} className={`promo-card-premium ticket-shape border ${isExpired ? 'border-rose-100' : 'border-slate-100'} shadow-[0_10px_40px_rgba(0,0,0,0.03)] flex flex-row h-52 group ${!p.active ? 'opacity-70 grayscale-[20%]' : ''}`} style={{ animationDelay: `${(index % 10) * 0.1}s` }}>
                                    <div className="ticket-divider"></div>

                                    {/* Cột trái: Giá trị giảm */}
                                    <div className={`w-[30%] bg-gradient-to-br from-${statusColor}-500 to-${statusColor}-700 rounded-l-[2rem] flex flex-col items-center justify-center text-white p-4 relative overflow-hidden`}>
                                        <div className="absolute -left-4 -top-4 w-16 h-16 bg-white/10 rounded-full"></div>
                                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">GIẢM GIÁ</span>
                                        <h3 className="text-4xl font-black font-mono tracking-tighter">{discountVal}</h3>
                                        <div className="mt-4 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-lg text-[9px] font-bold uppercase border border-white/20 text-center leading-tight">
                                            {p.type === "percent" ? "Percentage" : "Fixed Amount"}
                                        </div>
                                    </div>

                                    {/* Cột phải: Thông tin */}
                                    <div className="flex-1 p-6 pl-12 flex flex-col justify-between relative">
                                        <div className="flex justify-between items-start">
                                            <div className="min-w-0 pr-2">
                                                <h4 className="text-xl font-bold text-slate-800 truncate mb-1" title={p.name}>{p.name}</h4>
                                                <p className="text-xs text-slate-500 line-clamp-1">{p.description || "Ưu đãi dành riêng cho hệ thống Luna Hotel."}</p>
                                            </div>

                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                <button onClick={() => openModal(p)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-blue-500 hover:text-white transition-all shadow-sm flex items-center justify-center"><i className="fa-solid fa-pen text-[10px]"></i></button>
                                                <button onClick={() => handleDeletePromo(p.id, p.code)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-rose-500 hover:text-white transition-all shadow-sm flex items-center justify-center"><i className="fa-solid fa-trash text-[10px]"></i></button>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 mt-4">
                                            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 flex items-center justify-between min-w-[150px] cursor-pointer hover:border-indigo-300 transition-all group/code" onClick={() => copyPromoCode(p.code)}>
                                                <div>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">PROMO CODE</p>
                                                    <p className="font-mono font-bold text-indigo-600 text-lg leading-none mt-1">{p.code}</p>
                                                </div>
                                                <i className="fa-solid fa-copy text-slate-300 group-hover/code:text-indigo-500 transition-colors"></i>
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
                                                    <span>Thời gian</span>
                                                    <span className={isExpired ? "text-rose-500" : "text-slate-600"}>{isExpired ? "Đã hết hạn" : "Đang hiệu lực"}</span>
                                                </div>
                                                <div className="text-[11px] font-semibold text-slate-700 flex items-center gap-2">
                                                    <i className="fa-regular fa-calendar"></i>
                                                    {formatDate(p.startDate)} <i className="fa-solid fa-arrow-right text-[8px] mx-1"></i> {formatDate(p.endDate)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                                            <div className="flex items-center gap-2 text-[11px] cursor-pointer" onClick={() => togglePromoStatus(p.id, p.active)}>
                                                <span className={`w-2 h-2 rounded-full bg-${statusColor}-500 ${!p.active || isExpired ? "" : "animate-pulse"}`}></span>
                                                <span className="font-bold text-slate-500 uppercase tracking-widest hover:text-indigo-600 transition-colors">
                                                    {!p.active ? "Tạm dừng (Bấm để bật)" : isExpired ? "Hết hạn" : "Đang chạy (Bấm để tắt)"}
                                                </span>
                                            </div>
                                            <div className="text-[11px] font-bold text-slate-400">
                                                ĐK: <span className="text-slate-800">{conditionText}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white rounded-[3rem] border-2 border-dashed border-slate-200 p-24 text-center shadow-inner">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300 border border-slate-100">
                            <i className="fa-solid fa-tags text-4xl"></i>
                        </div>
                        <h3 className="text-2xl font-playfair font-bold text-slate-800 mb-3">Không tìm thấy mã ưu đãi!</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mb-8 text-sm">Hệ thống không tìm thấy khuyến mãi nào phù hợp với bộ lọc hiện tại.</p>
                        <button onClick={() => { setStatusFilter("all"); setSearchQuery(""); setPage(0); }} className="bg-blue-600 text-white px-8 py-3 rounded-xl shadow-lg hover:bg-blue-700 transition-colors font-bold">
                            Hiển thị tất cả
                        </button>
                    </div>
                )}

                {/* Phân trang */}
                {paginatedPromos.length > 0 && totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row justify-between items-center mt-12 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm gap-4">
                        <div className="flex items-center gap-3">
                            <p className="text-sm text-slate-500 font-medium">Hiển thị</p>
                            <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(0); }} className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none p-1.5 px-3 font-bold cursor-pointer hover:bg-white transition-colors">
                                <option value="8">8</option>
                                <option value="16">16</option>
                                <option value="24">24</option>
                            </select>
                            <p className="text-sm text-slate-500">/ {filteredPromos.length} mục</p>
                        </div>

                        <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                            <button onClick={() => handlePageChange(page - 1)} disabled={page === 0} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                <i className="fa-solid fa-chevron-left text-xs"></i>
                            </button>

                            {Array.from({ length: totalPages }).map((_, i) => {
                                if (totalPages > 7 && i !== 0 && i !== totalPages - 1 && Math.abs(i - page) > 1) {
                                    if (i === 1 || i === totalPages - 2) return <span key={i} className="px-1 text-slate-400">...</span>;
                                    return null;
                                }
                                return (
                                    <button key={i} onClick={() => handlePageChange(i)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-all duration-300 ${page === i ? "bg-slate-800 text-white shadow-md scale-110" : "text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-sm"}`}>
                                        {i + 1}
                                    </button>
                                );
                            })}

                            <button onClick={() => handlePageChange(page + 1)} disabled={page === totalPages - 1} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                <i className="fa-solid fa-chevron-right text-xs"></i>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Thêm/Sửa Khuyến mãi */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in duration-300 border border-slate-100">
                        <div className="p-6 md:p-8">
                            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                                <h3 className="text-2xl font-playfair font-bold text-slate-900">{formData.id ? "Cập nhật mã" : "Tạo khuyến mãi"}</h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center transition-all"><i className="fa-solid fa-xmark text-xl"></i></button>
                            </div>

                            <form onSubmit={handleSavePromo} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Mã KM <span className="text-red-500">*</span></label>
                                        <input type="text" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all font-mono uppercase" placeholder="VD: SUMMER2026" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Trạng thái</label>
                                        <label className="flex items-center space-x-2 mt-3 cursor-pointer group">
                                            <input type="checkbox" className="w-5 h-5 rounded text-blue-600 cursor-pointer border-slate-300" checked={formData.active} onChange={e => setFormData({ ...formData, active: e.target.checked })} />
                                            <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Kích hoạt ngay</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Tên chương trình <span className="text-red-500">*</span></label>
                                    <input type="text" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all" placeholder="Ưu đãi mùa hè" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Loại giảm giá</label>
                                        <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all text-sm cursor-pointer" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                            <option value="percent">Phần trăm (%)</option>
                                            <option value="fixed">Số tiền trực tiếp (VNĐ)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Giá trị <span className="text-red-500">*</span></label>
                                        <input type="number" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all" placeholder="10" value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Ngày bắt đầu <span className="text-red-500">*</span></label>
                                        <input type="date" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Ngày kết thúc <span className="text-red-500">*</span></label>
                                        <input type="date" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Điều kiện áp dụng</label>
                                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all text-sm cursor-pointer" value={formData.condition} onChange={e => setFormData({ ...formData, condition: e.target.value })}>
                                        <option value="all">Áp dụng mọi đơn hàng</option>
                                        <option value="min_amount">Hóa đơn tối thiểu</option>
                                        <option value="first_booking">Dành cho khách đặt lần đầu</option>
                                    </select>
                                </div>

                                {formData.condition === "min_amount" && (
                                    <div className="animate-in slide-in-from-top-2">
                                        <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Giá trị hóa đơn tối thiểu (VNĐ)</label>
                                        <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all" placeholder="1000000" value={formData.minAmount} onChange={e => setFormData({ ...formData, minAmount: e.target.value })} />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Mô tả chi tiết</label>
                                    <textarea rows="2" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all" placeholder="Nội dung hiển thị cho khách hàng..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}></textarea>
                                </div>

                                <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100 mt-6">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">Hủy</button>
                                    <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 flex items-center">
                                        {isSaving ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Đang lưu...</> : "Lưu chương trình"}
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
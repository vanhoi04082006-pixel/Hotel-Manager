// src/app/admin/bookings/page.jsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, updateDoc, deleteDoc, addDoc, onSnapshot, Timestamp } from "firebase/firestore";
import Link from "next/link";
import * as XLSX from "xlsx";

const formatCurrency = (amount) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount || 0);

const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
        const d = dateString?.toDate ? dateString.toDate() : new Date(dateString);
        return d.toLocaleDateString("vi-VN");
    } catch (e) { return ""; }
};

const formatDateTime = (dateString) => {
    if (!dateString) return "";
    try {
        const d = dateString?.toDate ? dateString.toDate() : new Date(dateString);
        return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
};

export default function AdminBookings() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    // States Tìm kiếm & Lọc
    const [filter, setFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    // States Phân trang
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(10);

    // State điều khiển thẻ đang được xổ xuống (Accordion)
    const [expandedId, setExpandedId] = useState(null);

    // 1. Lấy dữ liệu Real-time
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "bookings"), (snap) => {
            const loadedBookings = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            // Sắp xếp mới nhất lên đầu
            loadedBookings.sort((a, b) => {
                const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return timeB - timeA;
            });
            setBookings(loadedBookings);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. Xử lý Lọc, Tìm kiếm, Phân trang và Thống kê
    const { filteredBookings, paginatedBookings, stats, totalPages } = useMemo(() => {
        const query = searchQuery.toLowerCase();

        // Lọc theo Search & Status
        const filtered = bookings.filter((b) => {
            const matchFilter = filter === "all" || b.status === filter;
            const matchSearch = !query ||
                (b.userName || "").toLowerCase().includes(query) ||
                (b.roomCode || "").toLowerCase().includes(query) ||
                (b.id || "").toLowerCase().includes(query);
            return matchFilter && matchSearch;
        });

        // Tính toán số liệu Thống kê
        const statsObj = {
            total: bookings.length,
            pending: bookings.filter((b) => b.status === "pending").length,
            confirmed: bookings.filter((b) => b.status === "confirmed").length,
            completed: bookings.filter((b) => b.status === "completed").length,
            cancelled: bookings.filter((b) => b.status === "cancelled").length,
        };

        // Phân trang
        const totalPagesCount = Math.ceil(filtered.length / limit);
        const start = page * limit;
        const paginated = filtered.slice(start, start + limit);

        return { filteredBookings: filtered, paginatedBookings: paginated, stats: statsObj, totalPages: totalPagesCount };
    }, [bookings, filter, searchQuery, page, limit]);

    // Đặt lại trang về 0 nếu lọc/tìm kiếm
    useEffect(() => {
        setPage(0);
    }, [filter, searchQuery, limit]);

    // 3. Các hàm xử lý Thao tác Đặt phòng
    const toggleExpand = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const updateBookingStatus = async (bookingId, newStatus, roomId) => {
        try {
            await updateDoc(doc(db, "bookings", bookingId), {
                status: newStatus,
                updatedAt: Timestamp.now(),
            });

            // Đồng bộ trạng thái Phòng tương ứng
            if (newStatus === "confirmed") {
                await updateDoc(doc(db, "rooms", roomId), { status: "occupied" });
                alert("Đã xác nhận đặt phòng!");
            } else if (newStatus === "completed") {
                await updateDoc(doc(db, "rooms", roomId), { status: "available" });
                alert("Đã hoàn tất Check-out!");
                generateInvoice(bookingId); // Tự động tạo hóa đơn khi check-out
            } else if (newStatus === "cancelled") {
                await updateDoc(doc(db, "rooms", roomId), { status: "available" });
                alert("Đã hủy đặt phòng!");
            }
        } catch (error) {
            alert("Lỗi: " + error.message);
        }
    };

    const handlePayment = async (bookingId) => {
        try {
            await updateDoc(doc(db, "bookings", bookingId), {
                paymentStatus: "paid",
                updatedAt: Timestamp.now(),
            });
            alert("Cập nhật thanh toán thành công!");
        } catch (error) {
            alert("Lỗi: " + error.message);
        }
    };

    const generateInvoice = async (bookingId) => {
        const booking = bookings.find((b) => b.id === bookingId);
        if (!booking) return;

        const invoiceData = {
            bookingId: booking.id,
            customerName: booking.userName || booking.userEmail,
            customerEmail: booking.userEmail,
            customerPhone: booking.userPhone || "",
            roomCode: booking.roomCode,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            nights: booking.nights,
            roomPrice: booking.roomPrice,
            roomTotal: booking.roomTotal,
            services: booking.services || [],
            serviceTotal: booking.serviceTotal || 0,
            serviceFee: booking.serviceFee || 0,
            discount: booking.discountApplied || 0,
            total: booking.finalPaidAmount || booking.totalPrice,
            status: "paid",
            createdAt: Timestamp.now(),
        };

        try {
            await addDoc(collection(db, "invoices"), invoiceData);
            alert("Đã tự động tạo hóa đơn trong mục Quản lý Hóa đơn.");
        } catch (error) {
            console.error("Lỗi tạo hóa đơn:", error);
        }
    };

    const deleteBooking = async (id) => {
        if (confirm("Bạn có chắc chắn muốn xóa bản ghi này khỏi hệ thống?")) {
            try {
                await deleteDoc(doc(db, "bookings", id));
            } catch (error) {
                alert("Lỗi: " + error.message);
            }
        }
    };

    const exportToExcel = () => {
        try {
            const wb = XLSX.utils.book_new();
            const wsData = bookings.map((b) => ({
                "Mã đặt phòng": b.id.slice(-8).toUpperCase(),
                "Khách hàng": b.userName || b.userEmail,
                "SĐT": b.userPhone || "N/A",
                "Phòng": b.roomCode,
                "Ngày đặt": formatDate(b.createdAt),
                "Nhận phòng": formatDate(b.checkIn),
                "Trả phòng": formatDate(b.checkOut),
                "Số đêm": b.nights,
                "Tổng tiền": b.totalPrice,
                "Trạng thái": b.status,
                "Thanh toán": b.paymentStatus === "paid" ? "Đã thanh toán" : "Chưa thanh toán",
            }));
            const ws = XLSX.utils.json_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, "Bookings");
            XLSX.writeFile(wb, `Luna_Bookings_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (error) {
            alert("Lỗi xuất Excel: " + error.message);
        }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <>
            {/* Thêm CSS thủ công cho timeline và animation */}
            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(30px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .booking-card-ult { animation: slideUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .booking-card-ult:hover { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15); transform: translateY(-3px); }
        .accordion-content { transition: grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .accordion-inner { overflow: hidden; }
        .timeline-line::before { content: ''; position: absolute; left: 11px; top: 24px; bottom: -24px; width: 2px; background: #e2e8f0; z-index: 0; }
        .timeline-step:last-child .timeline-line::before { display: none; }
        .tab-ult { position: relative; overflow: hidden; }
        .tab-ult.active { background: #1e293b; color: white; border-color: #1e293b; box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.3); }
        .tab-ult.active::after { content:''; position:absolute; bottom:0; left:0; width:100%; height:3px; background: linear-gradient(90deg, #3b82f6, #8b5cf6); }
      `}} />

            <div className="fade-in max-w-7xl mx-auto pb-12 relative w-full">
                {/* Header Hàng trên cùng */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4 w-full">
                    <div className="w-full md:w-auto">
                        <h2 className="text-2xl md:text-3xl font-playfair font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 flex flex-wrap items-center gap-2 md:gap-3">
                            Quản lý Đặt phòng
                            <span className="bg-blue-50 text-blue-600 text-[10px] md:text-xs py-1.5 px-3 rounded-xl font-sans font-bold flex items-center border border-blue-100 shadow-sm whitespace-nowrap mt-1 md:mt-0">
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping mr-2"></span>Cập nhật trực tiếp
                            </span>
                        </h2>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <button onClick={exportToExcel} className="w-full sm:w-auto justify-center bg-white text-slate-700 border border-slate-200 rounded-xl px-5 py-2.5 flex items-center gap-2 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all font-bold text-sm shadow-sm">
                            <i className="fa-solid fa-file-excel"></i> Xuất Excel
                        </button>
                        <Link href="/admin/rooms" className="w-full sm:w-auto justify-center bg-slate-900 text-white rounded-xl px-5 py-2.5 shadow-lg shadow-blue-500/30 flex items-center gap-2 hover:-translate-y-0.5 transition-all font-bold text-sm">
                            <i className="fa-solid fa-plus"></i> Tạo Booking
                        </Link>
                    </div>
                </div>

                {/* Thanh Lọc & Tìm kiếm */}
                <div className="bg-white/80 backdrop-blur-xl p-2 rounded-2xl border border-slate-200/60 shadow-sm mb-6 md:mb-8 flex flex-col xl:flex-row justify-between gap-3 md:gap-4 transition-all w-full">
                    <div className="flex overflow-x-auto gap-2 custom-scroll hide-scrollbar pb-1 xl:pb-0">
                        <button onClick={() => setFilter("all")} className={`tab-ult px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all border border-slate-200 whitespace-nowrap flex-shrink-0 ${filter === 'all' ? 'active' : 'text-slate-600 hover:bg-slate-50'}`}>
                            Tất cả <span className={`ml-1.5 md:ml-2 px-1.5 md:px-2 py-0.5 rounded-md text-[9px] md:text-[10px] ${filter === 'all' ? 'bg-white/20' : 'bg-slate-100'}`}>{stats.total}</span>
                        </button>
                        <button onClick={() => setFilter("pending")} className={`tab-ult px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all border border-slate-200 whitespace-nowrap flex-shrink-0 ${filter === 'pending' ? 'active' : 'text-amber-600 hover:bg-amber-50'}`}>
                            <i className="fa-regular fa-clock mr-1"></i> Chờ duyệt <span className={`ml-1.5 md:ml-2 px-1.5 md:px-2 py-0.5 rounded-md text-[9px] md:text-[10px] ${filter === 'pending' ? 'bg-white/20' : 'bg-amber-100'}`}>{stats.pending}</span>
                        </button>
                        <button onClick={() => setFilter("confirmed")} className={`tab-ult px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all border border-slate-200 whitespace-nowrap flex-shrink-0 ${filter === 'confirmed' ? 'active' : 'text-blue-600 hover:bg-blue-50'}`}>
                            <i className="fa-solid fa-check mr-1"></i> Đã xác nhận <span className={`ml-1.5 md:ml-2 px-1.5 md:px-2 py-0.5 rounded-md text-[9px] md:text-[10px] ${filter === 'confirmed' ? 'bg-white/20' : 'bg-blue-100'}`}>{stats.confirmed}</span>
                        </button>
                        <button onClick={() => setFilter("completed")} className={`tab-ult px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all border border-slate-200 whitespace-nowrap flex-shrink-0 ${filter === 'completed' ? 'active' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                            <i className="fa-solid fa-check-double mr-1"></i> Hoàn tất <span className={`ml-1.5 md:ml-2 px-1.5 md:px-2 py-0.5 rounded-md text-[9px] md:text-[10px] ${filter === 'completed' ? 'bg-white/20' : 'bg-emerald-100'}`}>{stats.completed}</span>
                        </button>
                        <button onClick={() => setFilter("cancelled")} className={`tab-ult px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all border border-slate-200 whitespace-nowrap flex-shrink-0 ${filter === 'cancelled' ? 'active' : 'text-rose-600 hover:bg-rose-50'}`}>
                            <i className="fa-solid fa-xmark mr-1"></i> Đã hủy <span className={`ml-1.5 md:ml-2 px-1.5 md:px-2 py-0.5 rounded-md text-[9px] md:text-[10px] ${filter === 'cancelled' ? 'bg-white/20' : 'bg-rose-100'}`}>{stats.cancelled}</span>
                        </button>
                    </div>

                    <div className="relative w-full xl:w-72 flex-shrink-0">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-3.5 text-slate-400"></i>
                        <input
                            type="text"
                            placeholder="Tìm tên, mã phòng, ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 md:py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none font-medium text-sm"
                        />
                    </div>
                </div>

                {/* Danh sách Booking */}
                <div className="space-y-4 md:space-y-5">
                    {paginatedBookings.length > 0 ? paginatedBookings.map((b, index) => {
                        const isPaid = b.paymentStatus === "paid";

                        let st = { color: "slate", icon: "fa-circle", text: "Không rõ" };
                        if (b.status === "pending") st = { color: "amber", icon: "fa-hourglass-half", text: "Chờ duyệt" };
                        if (b.status === "confirmed") st = { color: "blue", icon: "fa-check", text: "Đã xác nhận" };
                        if (b.status === "completed") st = { color: "emerald", icon: "fa-check-double", text: "Hoàn tất" };
                        if (b.status === "cancelled") st = { color: "rose", icon: "fa-xmark", text: "Đã hủy" };

                        const isExpanded = expandedId === b.id;

                        return (
                            <div key={b.id} className={`booking-card-ult bg-white rounded-2xl border border-slate-200 relative isolate transition-all duration-300 ${isExpanded ? "ring-2 ring-blue-400/50 shadow-xl scale-[1.01] z-10" : ""}`} style={{ animationDelay: `${index * 0.05}s` }}>
                                {/* Dải màu bên trái */}
                                <div className={`absolute left-0 top-0 bottom-0 w-2 bg-${st.color}-500 rounded-l-2xl z-10`}></div>

                                {/* Phần thẻ tóm tắt (Luôn hiển thị) */}
                                <div className="p-4 sm:p-5 sm:pl-7 flex flex-col lg:flex-row lg:items-center gap-4 md:gap-6 relative z-20 bg-white rounded-2xl cursor-pointer" onClick={() => toggleExpand(b.id)}>

                                    {/* Nhóm Thông tin Khách hàng */}
                                    <div className="flex justify-between items-start lg:items-center lg:w-4/12 w-full">
                                        <div className="flex items-center gap-3 sm:gap-4 pl-3 sm:pl-0">
                                            <div className="relative flex-shrink-0">
                                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full shadow-sm ring-2 ring-slate-100 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-bold text-slate-600 text-base md:text-lg">
                                                    {(b.userName || b.userEmail || "U").charAt(0).toUpperCase()}
                                                </div>
                                                {isPaid && (
                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-white" title="Đã thanh toán">
                                                        <i className="fa-solid fa-check text-[7px] md:text-[8px]"></i>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="mb-1">
                                                    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 font-mono text-[9px] md:text-[11px] px-2 py-0.5 rounded-md font-bold border border-slate-200 shadow-sm" title="Mã đặt phòng">
                                                        <i className="fa-solid fa-hashtag text-[8px] md:text-[9px] text-slate-400"></i>{(b.id || "").slice(-8).toUpperCase()}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-slate-800 truncate text-xs sm:text-sm" title={b.userName || b.userEmail}>{b.userName || b.userEmail || "Khách hàng"}</h4>
                                            </div>
                                        </div>
                                        
                                        {/* Nút Chevron trên Mobile (Ẩn trên Desktop) */}
                                        <div className="lg:hidden flex items-center h-full">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm ${isExpanded ? "bg-blue-600 text-white" : "bg-slate-50 border border-slate-100 text-slate-400"}`}>
                                                <i className={`fa-solid fa-chevron-down text-xs transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}></i>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Nhóm Ngày giờ & Phòng */}
                                    <div className="lg:w-4/12 flex items-center justify-between bg-slate-50 rounded-xl p-2 md:p-2.5 border border-slate-100 w-full ml-3 sm:ml-0 w-[calc(100%-12px)] sm:w-full">
                                        <div className="text-center px-3 md:px-4 border-r border-slate-200 flex-shrink-0">
                                            <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase mb-0.5">Phòng</p>
                                            <p className="font-bold text-blue-600 text-base md:text-lg font-mono leading-none">{b.roomCode}</p>
                                        </div>
                                        <div className="flex-1 px-3 md:px-4 flex items-center justify-between min-w-0">
                                            <div className="text-left">
                                                <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase truncate">Check-in</p>
                                                <p className="font-bold text-slate-800 text-xs md:text-sm">{formatDate(b.checkIn).slice(0, 5)}</p>
                                            </div>
                                            <div className="flex flex-col items-center px-1 md:px-2 flex-shrink-0">
                                                <i className="fa-solid fa-arrow-right-long text-slate-300 text-[10px] md:text-xs"></i>
                                                <span className="text-[9px] md:text-[10px] font-bold text-indigo-500 mt-0.5 bg-indigo-50 px-1 md:px-1.5 rounded whitespace-nowrap">{b.nights} đêm</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase truncate">Check-out</p>
                                                <p className="font-bold text-slate-800 text-xs md:text-sm">{formatDate(b.checkOut).slice(0, 5)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Nhóm Giá & Trạng thái */}
                                    <div className="lg:w-3/12 flex flex-row lg:flex-col items-center lg:items-end justify-between w-full ml-3 sm:ml-0 w-[calc(100%-12px)] sm:w-full">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] md:text-[11px] font-bold bg-${st.color}-50 text-${st.color}-700 border border-${st.color}-200 shadow-sm`}>
                                            <i className={`fa-solid ${st.icon}`}></i> {st.text}
                                        </span>
                                        <p className={`font-bold font-mono text-base md:text-lg lg:mt-1.5 leading-none ${isPaid ? "text-emerald-600" : "text-slate-800"}`}>
                                            {formatCurrency(b.finalPaidAmount || b.totalPrice)}
                                        </p>
                                    </div>

                                    {/* Nút Chevron trên Desktop */}
                                    <div className="hidden lg:flex lg:w-1/12 justify-end">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${isExpanded ? "bg-blue-600 text-white" : "bg-slate-50 border border-slate-100 text-slate-400"}`}>
                                            <i className={`fa-solid fa-chevron-down transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}></i>
                                        </div>
                                    </div>
                                </div>

                                {/* Phần Chi tiết xổ xuống (Accordion Content) */}
                                <div className={`accordion-content grid ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} bg-slate-50/50 border-t border-slate-100 rounded-b-2xl`}>
                                    <div className="accordion-inner">
                                        <div className="p-4 sm:p-6 sm:pl-7 grid grid-cols-1 lg:grid-cols-3 gap-6">

                                            {/* Cột 1: Tiến trình Timeline */}
                                            <div className="col-span-1 ml-3 sm:ml-0">
                                                <h5 className="text-[11px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-4"><i className="fa-solid fa-route mr-2"></i>Tiến trình</h5>
                                                <div className="relative pl-3 space-y-5">
                                                    <div className="timeline-step relative">
                                                        <div className="timeline-line absolute w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm left-0 top-1"></div>
                                                        <div className="pl-6">
                                                            <p className="text-xs md:text-sm font-bold text-slate-800">Khách đặt phòng</p>
                                                            <p className="text-[9px] md:text-[10px] text-slate-500 mt-0.5">{formatDateTime(b.createdAt)}</p>
                                                        </div>
                                                    </div>

                                                    {b.status !== "pending" && b.status !== "cancelled" && (
                                                        <div className="timeline-step relative">
                                                            <div className="timeline-line absolute w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm left-0 top-1"></div>
                                                            <div className="pl-6">
                                                                <p className="text-xs md:text-sm font-bold text-slate-800">Đã xác nhận</p>
                                                                <p className="text-[9px] md:text-[10px] text-slate-500 mt-0.5">Bởi Hệ thống</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {b.paymentStatus === "paid" && (
                                                        <div className="timeline-step relative">
                                                            <div className="timeline-line absolute w-3 h-3 rounded-full bg-purple-500 border-2 border-white shadow-sm left-0 top-1"></div>
                                                            <div className="pl-6">
                                                                <p className="text-xs md:text-sm font-bold text-slate-800">Đã thanh toán</p>
                                                                <p className="text-[9px] md:text-[10px] text-slate-500 mt-0.5">Thành công</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {b.status === "completed" && (
                                                        <div className="timeline-step relative">
                                                            <div className="timeline-line absolute w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm left-0 top-1"></div>
                                                            <div className="pl-6">
                                                                <p className="text-xs md:text-sm font-bold text-slate-800">Hoàn tất Check-out</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {b.status === "cancelled" && (
                                                        <div className="timeline-step relative">
                                                            <div className="absolute w-3 h-3 rounded-full bg-rose-500 border-2 border-white shadow-sm left-0 top-1"></div>
                                                            <div className="pl-6">
                                                                <p className="text-xs md:text-sm font-bold text-rose-600">Đã hủy</p>
                                                                <p className="text-[9px] md:text-[10px] text-slate-500 mt-0.5">{b.cancelReason || "Khách yêu cầu"}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Cột 2: Chi phí */}
                                            <div className="col-span-1 ml-3 sm:ml-0">
                                                <h5 className="text-[11px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-4"><i className="fa-solid fa-file-invoice-dollar mr-2"></i>Chi phí</h5>
                                                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
                                                    <div className="flex justify-between items-center text-xs md:text-sm">
                                                        <span className="text-slate-600">Tiền phòng ({b.nights} đêm)</span>
                                                        <span className="font-medium text-slate-800">{formatCurrency(b.roomTotal || (b.roomPrice * b.nights))}</span>
                                                    </div>

                                                    {(b.services && b.services.length > 0) && (
                                                        <div className="flex justify-between items-start text-xs md:text-sm">
                                                            <span className="text-slate-600">Dịch vụ thêm</span>
                                                            <div className="text-right">
                                                                <span className="font-medium text-slate-800">{formatCurrency(b.serviceTotal || 0)}</span>
                                                                <p className="text-[9px] md:text-[10px] text-slate-400 mt-1 max-w-[120px] md:max-w-none">{b.services.map(s => s.name).join(", ")}</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {b.discountApplied > 0 && (
                                                        <div className="flex justify-between items-center text-xs md:text-sm text-rose-500">
                                                            <span>Giảm giá/KM</span>
                                                            <span className="font-medium">-{formatCurrency(b.discountApplied)}</span>
                                                        </div>
                                                    )}

                                                    <div className="border-t border-slate-100 border-dashed pt-3 mt-3 flex justify-between items-center">
                                                        <span className="font-bold text-slate-800 text-xs md:text-sm">TỔNG CỘNG</span>
                                                        <span className="font-bold text-lg md:text-xl font-mono text-blue-600">{formatCurrency(b.finalPaidAmount || b.totalPrice)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Cột 3: Liên hệ & Thao tác */}
                                            <div className="col-span-1 flex flex-col ml-3 sm:ml-0">
                                                <h5 className="text-[11px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-4"><i className="fa-solid fa-address-book mr-2"></i>Liên hệ & Ghi chú</h5>
                                                <div className="space-y-2 mb-6">
                                                    <p className="text-xs md:text-sm text-slate-700 flex items-center gap-2"><i className="fa-solid fa-phone w-4 text-slate-400"></i> {b.userPhone || "Trống"}</p>
                                                    <p className="text-xs md:text-sm text-slate-700 flex items-center gap-2 truncate"><i className="fa-solid fa-envelope w-4 text-slate-400"></i> {b.userEmail || "Trống"}</p>
                                                    {b.specialRequests && (
                                                        <div className="mt-2 p-2.5 md:p-3 bg-amber-50 rounded-lg border border-amber-100 text-[10px] md:text-xs text-amber-800">
                                                            <span className="font-bold">Yêu cầu:</span> {b.specialRequests}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Các Nút Thao tác */}
                                                <div className="mt-auto grid grid-cols-2 gap-2">
                                                    {b.status === "pending" && (
                                                        <>
                                                            <button onClick={(e) => { e.stopPropagation(); updateBookingStatus(b.id, "confirmed", b.roomId); }} className="py-2.5 text-xs md:text-sm w-full bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">Xác nhận</button>
                                                            <button onClick={(e) => { e.stopPropagation(); updateBookingStatus(b.id, "cancelled", b.roomId); }} className="py-2.5 text-xs md:text-sm w-full bg-white border border-rose-200 text-rose-600 font-bold rounded-lg hover:bg-rose-50 transition-colors shadow-sm">Từ chối</button>
                                                        </>
                                                    )}

                                                    {b.status === "confirmed" && (
                                                        <>
                                                            <button onClick={(e) => { e.stopPropagation(); updateBookingStatus(b.id, "completed", b.roomId); }} className="py-2.5 text-xs md:text-sm w-full bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">Check-out</button>
                                                            {!isPaid && (
                                                                <button onClick={(e) => { e.stopPropagation(); handlePayment(b.id); }} className="py-2.5 text-xs md:text-sm w-full bg-white border border-amber-200 text-amber-700 font-bold rounded-lg hover:bg-amber-50 transition-colors shadow-sm">Thu tiền</button>
                                                            )}
                                                        </>
                                                    )}

                                                    {b.status === "completed" && isPaid && (
                                                        <button onClick={(e) => { e.stopPropagation(); generateInvoice(b.id); }} className="col-span-2 py-2.5 text-xs md:text-sm w-full bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors shadow-sm">
                                                            <i className="fa-solid fa-print mr-2"></i>In hóa đơn
                                                        </button>
                                                    )}

                                                    <button onClick={(e) => { e.stopPropagation(); deleteBooking(b.id); }} className="col-span-2 py-2 text-[10px] md:text-xs font-medium text-slate-400 hover:text-rose-600 transition-colors mt-1 underline">
                                                        Xóa bản ghi này
                                                    </button>
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                </div>

                            </div>
                        );
                    }) : (
                        <div className="bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-slate-300 p-10 md:p-20 text-center shadow-inner">
                            <div className="relative w-20 h-20 md:w-24 md:h-24 mx-auto mb-6">
                                <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-50"></div>
                                <div className="relative w-full h-full bg-white rounded-full flex items-center justify-center shadow-lg border border-slate-100">
                                    <i className="fa-solid fa-box-open text-3xl md:text-4xl text-blue-400"></i>
                                </div>
                            </div>
                            <h3 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">Chưa có dữ liệu phù hợp</h3>
                            <p className="text-xs md:text-sm text-slate-500 max-w-md mx-auto mb-6 md:mb-8">Không tìm thấy đơn đặt phòng nào trong trạng thái <span className="font-bold text-slate-700">"{filter}"</span> hoặc khớp với từ khóa tìm kiếm.</p>
                            <button onClick={() => { setFilter("all"); setSearchQuery(""); setPage(0); }} className="bg-white border border-slate-200 text-slate-700 px-5 md:px-6 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-sm text-sm">
                                Xóa bộ lọc & Tải lại
                            </button>
                        </div>
                    )}
                </div>

                {/* Phân trang */}
                {paginatedBookings.length > 0 && totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row justify-between items-center mt-6 md:mt-8 p-4 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm gap-4">
                        <div className="flex items-center gap-3">
                            <p className="text-xs md:text-sm text-slate-500 font-medium">Hiển thị</p>
                            <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(0); }} className="bg-slate-50 border border-slate-200 text-slate-700 text-xs md:text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none p-1.5 px-3 font-bold cursor-pointer hover:bg-white transition-colors shadow-sm">
                                <option value="5">5</option>
                                <option value="10">10</option>
                                <option value="20">20</option>
                                <option value="50">50</option>
                            </select>
                            <p className="text-xs md:text-sm text-slate-500">/ {filteredBookings.length} đơn</p>
                        </div>

                        <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-100 shadow-sm">
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
        </>
    );
}
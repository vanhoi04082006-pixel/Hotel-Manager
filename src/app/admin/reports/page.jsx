// src/app/admin/reports/page.jsx
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, onSnapshot } from "firebase/firestore";

const formatCurrency = (amount) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount || 0);

const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
        const d = dateString?.toDate ? dateString.toDate() : new Date(dateString);
        return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
};

export default function AdminReports() {
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState("thisYear");

    // Dữ liệu thô từ Firebase
    const [bookingsData, setBookingsData] = useState([]);
    const [invoicesData, setInvoicesData] = useState([]);
    const [roomsData, setRoomsData] = useState([]);
    const [usersData, setUsersData] = useState([]);
    const [servicesData, setServicesData] = useState([]);
    const [staffData, setStaffData] = useState([]);

    // Refs cho Canvas Biểu đồ
    const revenueChartRef = useRef(null);
    const roomChartRef = useRef(null);
    const serviceChartRef = useRef(null);
    const statusChartRef = useRef(null);

    // Refs lưu Instance của Chart
    const chartsInst = useRef({});

    // State Modal Xuất Báo Cáo Chi Tiết
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportConfig, setReportConfig] = useState({
        type: "revenue",
        from: "",
        to: "",
        format: "excel"
    });

    // 1. Tải toàn bộ dữ liệu Real-time
    useEffect(() => {
        const unsubBookings = onSnapshot(collection(db, "bookings"), (snap) => setBookingsData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubRooms = onSnapshot(collection(db, "rooms"), (snap) => setRoomsData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubUsers = onSnapshot(collection(db, "users"), (snap) => setUsersData(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role !== "admin")));
        const unsubServices = onSnapshot(collection(db, "services"), (snap) => setServicesData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubStaff = onSnapshot(collection(db, "staff"), (snap) => setStaffData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const unsubInvoices = onSnapshot(collection(db, "invoices"), (snap) => {
            const invs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            invs.sort((a, b) => {
                const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
                const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
                return timeB - timeA;
            });
            setInvoicesData(invs);
            setLoading(false);
        });

        return () => {
            unsubBookings(); unsubRooms(); unsubUsers(); unsubServices(); unsubStaff(); unsubInvoices();
        };
    }, []);

    // 2. Tính toán số liệu Thống kê theo bộ lọc thời gian
    const { stats, chartData, recentInvoices } = useMemo(() => {
        if (loading) return { stats: {}, chartData: {}, recentInvoices: [] };

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const monthlyRevenue = Array(12).fill(0);
        const monthlyBookings = Array(12).fill(0);
        const roomTypesCount = {};
        const serviceUsageCount = {};
        const statusCount = { completed: 0, confirmed: 0, pending: 0, cancelled: 0 };

        let totalRev = 0;
        let totalDiscount = 0;
        let totalServicesRev = 0;
        let validBookingsCount = 0;

        // --- Tính toán Hóa đơn (Invoices) ---
        invoicesData.forEach(inv => {
            if (inv.status !== "paid") return;

            const invDate = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);

            let isInRange = false;
            if (timeRange === "thisYear" && invDate.getFullYear() === currentYear) isInRange = true;
            if (timeRange === "thisMonth" && invDate.getFullYear() === currentYear && invDate.getMonth() === currentMonth) isInRange = true;
            if (timeRange === "all") isInRange = true;

            if (isInRange) {
                totalRev += inv.total || 0;
                totalDiscount += inv.discount || 0;
                totalServicesRev += inv.serviceTotal || 0;

                if (timeRange === "thisYear" || timeRange === "all") {
                    monthlyRevenue[invDate.getMonth()] += inv.total || 0;
                }
            }
        });

        // --- Tính toán Đặt phòng (Bookings) ---
        bookingsData.forEach(b => {
            const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);

            let isInRange = false;
            if (timeRange === "thisYear" && bDate.getFullYear() === currentYear) isInRange = true;
            if (timeRange === "thisMonth" && bDate.getFullYear() === currentYear && bDate.getMonth() === currentMonth) isInRange = true;
            if (timeRange === "all") isInRange = true;

            if (isInRange) {
                if (statusCount[b.status] !== undefined) statusCount[b.status]++;
                if (b.status === "completed" || b.status === "confirmed") validBookingsCount++;

                if (timeRange === "thisYear" || timeRange === "all") {
                    monthlyBookings[bDate.getMonth()]++;
                }

                if (b.status !== "cancelled") {
                    const typeKey = b.roomType || (b.roomCode ? b.roomCode.charAt(0) : "Khác");
                    roomTypesCount[typeKey] = (roomTypesCount[typeKey] || 0) + 1;

                    if (b.services && Array.isArray(b.services)) {
                        b.services.forEach(s => {
                            serviceUsageCount[s.name] = (serviceUsageCount[s.name] || 0) + 1;
                        });
                    }
                }
            }
        });

        const totalAllBookings = statusCount.completed + statusCount.confirmed + statusCount.pending + statusCount.cancelled;
        const cancelRate = totalAllBookings > 0 ? ((statusCount.cancelled / totalAllBookings) * 100).toFixed(1) : 0;
        const avgOrderValue = validBookingsCount > 0 ? (totalRev / validBookingsCount) : 0;

        const topServices = Object.entries(serviceUsageCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const recent5Invoices = invoicesData.filter(i => i.status === 'paid').slice(0, 5);

        return {
            stats: {
                revenue: totalRev,
                discounts: totalDiscount,
                servicesRev: totalServicesRev,
                netRevenue: totalRev - totalServicesRev,
                validBookings: validBookingsCount,
                cancelRate: cancelRate,
                aov: avgOrderValue
            },
            chartData: {
                monthlyRevenue,
                monthlyBookings,
                roomTypesCount,
                topServices,
                statusCount
            },
            recentInvoices: recent5Invoices
        };
    }, [loading, invoicesData, bookingsData, timeRange]);

    // 3. Vẽ Biểu Đồ (Sử dụng Dynamic Import để fix lỗi SSR)
    useEffect(() => {
        if (loading) return;

        // Load Chart.js động trên Client
        import("chart.js/auto").then((mod) => {
            const Chart = mod.default;

            // Xóa các biểu đồ cũ trước khi vẽ lại
            Object.values(chartsInst.current).forEach(chart => chart?.destroy());
            chartsInst.current = {};

            const revCtx = revenueChartRef.current?.getContext("2d");
            const roomCtx = roomChartRef.current?.getContext("2d");
            const srvCtx = serviceChartRef.current?.getContext("2d");
            const sttCtx = statusChartRef.current?.getContext("2d");

            if (revCtx && timeRange !== "thisMonth") {
                const gradientBlue = revCtx.createLinearGradient(0, 0, 0, 400);
                gradientBlue.addColorStop(0, "rgba(59, 130, 246, 0.9)");
                gradientBlue.addColorStop(1, "rgba(59, 130, 246, 0.2)");

                chartsInst.current.rev = new Chart(revCtx, {
                    type: "bar",
                    data: {
                        labels: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"],
                        datasets: [
                            {
                                type: "line", label: "Lượt Booking", data: chartData.monthlyBookings,
                                borderColor: "#10b981", backgroundColor: "#10b981", borderWidth: 3, tension: 0.4,
                                yAxisID: "y1",
                            },
                            {
                                type: "bar", label: "Doanh thu (VNĐ)", data: chartData.monthlyRevenue,
                                backgroundColor: gradientBlue, borderRadius: 6, yAxisID: "y",
                            }
                        ]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { position: "top", labels: { usePointStyle: true, boxWidth: 8 } } },
                        scales: {
                            y: { type: "linear", display: true, position: "left", ticks: { callback: (val) => (val / 1000000) + "M" } },
                            y1: { type: "linear", display: true, position: "right", grid: { drawOnChartArea: false }, ticks: { stepSize: 1 } }
                        }
                    }
                });
            }

            if (roomCtx) {
                const labels = Object.keys(chartData.roomTypesCount);
                const data = Object.values(chartData.roomTypesCount);

                chartsInst.current.room = new Chart(roomCtx, {
                    type: "doughnut",
                    data: {
                        labels: labels.length ? labels.map(l => `Hạng ${l}`) : ["Chưa có"],
                        datasets: [{
                            data: data.length ? data : [1],
                            backgroundColor: ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#f43f5e", "#64748b"],
                            borderWidth: 0, hoverOffset: 4
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, cutout: "75%", plugins: { legend: { position: "right", labels: { usePointStyle: true, padding: 15 } } } }
                });
            }

            if (srvCtx) {
                const labels = chartData.topServices.map(s => s[0]);
                const data = chartData.topServices.map(s => s[1]);

                chartsInst.current.srv = new Chart(srvCtx, {
                    type: "bar",
                    data: {
                        labels: labels.length ? labels : ["Chưa có dữ liệu"],
                        datasets: [{
                            label: "Số lượt sử dụng",
                            data: data.length ? data : [0],
                            backgroundColor: "rgba(139, 92, 246, 0.8)",
                            borderRadius: 4,
                            barThickness: 20
                        }]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { x: { ticks: { stepSize: 1 } }, y: { grid: { display: false } } }
                    }
                });
            }

            if (sttCtx) {
                const { completed, confirmed, pending, cancelled } = chartData.statusCount;
                chartsInst.current.stt = new Chart(sttCtx, {
                    type: "doughnut",
                    data: {
                        labels: ["Hoàn tất", "Xác nhận", "Chờ duyệt", "Đã hủy"],
                        datasets: [{
                            data: [completed, confirmed, pending, cancelled],
                            backgroundColor: ["#10b981", "#3b82f6", "#f59e0b", "#f43f5e"],
                            borderWidth: 0, hoverOffset: 4
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, cutout: "65%", plugins: { legend: { position: "bottom", labels: { usePointStyle: true, padding: 20 } } } }
                });
            }
        });

    }, [loading, chartData, timeRange]);


    // 4. Các Hàm Xuất Báo Cáo (Sử dụng Dynamic Import cho XLSX)
    const quickExportRevenue = async () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const revenueData = bookingsData.filter(b => {
            const d = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return d >= firstDay && d <= lastDay && (b.status === 'completed' || b.status === 'confirmed');
        });

        if (revenueData.length === 0) {
            alert("Không có doanh thu nào trong tháng này để xuất.");
            return;
        }

        const wsData = revenueData.map(b => ({
            'Mã đặt': b.id.slice(-8).toUpperCase(),
            'Khách hàng': b.userName || b.userEmail,
            'Phòng': b.roomCode,
            'Ngày đặt': formatDate(b.createdAt),
            'Nhận phòng': formatDate(b.checkIn),
            'Trả phòng': formatDate(b.checkOut),
            'Số đêm': b.nights,
            'Tổng tiền': b.totalPrice,
            'Trạng thái': b.status === 'completed' ? 'Hoàn tất' : 'Đã xác nhận'
        }));

        try {
            // Import động XLSX để tránh lỗi SSR Turbopack
            const XLSX = await import("xlsx");
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, `DoanhThu_Thang${now.getMonth() + 1}`);
            XLSX.writeFile(wb, `Luna_DoanhThu_${now.getFullYear()}_${now.getMonth() + 1}.xlsx`);
        } catch (e) {
            alert('Lỗi xuất dữ liệu: ' + e.message);
        }
    };

    const handleExportReportDetail = async () => {
        if (!reportConfig.from || !reportConfig.to) {
            alert('Vui lòng chọn đầy đủ khoảng thời gian (Từ ngày - Đến ngày).');
            return;
        }

        const fromDate = new Date(reportConfig.from);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(reportConfig.to);
        toDate.setHours(23, 59, 59, 999);

        let data = [];
        if (reportConfig.type === 'bookings' || reportConfig.type === 'revenue') {
            data = bookingsData.filter(b => {
                const d = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return d >= fromDate && d <= toDate;
            });
        } else if (reportConfig.type === 'customers') {
            data = usersData; // Thông thường xuất hết danh sách KH
        } else if (reportConfig.type === 'services') {
            data = servicesData;
        } else if (reportConfig.type === 'staff') {
            data = staffData;
        }

        if (data.length === 0) {
            alert('Không có dữ liệu trong khoảng thời gian hoặc danh mục này.');
            return;
        }

        try {
            if (reportConfig.format === 'excel') {
                let wsData = [];
                if (reportConfig.type === 'revenue' || reportConfig.type === 'bookings') {
                    wsData = data.map(item => ({
                        'Mã đặt': item.id?.slice(-8).toUpperCase() || '',
                        'Khách hàng': item.userName || item.userEmail,
                        'Phòng': item.roomCode,
                        'Ngày đặt': formatDate(item.createdAt),
                        'Nhận phòng': formatDate(item.checkIn),
                        'Trả phòng': formatDate(item.checkOut),
                        'Số đêm': item.nights,
                        'Tổng tiền': item.totalPrice,
                        'Trạng thái': item.status
                    }));
                } else {
                    wsData = data.map(item => ({ ID: item.id, ...item }));
                }

                // Import động XLSX
                const XLSX = await import("xlsx");
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, "Report Data");
                XLSX.writeFile(wb, `Luna_${reportConfig.type}_${new Date().getTime()}.xlsx`);
            }
            else if (reportConfig.format === 'csv') {
                let csv = 'ID,Data\n';
                data.forEach(d => { csv += `${d.id},${d.name || d.roomCode || d.userName || ''}\n`; });
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Luna_${reportConfig.type}_${new Date().getTime()}.csv`;
                a.click();
            }
            else {
                alert("Tính năng in PDF hiện đang được nâng cấp hệ thống, vui lòng chọn xuất Excel hoặc CSV.");
            }

            setIsReportModalOpen(false);
        } catch (e) {
            alert('Lỗi xuất dữ liệu: ' + e.message);
        }
    };


    if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="fade-in max-w-[1600px] mx-auto pb-12 relative animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header & Thanh Công Cụ Lọc */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-white/80 backdrop-blur-xl p-5 rounded-3xl border border-slate-200 shadow-sm">
                <div>
                    <h2 className="text-3xl font-playfair font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-indigo-600 flex items-center gap-3">
                        Báo cáo Kế toán
                        <span className="bg-indigo-50 text-indigo-600 text-xs py-1.5 px-3 rounded-xl font-sans font-bold flex items-center border border-indigo-100 shadow-sm">
                            <i className="fa-solid fa-chart-pie mr-2"></i> Analytics Pro
                        </span>
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Tổng hợp và phân tích dữ liệu hiệu suất kinh doanh đa chiều.</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Bộ lọc thời gian */}
                    <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200/60 hide-scrollbar overflow-x-auto max-w-[200px] sm:max-w-none">
                        <button onClick={() => setTimeRange("thisMonth")} className={`px-4 py-2.5 whitespace-nowrap rounded-xl text-sm font-bold transition-all ${timeRange === "thisMonth" ? "bg-white text-indigo-600 shadow-md" : "text-slate-500 hover:text-slate-800"}`}>Tháng này</button>
                        <button onClick={() => setTimeRange("thisYear")} className={`px-4 py-2.5 whitespace-nowrap rounded-xl text-sm font-bold transition-all ${timeRange === "thisYear" ? "bg-white text-indigo-600 shadow-md" : "text-slate-500 hover:text-slate-800"}`}>Năm nay</button>
                        <button onClick={() => setTimeRange("all")} className={`px-4 py-2.5 whitespace-nowrap rounded-xl text-sm font-bold transition-all ${timeRange === "all" ? "bg-white text-indigo-600 shadow-md" : "text-slate-500 hover:text-slate-800"}`}>Tất cả</button>
                    </div>

                    {/* Các nút Hành động xuất File */}
                    <div className="flex gap-2">
                        <button onClick={() => setIsReportModalOpen(true)} className="px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm hidden md:block" title="Bộ lọc xuất báo cáo chuyên sâu">
                            <i className="fa-solid fa-file-export md:mr-2"></i><span className="hidden md:inline">Chi tiết</span>
                        </button>
                        <button onClick={quickExportRevenue} className="px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-500 hover:text-white transition-all shadow-sm flex items-center">
                            <i className="fa-solid fa-file-excel md:mr-2"></i><span className="hidden md:inline">Doanh thu tháng</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 4 Thẻ Chỉ Số KPI Mới */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

                {/* Doanh thu */}
                <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 text-blue-50 opacity-50 group-hover:scale-150 transition-transform duration-500"><i className="fa-solid fa-wallet text-9xl"></i></div>
                    <div className="relative z-10 flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl flex items-center justify-center text-xl shadow-lg"><i className="fa-solid fa-sack-dollar"></i></div>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 uppercase">Thực thu</span>
                    </div>
                    <div className="relative z-10">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tổng Doanh Thu</p>
                        <h3 className="text-3xl font-bold text-slate-800 font-mono tracking-tight">{formatCurrency(stats.revenue).replace("₫", "")}<span className="text-sm ml-1 font-sans text-slate-500">đ</span></h3>
                    </div>
                </div>

                {/* Khuyến mãi */}
                <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 text-rose-50 opacity-50 group-hover:scale-150 transition-transform duration-500"><i className="fa-solid fa-tags text-9xl"></i></div>
                    <div className="relative z-10 flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-rose-400 to-rose-600 text-white rounded-xl flex items-center justify-center text-xl shadow-lg"><i className="fa-solid fa-ticket"></i></div>
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100 uppercase">Chi phí</span>
                    </div>
                    <div className="relative z-10">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Đã Khuyến Mãi</p>
                        <h3 className="text-3xl font-bold text-rose-600 font-mono tracking-tight">{formatCurrency(stats.discounts).replace("₫", "")}<span className="text-sm ml-1 font-sans text-rose-400">đ</span></h3>
                    </div>
                </div>

                {/* AOV - Average Order Value */}
                <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 text-emerald-50 opacity-50 group-hover:scale-150 transition-transform duration-500"><i className="fa-solid fa-chart-line text-9xl"></i></div>
                    <div className="relative z-10 flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-xl flex items-center justify-center text-xl shadow-lg"><i className="fa-solid fa-receipt"></i></div>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 uppercase">{stats.validBookings} Đơn</span>
                    </div>
                    <div className="relative z-10">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Giá trị Đơn T.Bình (AOV)</p>
                        <h3 className="text-3xl font-bold text-emerald-600 font-mono tracking-tight">{formatCurrency(stats.aov).replace("₫", "")}<span className="text-sm ml-1 font-sans text-emerald-500">đ</span></h3>
                    </div>
                </div>

                {/* Hủy phòng */}
                <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 text-amber-50 opacity-50 group-hover:scale-150 transition-transform duration-500"><i className="fa-solid fa-triangle-exclamation text-9xl"></i></div>
                    <div className="relative z-10 flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 text-white rounded-xl flex items-center justify-center text-xl shadow-lg"><i className="fa-solid fa-ban"></i></div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border uppercase ${stats.cancelRate > 15 ? "text-rose-600 bg-rose-50 border-rose-200" : "text-amber-600 bg-amber-50 border-amber-100"}`}>Cảnh báo</span>
                    </div>
                    <div className="relative z-10">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tỷ lệ hủy (Cancel Rate)</p>
                        <h3 className="text-3xl font-bold text-amber-500 font-mono tracking-tight">{stats.cancelRate}<span className="text-xl ml-1 font-sans">%</span></h3>
                    </div>
                </div>

            </div>

            {/* Khu vực Biểu Đồ */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">

                {/* Biểu đồ Doanh thu (Line + Bar Chart) - 2 Cột */}
                <div className="xl:col-span-2 bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm flex flex-col h-[480px]">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Biểu đồ Tăng trưởng Doanh thu</h3>
                            <p className="text-xs text-slate-500 mt-1">So sánh lượng Booking và Doanh thu thực tế theo tháng</p>
                        </div>
                        <div className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-blue-100">Cập nhật lúc: {new Date().toLocaleTimeString("vi-VN")}</div>
                    </div>
                    <div className="flex-1 w-full relative">
                        {timeRange === "thisMonth" ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                <i className="fa-solid fa-chart-column text-5xl mb-4 opacity-40"></i>
                                <p className="font-bold text-slate-600 mb-1">Dữ liệu theo tháng không đủ vẽ biểu đồ</p>
                                <p className="text-sm">Chuyển sang "Năm nay" hoặc "Tất cả" để xem phân tích xu hướng.</p>
                            </div>
                        ) : (
                            <canvas ref={revenueChartRef}></canvas>
                        )}
                    </div>
                </div>

                {/* Cột phải: 2 Doughnut Charts xếp dọc */}
                <div className="xl:col-span-1 flex flex-col gap-6 h-[480px]">

                    {/* Phân bổ Hạng phòng */}
                    <div className="flex-1 bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col relative overflow-hidden">
                        <h3 className="text-base font-bold text-slate-800 mb-4 z-10 relative">Phân bổ Hạng phòng</h3>
                        <div className="flex-1 relative z-10 min-h-[120px]">
                            <canvas ref={roomChartRef}></canvas>
                            {/* Chữ ở giữa biểu đồ */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pr-[30%]">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng</span>
                                <span className="text-2xl font-bold text-slate-800 font-mono leading-none">{stats.validBookings}</span>
                            </div>
                        </div>
                    </div>

                    {/* Phân bổ Trạng thái */}
                    <div className="flex-1 bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col relative overflow-hidden">
                        <h3 className="text-base font-bold text-slate-800 mb-4 z-10 relative">Trạng thái Đặt phòng</h3>
                        <div className="flex-1 relative z-10 min-h-[120px]">
                            <canvas ref={statusChartRef}></canvas>
                        </div>
                    </div>

                </div>
            </div>

            {/* Khu vực Bảng (Tables) & Biểu đồ thanh ngang */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Top 5 Dịch vụ */}
                <div className="xl:col-span-1 bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm flex flex-col h-[400px]">
                    <h3 className="text-xl font-bold text-slate-800 mb-1">Top Dịch Vụ Phụ Thu</h3>
                    <p className="text-xs text-slate-500 mb-6">Xếp hạng dịch vụ được sử dụng nhiều nhất</p>

                    <div className="flex-1 relative">
                        <canvas ref={serviceChartRef}></canvas>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-semibold text-slate-500">Tổng thu Dịch vụ</span>
                            <span className="font-bold text-purple-600 font-mono text-lg">{formatCurrency(stats.servicesRev)}</span>
                        </div>
                    </div>
                </div>

                {/* Bảng Hóa đơn mới nhất */}
                <div className="xl:col-span-2 bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col h-[400px]">
                    <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center shrink-0">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 mb-1">Giao dịch Gần đây</h3>
                            <p className="text-xs text-slate-500">5 hóa đơn thanh toán thành công mới nhất</p>
                        </div>
                        <button onClick={() => window.location.href = '/admin/invoices'} className="text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline">
                            Xem tất cả
                        </button>
                    </div>

                    <div className="flex-1 overflow-x-auto p-1">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead className="bg-slate-50/50 text-[11px] uppercase tracking-wider text-slate-500 border-y border-slate-100">
                                <tr>
                                    <th className="px-6 py-3 font-bold">Khách hàng</th>
                                    <th className="px-6 py-3 font-bold">Mã Hóa Đơn</th>
                                    <th className="px-6 py-3 font-bold">Ngày Lập</th>
                                    <th className="px-6 py-3 font-bold text-right">Tổng Tiền</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-slate-100 bg-white">
                                {recentInvoices.length > 0 ? recentInvoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800 text-[14px]">{inv.customerName || "Khách hàng"}</div>
                                            <div className="text-[11px] text-slate-500 mt-0.5">Phòng {inv.roomCode}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                                #{inv.id.slice(-8).toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 font-medium">
                                            {formatDate(inv.createdAt)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-mono font-bold text-emerald-600 text-base">{formatCurrency(inv.total)}</span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center text-slate-500">Chưa có giao dịch nào được ghi nhận.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* Modal Xuất Báo Cáo Chi Tiết */}
            {isReportModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl animate-in zoom-in duration-300 border border-slate-100">
                        <div className="p-6 md:p-8">
                            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                                <h3 className="text-2xl font-playfair font-bold text-slate-900 flex items-center gap-2">
                                    <i className="fa-solid fa-file-export text-indigo-600"></i> Xuất Báo Cáo
                                </h3>
                                <button onClick={() => setIsReportModalOpen(false)} className="text-slate-400 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center transition-all"><i className="fa-solid fa-xmark text-xl"></i></button>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Chuyên mục cần xuất</label>
                                    <select
                                        value={reportConfig.type}
                                        onChange={e => setReportConfig({ ...reportConfig, type: e.target.value })}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium text-slate-700 cursor-pointer"
                                    >
                                        <option value="revenue">Báo cáo Doanh thu (Kế toán)</option>
                                        <option value="bookings">Danh sách Đặt phòng (Lễ tân)</option>
                                        <option value="customers">Dữ liệu Khách hàng (Marketing)</option>
                                        <option value="services">Thống kê Dịch vụ (F&B / Spa)</option>
                                        <option value="staff">Hồ sơ Nhân sự (HR)</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Từ ngày</label>
                                        <input type="date" value={reportConfig.from} onChange={e => setReportConfig({ ...reportConfig, from: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium text-slate-700" />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Đến ngày</label>
                                        <input type="date" value={reportConfig.to} onChange={e => setReportConfig({ ...reportConfig, to: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium text-slate-700" />
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <label className="block text-[13px] font-semibold text-slate-600 mb-2">Định dạng File</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className={`flex items-center space-x-3 p-3 border rounded-xl cursor-pointer transition-all ${reportConfig.format === 'excel' ? 'bg-emerald-50 border-emerald-500' : 'bg-white hover:bg-slate-50 border-slate-200'}`}>
                                            <input type="radio" name="format" value="excel" checked={reportConfig.format === 'excel'} onChange={() => setReportConfig({ ...reportConfig, format: 'excel' })} className="hidden" />
                                            <i className={`fa-solid fa-file-excel text-2xl ${reportConfig.format === 'excel' ? 'text-emerald-600' : 'text-slate-400'}`}></i>
                                            <div>
                                                <p className={`font-bold text-sm ${reportConfig.format === 'excel' ? 'text-emerald-700' : 'text-slate-700'}`}>Excel (XLSX)</p>
                                            </div>
                                        </label>
                                        <label className={`flex items-center space-x-3 p-3 border rounded-xl cursor-pointer transition-all ${reportConfig.format === 'csv' ? 'bg-blue-50 border-blue-500' : 'bg-white hover:bg-slate-50 border-slate-200'}`}>
                                            <input type="radio" name="format" value="csv" checked={reportConfig.format === 'csv'} onChange={() => setReportConfig({ ...reportConfig, format: 'csv' })} className="hidden" />
                                            <i className={`fa-solid fa-file-csv text-2xl ${reportConfig.format === 'csv' ? 'text-blue-600' : 'text-slate-400'}`}></i>
                                            <div>
                                                <p className={`font-bold text-sm ${reportConfig.format === 'csv' ? 'text-blue-700' : 'text-slate-700'}`}>Data (CSV)</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100 mt-6">
                                    <button type="button" onClick={() => setIsReportModalOpen(false)} className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">Hủy</button>
                                    <button onClick={handleExportReportDetail} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all flex items-center">
                                        <i className="fa-solid fa-download mr-2"></i>Tải xuống
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
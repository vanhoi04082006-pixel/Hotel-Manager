// src/app/admin/page.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import Chart from "chart.js/auto";

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        arrivalsToday: 0,
        checkOutsToday: 0,
        maintenanceRooms: 0,
        occupancyRate: 0,
        totalRevenue: 0,
    });

    const [rooms, setRooms] = useState([]);
    const [activeBookings, setActiveBookings] = useState([]);
    const [recentLogs, setRecentLogs] = useState([]);
    const [recentReviews, setRecentReviews] = useState([]);
    const [loading, setLoading] = useState(true);

    const mainChartRef = useRef(null);
    const radarChartRef = useRef(null);
    const mainChartInstance = useRef(null);
    const radarChartInstance = useRef(null);

    useEffect(() => {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

        // Lắng nghe dữ liệu Rooms
        const unsubscribeRooms = onSnapshot(collection(db, "rooms"), (snap) => {
            const loadedRooms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setRooms(loadedRooms.sort((a, b) => parseInt((a.code || '').replace(/\D/g, '')) - parseInt((b.code || '').replace(/\D/g, ''))));
        });

        // Lắng nghe dữ liệu Bookings
        const unsubscribeBookings = onSnapshot(collection(db, "bookings"), (snap) => {
            const loadedBookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setActiveBookings(loadedBookings.filter(b => b.status !== "cancelled" && b.checkIn <= todayStr && todayStr < b.checkOut));

            const arrivals = loadedBookings.filter(b => b.checkIn === todayStr).length;
            const checkOuts = loadedBookings.filter(b => b.checkOut === todayStr).length;

            const confirmedBookings = loadedBookings.filter(b => b.status === "completed" || b.status === "confirmed");
            const revenue = confirmedBookings.reduce((s, b) => s + (b.finalPaidAmount || b.totalPrice || 0), 0);

            setStats(prev => ({ ...prev, arrivalsToday: arrivals, checkOutsToday: checkOuts, totalRevenue: revenue }));
        });

        // Lắng nghe Logs
        const unsubscribeLogs = onSnapshot(collection(db, "logs"), (snap) => {
            setRecentLogs(snap.docs.map(d => d.data()).sort((a, b) => b.timestamp - a.timestamp).slice(0, 5));
        });

        // Lắng nghe Reviews
        const unsubscribeReviews = onSnapshot(collection(db, "reviews"), (snap) => {
            setRecentReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt).slice(0, 3));
        });

        setTimeout(() => setLoading(false), 500);

        return () => {
            unsubscribeRooms();
            unsubscribeBookings();
            unsubscribeLogs();
            unsubscribeReviews();
        };
    }, []);

    // Tính tỷ lệ lấp đầy dựa trên Booking thực tế
    useEffect(() => {
        if (rooms.length > 0) {
            const maintenance = rooms.filter(r => r.status === "maintenance").length;
            const occupiedRoomIds = activeBookings.map(b => b.roomId);

            let occupiedCount = 0;
            rooms.forEach(r => {
                if (r.status !== 'maintenance' && (r.status === 'occupied' || occupiedRoomIds.includes(r.id))) {
                    occupiedCount++;
                }
            });

            const rate = ((occupiedCount / rooms.length) * 100).toFixed(1);
            setStats(prev => ({ ...prev, maintenanceRooms: maintenance, occupancyRate: rate }));
        }
    }, [rooms, activeBookings]);

    // Vẽ biểu đồ
    useEffect(() => {
        if (loading) return;

        if (mainChartInstance.current) mainChartInstance.current.destroy();
        if (radarChartInstance.current) radarChartInstance.current.destroy();

        const mainCtx = mainChartRef.current?.getContext("2d");
        const radarCtx = radarChartRef.current?.getContext("2d");

        if (mainCtx) {
            const gradientBlue = mainCtx.createLinearGradient(0, 0, 0, 400);
            gradientBlue.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
            gradientBlue.addColorStop(1, 'rgba(59, 130, 246, 0.1)');

            const gradientPurple = mainCtx.createLinearGradient(0, 0, 0, 400);
            gradientPurple.addColorStop(0, 'rgba(139, 92, 246, 0.9)');
            gradientPurple.addColorStop(1, 'rgba(139, 92, 246, 0.2)');

            mainChartInstance.current = new Chart(mainCtx, {
                type: 'bar',
                data: {
                    labels: ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'],
                    datasets: [
                        {
                            type: 'line', label: 'Lợi nhuận gộp', data: [1.6, 2.4, 2.0, 3.2, 4.4, 5.2, 4.8].map(v => v * 1000000),
                            borderColor: '#10b981', backgroundColor: '#10b981', borderWidth: 3, tension: 0.4,
                            pointBackgroundColor: '#fff', pointBorderColor: '#10b981', pointRadius: 4
                        },
                        {
                            type: 'bar', label: 'Tiền Phòng', data: [1.5, 2.2, 1.8, 2.5, 3.8, 4.5, 4.0].map(v => v * 1000000),
                            backgroundColor: gradientBlue, borderRadius: 8
                        },
                        {
                            type: 'bar', label: 'Dịch vụ thêm', data: [0.5, 0.8, 0.7, 1.2, 1.5, 2.0, 1.8].map(v => v * 1000000),
                            backgroundColor: gradientPurple, borderRadius: 8
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        y: { stacked: true, grid: { borderDash: [5, 5] }, ticks: { callback: v => (v / 1000000) + 'M' } },
                        x: { stacked: true, grid: { display: false } }
                    }
                }
            });
        }

        if (radarCtx) {
            radarChartInstance.current = new Chart(radarCtx, {
                type: 'radar',
                data: {
                    labels: ['Nhà hàng', 'Spa', 'Đưa đón SB', 'Giặt ủi', 'Mini Bar', 'Phòng Gym'],
                    datasets: [{
                        label: 'Tháng này', data: [85, 65, 40, 70, 90, 35],
                        backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3b82f6', borderWidth: 2, pointBackgroundColor: '#fff'
                    }, {
                        label: 'Tháng trước', data: [75, 50, 45, 60, 80, 30],
                        backgroundColor: 'rgba(168, 85, 247, 0.2)', borderColor: '#a855f7', borderWidth: 2, borderDash: [5, 5]
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: { r: { ticks: { display: false, min: 0, max: 100 } } }
                }
            });
        }
    }, [loading]);

    if (loading) return <div className="flex justify-center py-20"><div className="loader border-blue-500"></div></div>;

    return (
        <div className="fade-in space-y-6 pb-12 max-w-[1600px] mx-auto">
            {/* Banner */}
            <div className="relative overflow-hidden rounded-[1.5rem] md:rounded-3xl bg-slate-900 text-white p-6 md:p-8 shadow-2xl">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542314831-c6a4d27ce66b?q=80&w=1200')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 to-purple-900/40"></div>
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="w-full lg:w-auto">
                        <h2 className="text-2xl md:text-3xl font-playfair font-bold mb-2">Chào mừng trở lại, Admin! ✨</h2>
                        <p className="text-blue-200 text-sm md:text-base">Hệ thống đang hoạt động tối ưu. Hôm nay có <strong className="text-white">{stats.arrivalsToday}</strong> khách dự kiến check-in.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        <Link href="/admin/bookings" className="w-full sm:w-auto justify-center px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/30 backdrop-blur-md font-bold transition-all shadow-lg flex items-center">
                            <i className="fa-solid fa-calendar-plus mr-2 text-blue-300"></i> Đặt phòng mới
                        </Link>
                        <button className="w-full sm:w-auto justify-center px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 font-bold transition-all shadow-lg flex items-center">
                            <i className="fa-solid fa-bolt mr-2 text-yellow-300"></i> Xử lý nhanh
                        </button>
                    </div>
                </div>
            </div>

            {/* 4 Thẻ Thống Kê */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <div className="ultra-glass rounded-2xl md:rounded-3xl p-5 md:p-6 hover:-translate-y-1 transition-transform border border-slate-200 bg-white">
                    <div className="flex justify-between items-start mb-2">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600"><i className="fa-solid fa-wallet text-lg md:text-xl"></i></div>
                        <span className="text-[10px] md:text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md">+15.2%</span>
                    </div>
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Tổng doanh thu</p>
                    <p className="text-xl md:text-2xl font-bold text-slate-800 mt-1 font-mono">{formatCurrency(stats.totalRevenue)}</p>
                </div>

                <div className="ultra-glass rounded-2xl md:rounded-3xl p-5 md:p-6 hover:-translate-y-1 transition-transform relative overflow-hidden border border-slate-200 bg-white">
                    <div className="absolute right-[-20px] top-[-20px] opacity-5 text-purple-600"><i className="fa-solid fa-bed text-7xl md:text-8xl"></i></div>
                    <div className="flex justify-between items-start mb-2">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600"><i className="fa-solid fa-chart-simple text-lg md:text-xl"></i></div>
                    </div>
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Công suất phòng</p>
                    <div className="flex items-end mt-1">
                        <p className="text-xl md:text-2xl font-bold text-slate-800 font-mono">{stats.occupancyRate}%</p>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden ml-3 mb-1.5 md:mb-2">
                            <div className="bg-purple-500 h-full rounded-full" style={{ width: `${stats.occupancyRate}%` }}></div>
                        </div>
                    </div>
                </div>

                <div className="ultra-glass rounded-2xl md:rounded-3xl p-5 md:p-6 hover:-translate-y-1 transition-transform border border-slate-200 bg-white">
                    <div className="flex justify-between items-start mb-2">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600"><i className="fa-solid fa-bell-concierge text-lg md:text-xl"></i></div>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">HÔM NAY</span>
                    </div>
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Hoạt động lễ tân</p>
                    <div className="flex gap-4 mt-1">
                        <div><span className="text-xl md:text-2xl font-bold text-slate-800">{stats.arrivalsToday}</span> <span className="text-[10px] md:text-xs text-slate-500">In</span></div>
                        <div className="w-px bg-slate-200"></div>
                        <div><span className="text-xl md:text-2xl font-bold text-slate-800">{stats.checkOutsToday}</span> <span className="text-[10px] md:text-xs text-slate-500">Out</span></div>
                    </div>
                </div>

                <div className="ultra-glass rounded-2xl md:rounded-3xl p-5 md:p-6 hover:-translate-y-1 transition-transform border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
                    <div className="flex justify-between items-start mb-2">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-white/10 rounded-xl flex items-center justify-center text-white"><i className="fa-solid fa-broom text-lg md:text-xl"></i></div>
                        <span className="text-[10px] font-bold text-red-300 bg-red-900/50 px-2 py-1 rounded-md border border-red-500/30">CẦN XỬ LÝ</span>
                    </div>
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Dọn dẹp & Bảo trì</p>
                    <p className="text-xl md:text-2xl font-bold text-white mt-1 font-mono">{stats.maintenanceRooms} <span className="text-xs md:text-sm font-normal text-slate-300">phòng</span></p>
                </div>
            </div>

            {/* Biểu đồ & Sơ đồ 3D */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
                <div className="xl:col-span-2 ultra-glass rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 bg-white">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg md:text-xl font-bold text-slate-800">Hiệu suất tài chính</h3>
                            <p className="text-[10px] md:text-xs text-slate-500 mt-1">Phân tích tiền phòng & dịch vụ</p>
                        </div>
                        <button className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"><i className="fa-solid fa-download mr-1"></i> <span className="hidden sm:inline">Báo cáo</span></button>
                    </div>
                    {/* Thêm min-h để biểu đồ hiển thị tốt trên mobile */}
                    <div className="h-64 md:h-80 w-full min-h-[250px]"><canvas ref={mainChartRef}></canvas></div>
                </div>

                <div className="xl:col-span-1 ultra-glass rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 bg-white flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm md:text-base font-bold text-slate-800"><i className="fa-solid fa-cubes text-blue-500 mr-2"></i>Sơ đồ vật lý 3D</h3>
                    </div>
                    {/* Chuyển grid-cols-5 thành responsive để tránh vỡ trên đt */}
                    <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-5 gap-2 md:gap-2.5 overflow-y-auto max-h-[250px] md:max-h-[320px] custom-scroll pr-1 md:pr-2 pb-2">
                        {rooms.map(r => {
                            const occupiedRoomIds = activeBookings.map(b => b.roomId);
                            const isActuallyOccupied = r.status !== 'maintenance' && (r.status === 'occupied' || occupiedRoomIds.includes(r.id));
                            const displayStatus = r.status === 'maintenance' ? 'maintenance' : (isActuallyOccupied ? 'occupied' : 'available');

                            return (
                                <div key={r.id} className={`aspect-square rounded-xl flex items-center justify-center text-[10px] md:text-xs font-bold font-mono cursor-pointer room-cube ${displayStatus} relative group border border-slate-200/50 hover:border-white`}>
                                    {r.code}
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2.5 py-1.5 rounded shadow-xl opacity-0 xl:group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-50 text-center hidden md:block">
                                        {r.name}<br /><span className="text-blue-300">{formatCurrency(r.price)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between px-1 md:px-2">
                        <div className="text-center">
                            <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded bg-blue-600 mx-auto mb-1 shadow-inner"></div>
                            <span className="text-[9px] md:text-[10px] text-slate-500 font-bold">ĐANG Ở</span>
                        </div>

                        <div className="text-center">
                            <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded bg-white border border-slate-300 mx-auto mb-1 shadow-inner"></div>
                            <span className="text-[9px] md:text-[10px] text-slate-500 font-bold">TRỐNG</span>
                        </div>

                        <div className="text-center">
                            <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded bg-amber-300 mx-auto mb-1 shadow-inner"></div>
                            <span className="text-[9px] md:text-[10px] text-slate-500 font-bold">BẢO TRÌ</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Thao tác nhanh & Checklist */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                <div className="ultra-glass rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 bg-white">
                    <h3 className="text-sm md:text-base font-bold text-slate-800 mb-4"><i className="fa-solid fa-bolt text-yellow-500 mr-2"></i>Thao tác nhanh</h3>
                    <div className="grid grid-cols-2 gap-2 md:gap-3">
                        <Link href="/admin/bookings" className="flex flex-col items-center justify-center p-3 md:p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all group">
                            <i className="fa-solid fa-key text-xl md:text-2xl text-slate-400 group-hover:text-blue-500 mb-2 transition-colors"></i>
                            <span className="text-[10px] md:text-xs font-bold text-slate-600 group-hover:text-blue-600">Check-in</span>
                        </Link>
                        <Link href="/admin/invoices" className="flex flex-col items-center justify-center p-3 md:p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-600 transition-all group">
                            <i className="fa-solid fa-file-invoice-dollar text-xl md:text-2xl text-slate-400 group-hover:text-purple-500 mb-2 transition-colors"></i>
                            <span className="text-[10px] md:text-xs font-bold text-slate-600 group-hover:text-purple-600">Xuất hóa đơn</span>
                        </Link>
                        <Link href="/admin/customers" className="flex flex-col items-center justify-center p-3 md:p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 transition-all group">
                            <i className="fa-solid fa-id-card text-xl md:text-2xl text-slate-400 group-hover:text-emerald-500 mb-2 transition-colors"></i>
                            <span className="text-[10px] md:text-xs font-bold text-slate-600 group-hover:text-emerald-600">Khách hàng</span>
                        </Link>
                        <Link href="/admin/promotions" className="flex flex-col items-center justify-center p-3 md:p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-pink-50 hover:border-pink-200 hover:text-pink-600 transition-all group">
                            <i className="fa-solid fa-ticket text-xl md:text-2xl text-slate-400 group-hover:text-pink-500 mb-2 transition-colors"></i>
                            <span className="text-[10px] md:text-xs font-bold text-slate-600 group-hover:text-pink-600">Tạo mã KM</span>
                        </Link>
                    </div>
                </div>

                <div className="ultra-glass rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 bg-white flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm md:text-base font-bold text-slate-800"><i className="fa-solid fa-clipboard-list text-indigo-500 mr-2"></i>Công việc bộ phận</h3>
                        <span className="bg-indigo-100 text-indigo-600 text-[10px] px-2 py-0.5 rounded font-bold">3 VIỆC</span>
                    </div>
                    <div className="flex-1 space-y-2 md:space-y-3 custom-scroll overflow-y-auto max-h-[200px] md:max-h-[220px]">
                        <label className="flex items-start p-2.5 md:p-3 border border-slate-100 rounded-xl cursor-pointer task-item bg-white hover:border-blue-200 transition-all">
                            <input type="checkbox" className="mt-1 border-slate-300 rounded text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 flex-shrink-0" />
                            <div className="ml-3 flex-1 min-w-0">
                                <p className="text-xs md:text-sm font-bold text-slate-700 truncate">Dọn phòng P201 (Check-out)</p>
                                <p className="text-[9px] md:text-[10px] text-slate-400 mt-0.5 truncate"><i className="fa-regular fa-clock mr-1"></i>Ưu tiên cao • Buồng phòng</p>
                            </div>
                            <span className="text-[9px] md:text-[10px] px-2 py-1 rounded bg-amber-100 text-amber-700 font-bold ml-2 flex-shrink-0">CHỜ</span>
                        </label>
                        <label className="flex items-start p-2.5 md:p-3 border border-slate-100 rounded-xl cursor-pointer task-item bg-white hover:border-blue-200 transition-all">
                            <input type="checkbox" className="mt-1 border-slate-300 rounded text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 flex-shrink-0" />
                            <div className="ml-3 flex-1 min-w-0">
                                <p className="text-xs md:text-sm font-bold text-slate-700 truncate">Kiểm tra điều hòa P105</p>
                                <p className="text-[9px] md:text-[10px] text-slate-400 mt-0.5 truncate"><i className="fa-regular fa-clock mr-1"></i>Trước 14:00 • Bảo trì</p>
                            </div>
                            <span className="text-[9px] md:text-[10px] px-2 py-1 rounded bg-amber-100 text-amber-700 font-bold ml-2 flex-shrink-0">CHỜ</span>
                        </label>
                        <label className="flex items-start p-2.5 md:p-3 border border-slate-100 rounded-xl cursor-pointer task-item bg-white hover:border-blue-200 transition-all">
                            <input type="checkbox" className="mt-1 border-slate-300 rounded text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 flex-shrink-0" />
                            <div className="ml-3 flex-1 min-w-0">
                                <p className="text-xs md:text-sm font-bold text-slate-700 truncate">Setup trái cây phòng VIP</p>
                                <p className="text-[9px] md:text-[10px] text-slate-400 mt-0.5 truncate"><i className="fa-regular fa-clock mr-1"></i>Khách đến lúc 15:00 • F&B</p>
                            </div>
                            <span className="text-[9px] md:text-[10px] px-2 py-1 rounded bg-amber-100 text-amber-700 font-bold ml-2 flex-shrink-0">CHỜ</span>
                        </label>
                    </div>
                </div>

                <div className="ultra-glass rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 bg-white">
                    <h3 className="text-sm md:text-base font-bold text-slate-800 mb-1">Mức độ quan tâm dịch vụ</h3>
                    <p className="text-[10px] md:text-xs text-slate-500 mb-2">Thống kê từ hành vi khách hàng</p>
                    <div className="h-40 md:h-48 relative"><canvas ref={radarChartRef}></canvas></div>
                </div>
            </div>

            {/* Logs & Reviews */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <div className="ultra-glass rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 bg-white flex flex-col">
                    <div className="flex justify-between items-center mb-4 md:mb-5">
                        <h3 className="text-sm md:text-base font-bold text-slate-800"><i className="fa-solid fa-star text-amber-400 mr-2"></i>Đánh giá mới nhất</h3>
                        <Link href="/admin/reviews" className="text-[10px] md:text-xs text-blue-600 font-bold hover:underline">Xem tất cả</Link>
                    </div>
                    <div className="space-y-3 md:space-y-4 custom-scroll overflow-y-auto max-h-[250px] md:max-h-[300px] pr-1 md:pr-2">
                        {recentReviews.length > 0 ? recentReviews.map(r => (
                            <div key={r.id} className="p-3 md:p-4 bg-white rounded-xl md:rounded-2xl border border-slate-100 hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-200 flex justify-center items-center font-bold text-slate-600 text-[10px] md:text-xs">
                                            {(r.userName || 'K').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-xs md:text-sm font-bold text-slate-800">{r.anonymous ? 'Ẩn danh' : r.userName}</p>
                                            <div className="flex text-amber-400 text-[8px] md:text-[10px] mt-0.5">
                                                {Array(5).fill(0).map((_, i) => (
                                                    <i key={i} className={`fa-solid fa-star ${i < (r.rating || 5) ? '' : 'text-slate-200'}`}></i>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-[9px] md:text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 md:px-2 md:py-1 rounded border border-slate-100">Phòng {r.roomCode}</span>
                                </div>
                                <p className="text-xs md:text-sm text-slate-600 line-clamp-2 italic">"{r.content}"</p>
                            </div>
                        )) : <div className="text-center py-10 text-slate-400"><i className="fa-regular fa-comment-dots text-2xl md:text-3xl mb-2"></i><p className="text-xs md:text-sm">Chưa có đánh giá nào</p></div>}
                    </div>
                </div>

                <div className="ultra-glass rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 bg-white flex flex-col">
                    <div className="flex justify-between items-center mb-4 md:mb-5">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm md:text-base font-bold text-slate-800">Hoạt động hệ thống</h3>
                            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
                        </div>
                        <Link href="/admin/logs" className="text-[10px] md:text-xs text-slate-500 hover:text-slate-800"><i className="fa-solid fa-expand"></i> Mở rộng</Link>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[250px] md:max-h-[300px] custom-scroll pl-1 md:pl-2">
                        <div className="relative border-l border-slate-200 ml-2 md:ml-3 space-y-5 md:space-y-6 pb-2">
                            {recentLogs.length > 0 ? recentLogs.map((log, i) => {
                                const time = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp || 0);
                                const styleMap = {
                                    success: { icon: 'fa-check', colors: 'text-emerald-500 bg-emerald-100 border-emerald-200' },
                                    warning: { icon: 'fa-exclamation', colors: 'text-amber-500 bg-amber-100 border-amber-200' },
                                    error: { icon: 'fa-xmark', colors: 'text-red-500 bg-red-100 border-red-200' },
                                    info: { icon: 'fa-info', colors: 'text-blue-500 bg-blue-100 border-blue-200' }
                                };
                                const logStyle = styleMap[log.type] || styleMap['info'];

                                return (
                                    <div key={i} className="relative pl-5 md:pl-6 group">
                                        <div className={`absolute -left-[14px] md:-left-[17px] top-1 w-6 h-6 md:w-8 md:h-8 rounded-full ${logStyle.colors} border flex items-center justify-center shadow-sm transition-transform group-hover:scale-110`}>
                                            <i className={`fa-solid ${logStyle.icon} text-[10px] md:text-xs`}></i>
                                        </div>
                                        <div className="bg-white p-2.5 md:p-3 rounded-xl border border-slate-100 shadow-sm group-hover:shadow-md transition-all">
                                            <p className="text-xs md:text-sm font-medium text-slate-800">{log.message}</p>
                                            <div className="flex justify-between mt-1">
                                                <p className="text-[9px] md:text-[10px] text-slate-400"><i className="fa-regular fa-user mr-1"></i>{log.user || 'Hệ thống'}</p>
                                                <p className="text-[9px] md:text-[10px] text-slate-400">{time.toLocaleTimeString('vi-VN')}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }) : <p className="text-xs md:text-sm text-slate-400 ml-4">Đang chờ tín hiệu hệ thống...</p>}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
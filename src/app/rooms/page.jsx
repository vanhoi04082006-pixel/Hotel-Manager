// src/app/rooms/page.jsx
"use client";

import { useState, useEffect, useMemo, Suspense, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

function RoomsContent() {
    const router = useRouter();

    // State Dữ liệu
    const [allRooms, setAllRooms] = useState([]);
    const [activeBookings, setActiveBookings] = useState([]);
    
    // States Loading
    const [loading, setLoading] = useState(true);
    const [isPageLoaded, setIsPageLoaded] = useState(false);

    // State Tìm kiếm & Lọc
    const [searchQuery, setSearchQuery] = useState("");
    const [filterCheckIn, setFilterCheckIn] = useState("");
    const [filterCheckOut, setFilterCheckOut] = useState("");
    const [currentFilter, setCurrentFilter] = useState("All");

    // State Phân trang & Ref cuộn trang
    const [currentPage, setCurrentPage] = useState(1);
    const roomsPerPage = 6;
    const listRef = useRef(null);

    // 1. Fetch dữ liệu khi load trang
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [roomsSnap, bookingsSnap] = await Promise.all([
                    getDocs(collection(db, "rooms")),
                    getDocs(collection(db, "bookings"))
                ]);

                const loadedRooms = roomsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                loadedRooms.sort((a, b) => {
                    const numA = parseInt((a.code || "").replace(/\D/g, "")) || 0;
                    const numB = parseInt((b.code || "").replace(/\D/g, "")) || 0;
                    return numA - numB;
                });
                setAllRooms(loadedRooms);

                const bookings = bookingsSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(b => b.status !== "cancelled");
                setActiveBookings(bookings);
            } catch (error) {
                console.error("Lỗi tải dữ liệu:", error);
            } finally {
                setLoading(false);
                setTimeout(() => setIsPageLoaded(true), 600);
            }
        };

        fetchData();
    }, []);

    // 2. Logic Lọc Phòng bằng useMemo
    const filteredRooms = useMemo(() => {
        let result = [...allRooms];

        if (currentFilter !== "All") {
            result = result.filter(r => r.type === currentFilter);
        }

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(r =>
                r.code?.toLowerCase().includes(lowerQuery) ||
                r.name?.toLowerCase().includes(lowerQuery) ||
                r.type?.toLowerCase().includes(lowerQuery) ||
                r.description?.toLowerCase().includes(lowerQuery)
            );
        }

        if (filterCheckIn && filterCheckOut) {
            const reqIn = new Date(filterCheckIn).setHours(0, 0, 0, 0);
            const reqOut = new Date(filterCheckOut).setHours(0, 0, 0, 0);

            result = result.filter(room => {
                const isOccupied = activeBookings.some(b => {
                    if (b.roomId !== room.id) return false;
                    const bookIn = new Date(b.checkIn).setHours(0, 0, 0, 0);
                    const bookOut = new Date(b.checkOut).setHours(0, 0, 0, 0);
                    return reqIn < bookOut && bookIn < reqOut;
                });
                return !isOccupied;
            });
        }

        return result;
    }, [allRooms, currentFilter, searchQuery, filterCheckIn, filterCheckOut, activeBookings]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, currentFilter, filterCheckIn, filterCheckOut]);

    // 3. Phân trang
    const paginatedRooms = filteredRooms.slice((currentPage - 1) * roomsPerPage, currentPage * roomsPerPage);
    const totalPages = Math.ceil(filteredRooms.length / roomsPerPage);

    const handlePageChange = (page) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
        if (listRef.current) {
            listRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    // 4. Hàm chuyển hướng sang trang Checkout
    const handleBookRoom = (roomId) => {
        let queryParams = `?roomId=${roomId}`;
        if (filterCheckIn) queryParams += `&checkIn=${filterCheckIn}`;
        if (filterCheckOut) queryParams += `&checkOut=${filterCheckOut}`;
        
        router.push(`/booking${queryParams}`);
    };

    const today = new Date().toISOString().split("T")[0];

    return (
        <>
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes popInItem { 0% { opacity: 0; transform: scale(0.95) translateY(20px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .animate-item { opacity: 0; animation: popInItem 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .ultra-glass-pill {
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 1);
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);
                }
                .custom-loader {
                    border: 3px solid #e2e8f0;
                    border-top: 3px solid #2563eb;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                }
            `}} />

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

            <div className={`font-sans text-slate-800 bg-[#f8fafc] min-h-screen transition-opacity duration-1000 ${isPageLoaded ? "opacity-100" : "opacity-0"}`}>
                <Header />
                
                <main className="user-main pb-24">
                    {/* Banner & Form Tìm kiếm */}
                    <div className="hero-section py-24 md:py-36 flex items-center justify-center relative" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=2000&auto=format&fit=crop')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
                        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 to-black/70"></div>
                        
                        <div className="max-w-4xl mx-auto px-4 text-center relative z-10 w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
                            <span className="inline-block py-1.5 px-4 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30 text-xs font-bold tracking-widest uppercase mb-6 shadow-lg">
                                Luna Hotel & Resort
                            </span>
                            <h2 className="text-4xl md:text-6xl font-playfair font-bold text-white mb-6 drop-shadow-2xl leading-tight">
                                Tuyệt Tác Nghỉ Dưỡng <br /><span className="italic font-light">Bên Bờ Biển Xanh</span>
                            </h2>

                            <div className="max-w-4xl mx-auto mt-12 relative bg-white/20 backdrop-blur-lg p-3 rounded-[2rem] border border-white/30 shadow-2xl">
                                <div className="flex flex-col md:flex-row gap-3">
                                    <div className="relative flex-1">
                                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                        <input type="text" placeholder="Tên phòng, loại phòng..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-white/90 rounded-xl outline-none font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-4 focus:ring-blue-500/30 transition-all text-sm" />
                                    </div>
                                    <div className="relative flex-1">
                                        <i className="fa-solid fa-calendar-days absolute left-4 top-1/2 -translate-y-1/2 text-blue-500"></i>
                                        <input type="date" value={filterCheckIn} onChange={(e) => setFilterCheckIn(e.target.value)} min={today} className="w-full pl-11 pr-4 py-4 bg-white/90 rounded-xl outline-none font-medium text-slate-800 focus:bg-white focus:ring-4 focus:ring-blue-500/30 transition-all text-sm cursor-pointer" title="Ngày nhận phòng" />
                                    </div>
                                    <div className="relative flex-1">
                                        <i className="fa-solid fa-calendar-check absolute left-4 top-1/2 -translate-y-1/2 text-amber-500"></i>
                                        <input type="date" value={filterCheckOut} min={filterCheckIn || today} onChange={(e) => setFilterCheckOut(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-white/90 rounded-xl outline-none font-medium text-slate-800 focus:bg-white focus:ring-4 focus:ring-blue-500/30 transition-all text-sm cursor-pointer" title="Ngày trả phòng" />
                                    </div>
                                    {(searchQuery || filterCheckIn || filterCheckOut) && (
                                        <button onClick={() => { setSearchQuery(""); setFilterCheckIn(""); setFilterCheckOut(""); }} className="bg-slate-800 text-white px-5 py-4 rounded-xl font-bold hover:bg-rose-600 transition-all shadow-md shrink-0 flex items-center justify-center" title="Xóa bộ lọc">
                                            <i className="fa-solid fa-xmark"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Khung danh sách phòng */}
                    <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 -mt-8 relative z-20" ref={listRef}>
                        
                        {/* Nút lọc (Filter Buttons) */}
                        <div className="flex flex-nowrap md:flex-wrap overflow-x-auto hide-scrollbar justify-start md:justify-center gap-3 md:gap-4 mb-16 pb-2">
                            {["All", "Superior", "Deluxe", "Suite", "Family", "Standard", "Executive"].map(type => (
                                <button key={type} onClick={() => setCurrentFilter(type)}
                                    className={`px-6 py-3 rounded-full text-[14px] whitespace-nowrap transition-all duration-300 ${currentFilter === type ? 'font-bold bg-slate-900 text-white shadow-xl shadow-slate-900/20 transform scale-105' : 'font-medium bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:shadow-md'}`}>
                                    {type === "All" ? "Tất cả các hạng" : `Phòng ${type}`}
                                </button>
                            ))}
                        </div>

                        {/* Danh sách phòng */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
                            {loading ? (
                                <div className="col-span-3 text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100">
                                    <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-slate-500 font-medium">Đang tải bộ sưu tập phòng...</p>
                                </div>
                            ) : paginatedRooms.length === 0 ? (
                                <div className="col-span-3 text-center py-24 bg-white rounded-3xl border border-dashed border-slate-300 shadow-sm">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <i className="fa-solid fa-calendar-xmark text-3xl text-slate-300"></i>
                                    </div>
                                    <h3 className="text-2xl font-playfair font-bold text-slate-800 mb-2">Không tìm thấy phòng trống</h3>
                                    <p className="text-slate-500">Xin lỗi, không có phòng nào phù hợp với thời gian hoặc từ khóa bạn chọn.</p>
                                    <button onClick={() => { setSearchQuery(""); setFilterCheckIn(""); setFilterCheckOut(""); setCurrentFilter("All"); }} className="mt-6 px-6 py-2.5 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-600 hover:text-white transition-colors">
                                        Xóa bộ lọc
                                    </button>
                                </div>
                            ) : (
                                paginatedRooms.map((room, index) => {
                                    const isAvailable = room.status === "available";
                                    const statusText = room.status === "maintenance" ? "Đang bảo trì" : "Đã có khách";
                                    
                                    return (
                                        <div key={room.id} className={`bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col h-full transition-all duration-500 group animate-item relative ${!isAvailable ? 'opacity-80 grayscale-[20%]' : 'hover:shadow-[0_20px_40px_rgb(37,99,235,0.1)] hover:-translate-y-2'}`} style={{ animationDelay: `${index * 0.1}s` }}>
                                            
                                            {/* 1. KHUNG HÌNH ẢNH */}
                                            <div className="h-64 relative rounded-t-[2rem] overflow-hidden bg-slate-100 shrink-0">
                                                <img src={room.image || 'https://images.unsplash.com/photo-1611892440504-42a792e24d32'} className={`w-full h-full object-cover transition-transform duration-700 ${isAvailable ? 'group-hover:scale-110' : ''}`} alt={room.name} />
                                                
                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity"></div>
                                                
                                                {!isAvailable && (
                                                    <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px] z-10 flex items-center justify-center">
                                                        <span className="bg-white/95 backdrop-blur-md px-5 py-2.5 rounded-full font-bold text-slate-800 shadow-xl text-sm flex items-center gap-2 border border-white/20">
                                                            <i className={`fa-solid ${room.status === 'maintenance' ? 'fa-wrench text-amber-500' : 'fa-lock text-slate-400'}`}></i>{statusText}
                                                        </span>
                                                    </div>
                                                )}
                                                
                                                {/* Badge Top Left */}
                                                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-slate-800 shadow-sm z-20 flex items-center gap-1.5 border border-white/50">
                                                    <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-emerald-500 animate-pulse' : room.status === 'maintenance' ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                                                    {room.type}
                                                </div>
                                                
                                                {/* Badge Top Right */}
                                                <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center shadow-sm z-20 border border-white/20">
                                                    <i className="fa-solid fa-star text-amber-400 mr-1.5 text-[10px]"></i> 5.0
                                                </div>
                                            </div>

                                            {/* 2. CỤC GIÁ TIỀN */}
                                            <div className="absolute top-64 right-6 -translate-y-1/2 ultra-glass-pill px-5 py-2.5 rounded-2xl z-20 flex items-baseline gap-1.5 bg-white shadow-xl border border-slate-100">
                                                <span className="text-xl font-bold font-mono text-blue-600 tracking-tight">
                                                    {room.price.toLocaleString("vi-VN")}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">đ / Đêm</span>
                                            </div>

                                            {/* 3. KHUNG NỘI DUNG CHỮ */}
                                            <div className="p-6 md:p-8 pt-10 flex flex-col flex-grow relative z-10 bg-white rounded-b-[2rem]">
                                                <div className="flex justify-between items-start mb-3 pr-2">
                                                    <h3 className="text-2xl font-playfair font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors duration-300">Phòng {room.code}</h3>
                                                </div>
                                                
                                                <p className="text-slate-500 text-[14px] mb-6 line-clamp-2 leading-relaxed">
                                                    {room.name || room.description || 'Trải nghiệm không gian sang trọng và tiện nghi bậc nhất.'}
                                                </p>
                                                
                                                <div className="flex flex-wrap gap-2 text-[12px] text-slate-600 font-medium mb-8 mt-auto">
                                                    <span className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg flex items-center"><i className="fa-solid fa-expand text-blue-400 w-4 mr-1"></i>{room.area || 30}m²</span>
                                                    <span className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg flex items-center"><i className="fa-regular fa-user text-emerald-500 w-4 mr-1"></i>{room.capacity || 2} khách</span>
                                                    <span className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg flex items-center w-full mt-1"><i className="fa-solid fa-bed text-purple-400 w-4 mr-1.5"></i>{room.bedType || '1 giường King cỡ lớn'}</span>
                                                </div>
                                                
                                                {isAvailable ? (
                                                    <button onClick={() => handleBookRoom(room.id)} className="w-full text-center bg-slate-900 text-white py-4 rounded-xl font-bold text-[14px] hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-600/30 transition-all duration-300 transform group-hover:-translate-y-1">
                                                        Đặt phòng này
                                                    </button>
                                                ) : (
                                                    <button disabled className="w-full bg-slate-50 text-slate-400 py-4 rounded-xl font-bold text-[14px] cursor-not-allowed border border-slate-200">
                                                        {statusText}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Phân trang */}
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-2 mt-16 flex-wrap animate-item">
                                <button 
                                    onClick={() => handlePageChange(currentPage - 1)} 
                                    disabled={currentPage === 1}
                                    className="w-12 h-12 rounded-xl font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 disabled:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-sm"
                                >
                                    <i className="fa-solid fa-chevron-left text-sm"></i>
                                </button>

                                {Array.from({ length: totalPages }).map((_, i) => {
                                    const page = i + 1;
                                    if (page < currentPage - 2 || page > currentPage + 2) return null;

                                    return (
                                        <button
                                            key={page}
                                            onClick={() => handlePageChange(page)}
                                            className={`min-w-[48px] h-12 px-3 rounded-xl font-bold flex items-center justify-center transition-all ${currentPage === page ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30 scale-110 z-10' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 shadow-sm'}`}
                                        >
                                            {page}
                                        </button>
                                    );
                                })}

                                <button 
                                    onClick={() => handlePageChange(currentPage + 1)} 
                                    disabled={currentPage === totalPages}
                                    className="w-12 h-12 rounded-xl font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 disabled:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-sm"
                                >
                                    <i className="fa-solid fa-chevron-right text-sm"></i>
                                </button>
                            </div>
                        )}
                    </div>
                </main>
                
                <Footer />
            </div>
        </>
    );
}

export default function RoomsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>}>
            <RoomsContent />
        </Suspense>
    );
}
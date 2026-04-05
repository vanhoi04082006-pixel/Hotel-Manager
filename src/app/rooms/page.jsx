// src/app/rooms/page.jsx
"use client";

import { useState, useEffect, useMemo, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, addDoc, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// Hàm format tiền tệ
const formatCurrency = (amount) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
};

function RoomsContent() {
    const searchParams = useSearchParams();
    const bookIdFromUrl = searchParams.get("book");

    // State Dữ liệu
    const [currentUser, setCurrentUser] = useState(null);
    const [allRooms, setAllRooms] = useState([]);
    const [services, setServices] = useState([]);
    const [activeBookings, setActiveBookings] = useState([]);
    
    // States Loading
    const [loading, setLoading] = useState(true);
    const [isPageLoaded, setIsPageLoaded] = useState(false); // State cho màn hình Loading toàn cục

    // State Tìm kiếm & Lọc
    const [searchQuery, setSearchQuery] = useState("");
    const [filterCheckIn, setFilterCheckIn] = useState("");
    const [filterCheckOut, setFilterCheckOut] = useState("");
    const [currentFilter, setCurrentFilter] = useState("All");

    // State Phân trang & Ref cuộn trang
    const [currentPage, setCurrentPage] = useState(1);
    const roomsPerPage = 6;
    const listRef = useRef(null);

    // State Đặt phòng (Modal)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [bookedDates, setBookedDates] = useState([]);
    const [bookingForm, setBookingForm] = useState({
        guestName: "",
        guestEmail: "",
        guestPhone: "",
        checkInDate: "",
        checkOutDate: "",
        adultCount: 2,
        childCount: 0,
        specialRequests: "",
    });
    const [selectedServices, setSelectedServices] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ==========================================
    // STATE: TÙY CHỈNH THÔNG BÁO (THAY THẾ ALERT)
    // ==========================================
    const [notification, setNotification] = useState({
        show: false,
        title: "",
        message: "",
        type: "success" // "success", "error", "warning"
    });

    const showNotification = (title, message, type = "success") => {
        setNotification({ show: true, title, message, type });
    };

    const closeNotification = () => {
        setNotification(prev => ({ ...prev, show: false }));
    };

    // 1. Fetch dữ liệu khi load trang
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [roomsSnap, servicesSnap, bookingsSnap] = await Promise.all([
                    getDocs(collection(db, "rooms")),
                    getDocs(collection(db, "services")),
                    getDocs(collection(db, "bookings"))
                ]);

                const loadedRooms = roomsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Sắp xếp phòng theo số thứ tự P101, P102...
                loadedRooms.sort((a, b) => {
                    const numA = parseInt((a.code || "").replace(/\D/g, "")) || 0;
                    const numB = parseInt((b.code || "").replace(/\D/g, "")) || 0;
                    return numA - numB;
                });
                setAllRooms(loadedRooms);
                
                // Chỉ lấy các dịch vụ đang hoạt động
                setServices(servicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(s => s.available !== false));

                // Load active bookings để tính toán phòng trống
                const bookings = bookingsSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(b => b.status !== "cancelled");
                setActiveBookings(bookings);

                // Xử lý auto mở modal nếu có tham số ?book=id trên URL
                if (bookIdFromUrl) {
                    const roomToBook = loadedRooms.find(r => r.id === bookIdFromUrl);
                    if (roomToBook) {
                        if (roomToBook.status === "available") {
                            setTimeout(() => openBookingModal(roomToBook), 500);
                        } else {
                            showNotification("Phòng không khả dụng", "Phòng từ liên kết này hiện không có sẵn để đặt!", "warning");
                        }
                    }
                }
            } catch (error) {
                console.error("Lỗi tải dữ liệu:", error);
            } finally {
                setLoading(false);
                // Thêm độ trễ để hiệu ứng FadeOut của màn hình Loading trông mượt mà
                setTimeout(() => setIsPageLoaded(true), 600);
            }
        };

        fetchData();

        // Lắng nghe đăng nhập
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                const savedUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
                setCurrentUser({
                    uid: user.uid,
                    email: user.email,
                    name: savedUser.name || user.displayName || "",
                    phone: savedUser.phone || ""
                });
                setBookingForm(prev => ({
                    ...prev,
                    guestName: savedUser.name || user.displayName || "",
                    guestEmail: user.email || "",
                    guestPhone: savedUser.phone || ""
                }));
            } else {
                setCurrentUser(null);
            }
        });

        return () => unsubscribe();
    }, [bookIdFromUrl]);

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

    // Hàm chuyển trang và cuộn mượt lên danh sách
    const handlePageChange = (page) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
        if (listRef.current) {
            listRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    // 4. Modal Đặt Phòng
    const loadRoomBookedDates = async (roomId) => {
        const todayStr = new Date().toISOString().split("T")[0];
        const q = query(
            collection(db, "bookings"),
            where("roomId", "==", roomId),
            where("status", "in", ["pending", "confirmed", "completed"])
        );
        const snapshot = await getDocs(q);
        const dates = [];
        snapshot.forEach(docSnap => {
            const b = docSnap.data();
            if (b.checkOut >= todayStr) {
                dates.push({ checkIn: b.checkIn, checkOut: b.checkOut });
            }
        });
        setBookedDates(dates.sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn)));
    };

    const openBookingModal = (room) => {
        setCurrentRoom(room);
        setBookingForm(prev => ({
            ...prev,
            checkInDate: filterCheckIn || "",
            checkOutDate: filterCheckOut || "",
        }));

        // Đọc dữ liệu dịch vụ đã lưu (Dạng Mảng) từ sessionStorage
        const savedServicesStr = sessionStorage.getItem("selectedServices");
        const legacyServiceStr = sessionStorage.getItem("selectedService"); 

        if (savedServicesStr) {
            try {
                const parsed = JSON.parse(savedServicesStr);
                if (Array.isArray(parsed)) {
                    setSelectedServices(parsed.map(s => ({ id: s.id, name: s.name, price: s.price })));
                } else {
                    setSelectedServices([]);
                }
            } catch (error) {
                setSelectedServices([]);
            }
        } else if (legacyServiceStr) {
            try {
                const savedService = JSON.parse(legacyServiceStr);
                setSelectedServices([{ id: savedService.id, name: savedService.name, price: savedService.price }]);
            } catch (error) {
                setSelectedServices([]);
            }
        } else {
            setSelectedServices([]);
        }

        loadRoomBookedDates(room.id);
        setIsModalOpen(true);
    };

    // 5. Tính toán tiền tự động
    const calculation = useMemo(() => {
        if (!currentRoom || !bookingForm.checkInDate || !bookingForm.checkOutDate)
            return { nights: 0, roomTotal: 0, serviceTotal: 0, fee: 0, total: 0, isValid: false, error: "" };

        const start = new Date(bookingForm.checkInDate);
        const end = new Date(bookingForm.checkOutDate);
        const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

        if (nights <= 0) return { nights: 0, roomTotal: 0, serviceTotal: 0, fee: 0, total: 0, isValid: false, error: "Ngày trả phòng phải sau ngày nhận" };

        const reqIn = start.setHours(0, 0, 0, 0);
        const reqOut = end.setHours(0, 0, 0, 0);
        const isOverlap = bookedDates.some(range => {
            const bIn = new Date(range.checkIn).setHours(0, 0, 0, 0);
            const bOut = new Date(range.checkOut).setHours(0, 0, 0, 0);
            return reqIn < bOut && bIn < reqOut;
        });

        if (isOverlap) return { nights, roomTotal: 0, serviceTotal: 0, fee: 0, total: 0, isValid: false, error: "Khoảng thời gian này đã có người đặt!" };

        const roomTotal = currentRoom.price * nights;
        const serviceTotal = selectedServices.reduce((acc, s) => acc + s.price, 0);
        const fee = Math.round((roomTotal + serviceTotal) * 0.1);

        return { nights, roomTotal, serviceTotal, fee, total: roomTotal + serviceTotal + fee, isValid: true, error: "" };
    }, [currentRoom, bookingForm.checkInDate, bookingForm.checkOutDate, selectedServices, bookedDates]);

    // 6. Submit Booking
    const handleBookingSubmit = async (e) => {
        e.preventDefault();
        if (!calculation.isValid) {
            showNotification("Dữ liệu không hợp lệ", "Vui lòng kiểm tra lại ngày tháng hợp lệ!", "error");
            return;
        }

        setIsSubmitting(true);
        try {
            const q = query(
                collection(db, "bookings"),
                where("roomId", "==", currentRoom.id),
                where("status", "in", ["pending", "confirmed", "completed"])
            );
            const snapshot = await getDocs(q);
            let isOverlapDB = false;
            snapshot.forEach(docSnap => {
                const b = docSnap.data();
                if (bookingForm.checkInDate < b.checkOut && b.checkIn < bookingForm.checkOutDate) isOverlapDB = true;
            });

            if (isOverlapDB) {
                showNotification("Phòng đã được đặt", "Rất tiếc! Phòng này vừa có người đặt xong.", "warning");
                loadRoomBookedDates(currentRoom.id);
                setIsSubmitting(false);
                return;
            }

            const bookingData = {
                roomId: currentRoom.id,
                roomCode: currentRoom.code,
                userId: currentUser?.uid || "guest_" + Date.now(),
                userEmail: bookingForm.guestEmail,
                userName: bookingForm.guestName,
                userPhone: bookingForm.guestPhone,
                checkIn: bookingForm.checkInDate,
                checkOut: bookingForm.checkOutDate,
                nights: calculation.nights,
                adultCount: parseInt(bookingForm.adultCount),
                childCount: parseInt(bookingForm.childCount),
                services: selectedServices,
                roomPrice: currentRoom.price,
                roomTotal: calculation.roomTotal,
                serviceTotal: calculation.serviceTotal,
                serviceFee: calculation.fee,
                discount: 0,
                totalPrice: calculation.total,
                specialRequests: bookingForm.specialRequests,
                status: "pending",
                paymentStatus: "unpaid",
                isGuest: !currentUser,
                createdAt: new Date().toISOString()
            };

            const docRef = await addDoc(collection(db, "bookings"), bookingData);
            
            showNotification(
                "Đặt phòng thành công!", 
                `Tuyệt vời! Mã đặt phòng của bạn là: #${docRef.id.slice(-8).toUpperCase()}. Chúng tôi sẽ sớm liên hệ với bạn để xác nhận.`, 
                "success"
            );
            
            // Xóa dữ liệu tạm sau khi đặt xong (cả key cũ và mới)
            sessionStorage.removeItem("selectedServices");
            sessionStorage.removeItem("selectedService");
            
            setIsModalOpen(false);
            setActiveBookings(prev => [...prev, bookingData]);

        } catch (error) {
            showNotification("Lỗi hệ thống", "Có lỗi xảy ra trong quá trình đặt phòng: " + error.message, "error");
        } finally {
            setIsSubmitting(false);
        }
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

            {/* CUSTOM NOTIFICATION MODAL */}
            {notification.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 md:p-8 text-center animate-in zoom-in-95 duration-300">
                        {notification.type === 'success' && (
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
                                <i className="fa-solid fa-check text-4xl text-emerald-500"></i>
                            </div>
                        )}
                        {notification.type === 'error' && (
                            <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-5">
                                <i className="fa-solid fa-xmark text-4xl text-rose-500"></i>
                            </div>
                        )}
                        {notification.type === 'warning' && (
                            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
                                <i className="fa-solid fa-exclamation text-4xl text-amber-500"></i>
                            </div>
                        )}
                        
                        <h3 className="text-2xl font-bold text-slate-800 mb-3">{notification.title}</h3>
                        <p className="text-slate-600 mb-8 leading-relaxed">{notification.message}</p>
                        
                        <button 
                            onClick={closeNotification} 
                            className={`w-full py-3.5 rounded-xl font-bold text-white transition-all transform hover:-translate-y-1 ${
                                notification.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/30' :
                                notification.type === 'error' ? 'bg-rose-500 hover:bg-rose-600 hover:shadow-lg hover:shadow-rose-500/30' :
                                'bg-amber-500 hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-500/30'
                            }`}
                        >
                            Đã hiểu
                        </button>
                    </div>
                </div>
            )}

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

                    {/* Khung danh sách phòng có gán Ref để cuộn trang */}
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
                                                    <button onClick={() => openBookingModal(room)} className="w-full text-center bg-slate-900 text-white py-4 rounded-xl font-bold text-[14px] hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-600/30 transition-all duration-300 transform group-hover:-translate-y-1">
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

                {/* Booking Modal */}
                {isModalOpen && currentRoom && (
                    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col md:flex-row overflow-hidden relative animate-in fade-in zoom-in-95 duration-300 border border-slate-100">
                            
                            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 z-20 text-slate-400 hover:text-slate-800 hover:bg-slate-100 bg-white/80 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center transition-all hover:scale-110">
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>

                            {/* Cột trái: Thông tin phòng */}
                            <div className="w-full md:w-[45%] bg-gradient-to-b from-slate-50 to-blue-50/30 p-8 md:p-10 flex flex-col relative border-r border-slate-100 overflow-y-auto hide-scrollbar">
                                <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-widest mb-4 self-start shadow-sm">
                                    <i className="fa-solid fa-bed mr-2 text-blue-500"></i>Phòng <span className="ml-1">{currentRoom.code}</span>
                                </div>
                                
                                <h3 className="text-3xl font-playfair font-bold text-slate-900 mb-3 leading-tight">{currentRoom.name}</h3>
                                <div className="flex text-amber-400 text-xs mb-8"><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i></div>

                                <div className="space-y-4 mb-8 text-slate-600 text-[14px] bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="flex justify-between items-center"><span className="flex items-center text-slate-500"><i className="fa-solid fa-crown w-5 text-amber-500"></i> Phân hạng</span><span className="font-bold text-slate-800">{currentRoom.type}</span></div>
                                    <div className="flex justify-between items-center"><span className="flex items-center text-slate-500"><i className="fa-solid fa-user-group w-5 text-emerald-500"></i> Tối đa</span><span className="font-bold text-slate-800">{currentRoom.capacity} người</span></div>
                                    <div className="border-t border-slate-100 my-2 pt-2"></div>
                                    <div className="flex justify-between items-center"><span className="flex items-center text-slate-500"><i className="fa-solid fa-tag w-5 text-blue-500"></i> Giá gốc / Đêm</span><span className="font-bold text-blue-600 text-lg">{formatCurrency(currentRoom.price)}</span></div>
                                </div>

                                <div className="mt-auto bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 text-white relative overflow-hidden">
                                    <div className="absolute right-[-20px] top-[-20px] opacity-10 text-white"><i className="fa-solid fa-receipt text-8xl"></i></div>
                                    <h4 className="text-sm font-bold text-slate-200 mb-5 flex items-center relative z-10"><i className="fa-solid fa-file-invoice-dollar text-emerald-400 mr-2"></i>Tạm tính</h4>
                                    
                                    <div className="space-y-3 text-[13px] text-slate-300 relative z-10 font-medium">
                                        <div className="flex justify-between items-center"><span>Tiền phòng (<span className="text-white">{calculation.nights} đêm</span>)</span><span className="text-white">{formatCurrency(calculation.roomTotal)}</span></div>
                                        <div className="flex justify-between items-center"><span>Tiện ích kèm theo</span><span className="text-white">{formatCurrency(calculation.serviceTotal)}</span></div>
                                        <div className="flex justify-between items-center"><span>Thuế & Phí (10%)</span><span className="text-white">{formatCurrency(calculation.fee)}</span></div>
                                        
                                        <div className="border-t border-slate-700 mt-4 pt-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[11px] uppercase tracking-widest font-bold">Tổng Thanh Toán</span>
                                                <span className="text-2xl font-bold text-emerald-400 font-mono">{formatCurrency(calculation.total)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Cột phải: Form nhập */}
                            <div className="w-full md:w-[55%] p-8 md:p-10 overflow-y-auto bg-white custom-scroll">
                                <h3 className="text-2xl font-playfair font-bold text-slate-900 mb-2">Hoàn tất đặt phòng</h3>
                                <p className="text-sm text-slate-500 mb-8">Vui lòng điền thông tin bên dưới để giữ chỗ ngay lập tức.</p>

                                {bookedDates.length > 0 && (
                                    <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                                        <h4 className="text-sm font-bold text-amber-800 mb-2 flex items-center"><i className="fa-solid fa-calendar-xmark mr-2"></i>Lịch đã được đặt trước:</h4>
                                        <div className="flex flex-wrap gap-2 text-[12px] text-amber-700 font-medium">
                                            {bookedDates.map((d, i) => (
                                                <span key={i} className="bg-amber-100/50 px-2 py-1 rounded border border-amber-200/50">{new Date(d.checkIn).toLocaleDateString('vi-VN').slice(0,5)} - {new Date(d.checkOut).toLocaleDateString('vi-VN').slice(0,5)}</span>
                                            ))}
                                        </div>
                                        <p className="text-[11px] text-amber-600 mt-2 italic">* Vui lòng chọn ngày nằm ngoài khoảng thời gian trên.</p>
                                    </div>
                                )}

                                <form onSubmit={handleBookingSubmit} className="space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="col-span-1 md:col-span-2">
                                            <label className="block text-[12px] font-bold uppercase tracking-wider text-slate-500 mb-2">Họ và tên <span className="text-red-500">*</span></label>
                                            <input required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-800" placeholder="Nhập tên người đại diện" value={bookingForm.guestName} onChange={e => setBookingForm({ ...bookingForm, guestName: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-[12px] font-bold uppercase tracking-wider text-slate-500 mb-2">Email <span className="text-red-500">*</span></label>
                                            <input required type="email" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-800" placeholder="email@example.com" value={bookingForm.guestEmail} onChange={e => setBookingForm({ ...bookingForm, guestEmail: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-[12px] font-bold uppercase tracking-wider text-slate-500 mb-2">Số điện thoại <span className="text-red-500">*</span></label>
                                            <input required type="tel" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-800" placeholder="090 123 4567" value={bookingForm.guestPhone} onChange={e => setBookingForm({ ...bookingForm, guestPhone: e.target.value })} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                                        <div>
                                            <label className="block text-[12px] font-bold uppercase tracking-wider text-slate-500 mb-2">Nhận phòng <span className="text-red-500">*</span></label>
                                            <input required type="date" min={today} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-800 cursor-pointer" value={bookingForm.checkInDate} onChange={e => setBookingForm({ ...bookingForm, checkInDate: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-[12px] font-bold uppercase tracking-wider text-slate-500 mb-2">Trả phòng <span className="text-red-500">*</span></label>
                                            <input required type="date" min={bookingForm.checkInDate || today} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-800 cursor-pointer" value={bookingForm.checkOutDate} onChange={e => setBookingForm({ ...bookingForm, checkOutDate: e.target.value })} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-[12px] font-bold uppercase tracking-wider text-slate-500 mb-2">Người lớn</label>
                                            <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-800 cursor-pointer" value={bookingForm.adultCount} onChange={e => setBookingForm({ ...bookingForm, adultCount: e.target.value })}>
                                                <option value="1">1 người lớn</option>
                                                <option value="2">2 người lớn</option>
                                                <option value="3">3 người lớn</option>
                                                <option value="4">4 người lớn</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[12px] font-bold uppercase tracking-wider text-slate-500 mb-2">Trẻ em (Dưới 12t)</label>
                                            <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-800 cursor-pointer" value={bookingForm.childCount} onChange={e => setBookingForm({ ...bookingForm, childCount: e.target.value })}>
                                                <option value="0">Không có</option>
                                                <option value="1">1 trẻ em</option>
                                                <option value="2">2 trẻ em</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <label className="block text-[12px] font-bold uppercase tracking-wider text-slate-500 mb-3">Dịch vụ bổ sung</label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 custom-scroll">
                                            {services.length === 0 ? (
                                                <p className="text-slate-400 italic text-sm col-span-2 bg-slate-50 p-4 rounded-xl text-center border border-slate-200 border-dashed">Chưa có dịch vụ nào cung cấp</p>
                                            ) : (
                                                services.map(s => {
                                                    const isChecked = selectedServices.some(sel => sel.id === s.id);
                                                    return (
                                                        <label key={s.id} className={`flex items-start p-3.5 border rounded-xl cursor-pointer transition-all group ${isChecked ? 'bg-blue-50 border-blue-500' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                                                            <input type="checkbox" className="mt-1 mr-3 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer" checked={isChecked} onChange={(e) => {
                                                                let updatedServices;
                                                                if (e.target.checked) {
                                                                    updatedServices = [...selectedServices, { id: s.id, name: s.name, price: s.price }];
                                                                } else {
                                                                    updatedServices = selectedServices.filter(sel => sel.id !== s.id);
                                                                }
                                                                // Cập nhật state nội bộ
                                                                setSelectedServices(updatedServices);
                                                                // THÊM DÒNG NÀY: Đồng bộ lại danh sách mới vào bộ nhớ tạm
                                                                sessionStorage.setItem("selectedServices", JSON.stringify(updatedServices));
                                                            }} />
                                                            <div className="flex-1 min-w-0">
                                                                <span className={`font-semibold text-[13px] block transition-colors leading-tight ${isChecked ? 'text-blue-800' : 'text-slate-700 group-hover:text-blue-600'}`}>{s.name}</span>
                                                                <span className={`font-bold text-[12px] mt-1 block ${isChecked ? 'text-blue-600' : 'text-slate-500'}`}>+{formatCurrency(s.price)}</span>
                                                            </div>
                                                        </label>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[12px] font-bold uppercase tracking-wider text-slate-500 mb-2">Yêu cầu đặc biệt</label>
                                        <textarea rows="2" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-800" placeholder="Ví dụ: Cần phòng tầng cao, dị ứng..." value={bookingForm.specialRequests} onChange={e => setBookingForm({ ...bookingForm, specialRequests: e.target.value })}></textarea>
                                    </div>

                                    <div className="pt-4">
                                        <button type="submit" disabled={!calculation.isValid || isSubmitting} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-[15px] shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:shadow-blue-600/40 transform hover:-translate-y-0.5 disabled:bg-slate-300 disabled:shadow-none disabled:transform-none disabled:cursor-not-allowed transition-all duration-300 flex justify-center items-center">
                                            {isSubmitting ? <><i className="fa-solid fa-circle-notch fa-spin mr-2 text-lg"></i> Đang xử lý...</> : "Xác nhận đặt phòng"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
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
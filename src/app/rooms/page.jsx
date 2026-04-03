// src/app/rooms/page.jsx
"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
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
    const [loading, setLoading] = useState(true);

    // State Tìm kiếm & Lọc
    const [searchQuery, setSearchQuery] = useState("");
    const [filterCheckIn, setFilterCheckIn] = useState("");
    const [filterCheckOut, setFilterCheckOut] = useState("");
    const [currentFilter, setCurrentFilter] = useState("All");

    // State Phân trang
    const [currentPage, setCurrentPage] = useState(1);
    const roomsPerPage = 6;

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
                setAllRooms(loadedRooms);
                setServices(servicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

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
                            // Delay nhỏ để tránh lỗi render modal quá nhanh
                            setTimeout(() => openBookingModal(roomToBook), 500);
                        } else {
                            alert('Phòng từ liên kết này hiện không có sẵn để đặt!');
                        }
                    }
                }
            } catch (error) {
                console.error("Lỗi tải dữ liệu:", error);
            } finally {
                setLoading(false);
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

        // Lọc theo loại
        if (currentFilter !== "All") {
            result = result.filter(r => r.type === currentFilter);
        }

        // Lọc theo từ khóa
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(r =>
                r.code?.toLowerCase().includes(lowerQuery) ||
                r.name?.toLowerCase().includes(lowerQuery) ||
                r.type?.toLowerCase().includes(lowerQuery) ||
                r.description?.toLowerCase().includes(lowerQuery)
            );
        }

        // Lọc theo ngày
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

    // Reset trang về 1 khi đổi bộ lọc
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, currentFilter, filterCheckIn, filterCheckOut]);

    // 3. Phân trang
    const paginatedRooms = filteredRooms.slice((currentPage - 1) * roomsPerPage, currentPage * roomsPerPage);
    const totalPages = Math.ceil(filteredRooms.length / roomsPerPage);

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
        setSelectedServices([]);
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

        // Check trùng lịch real-time trong Modal
        const reqIn = start.setHours(0, 0, 0, 0);
        const reqOut = end.setHours(0, 0, 0, 0);
        const isOverlap = bookedDates.some(range => {
            const bIn = new Date(range.checkIn).setHours(0, 0, 0, 0);
            const bOut = new Date(range.checkOut).setHours(0, 0, 0, 0);
            return reqIn < bOut && bIn < reqOut;
        });

        if (isOverlap) return { nights, roomTotal: 0, serviceTotal: 0, fee: 0, total: 0, isValid: false, error: "Trùng lịch đã có người đặt!" };

        const roomTotal = currentRoom.price * nights;
        const serviceTotal = selectedServices.reduce((acc, s) => acc + s.price, 0);
        const fee = Math.round((roomTotal + serviceTotal) * 0.1);

        return { nights, roomTotal, serviceTotal, fee, total: roomTotal + serviceTotal + fee, isValid: true, error: "" };
    }, [currentRoom, bookingForm.checkInDate, bookingForm.checkOutDate, selectedServices, bookedDates]);

    // 6. Submit Booking
    const handleBookingSubmit = async (e) => {
        e.preventDefault();
        if (!calculation.isValid) return alert("Vui lòng kiểm tra lại ngày tháng hợp lệ!");

        setIsSubmitting(true);
        try {
            // Check đè trên DB một lần nữa cho chắc ăn
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
                alert("Rất tiếc! Phòng này vừa có người đặt xong.");
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
            alert(`Đặt phòng thành công! Mã: #${docRef.id.slice(-8)}`);
            setIsModalOpen(false);

            // Update local state để che phòng vừa đặt
            setActiveBookings(prev => [...prev, bookingData]);

        } catch (error) {
            alert("Lỗi đặt phòng: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const today = new Date().toISOString().split("T")[0];

    return (
        <>
            <Header />
            <main className="user-main min-h-screen">
                {/* Banner & Form Tìm kiếm */}
                <div className="hero-section py-24 md:py-36 flex items-center justify-center relative" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=2000&auto=format&fit=crop')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
                    <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-black/40"></div>
                    <div className="max-w-4xl mx-auto px-4 text-center relative z-10 w-full">
                        <span className="inline-block py-1 px-3 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30 text-xs font-bold tracking-widest uppercase mb-6">
                            Luna Hotel & Resort
                        </span>
                        <h2 className="text-4xl md:text-6xl font-playfair font-bold text-white mb-6 drop-shadow-lg">
                            Tuyệt Tác Nghỉ Dưỡng <br /><span className="italic font-light">Bên Bờ Biển Xanh</span>
                        </h2>

                        <div className="max-w-4xl mx-auto mt-10 relative bg-white/20 backdrop-blur-lg p-3 rounded-2xl border border-white/30 shadow-2xl">
                            <div className="flex flex-col md:flex-row gap-3">
                                <div className="relative flex-1">
                                    <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                    <input type="text" placeholder="Tên phòng, loại phòng..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3.5 bg-white/90 rounded-xl outline-none font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 transition-all" />
                                </div>
                                <div className="relative flex-1">
                                    <i className="fa-solid fa-calendar-days absolute left-4 top-1/2 -translate-y-1/2 text-blue-500"></i>
                                    <input type="date" value={filterCheckIn} onChange={(e) => setFilterCheckIn(e.target.value)} min={today} className="w-full pl-11 pr-4 py-3.5 bg-white/90 rounded-xl outline-none font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 transition-all" title="Ngày nhận phòng" />
                                </div>
                                <div className="relative flex-1">
                                    <i className="fa-solid fa-calendar-check absolute left-4 top-1/2 -translate-y-1/2 text-amber-500"></i>
                                    <input type="date" value={filterCheckOut} min={filterCheckIn || today} onChange={(e) => setFilterCheckOut(e.target.value)} className="w-full pl-11 pr-4 py-3.5 bg-white/90 rounded-xl outline-none font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 transition-all" title="Ngày trả phòng" />
                                </div>
                                {(searchQuery || filterCheckIn || filterCheckOut) && (
                                    <button onClick={() => { setSearchQuery(""); setFilterCheckIn(""); setFilterCheckOut(""); }} className="bg-slate-200 text-slate-600 px-5 py-3.5 rounded-xl font-bold hover:bg-slate-300 transition-all" title="Xóa bộ lọc">
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 md:px-8 py-16">
                    {/* Nút lọc (Filter Buttons) */}
                    <div className="flex flex-wrap justify-center gap-3 md:gap-4 mb-14">
                        {["All", "Superior", "Deluxe", "Suite", "Family", "Standard", "Executive"].map(type => (
                            <button key={type} onClick={() => setCurrentFilter(type)}
                                className={`px-6 py-2.5 rounded-full text-[15px] transition-all ${currentFilter === type ? 'font-semibold bg-slate-900 text-white shadow-lg shadow-slate-900/20 transform scale-105' : 'font-medium bg-white text-slate-600 border border-slate-200 hover:border-slate-400 hover:bg-slate-50'}`}>
                                {type === "All" ? "Tất cả" : type}
                            </button>
                        ))}
                    </div>

                    {/* Danh sách phòng */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
                        {loading ? (
                            <div className="col-span-3 text-center py-20">
                                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-slate-500 font-medium">Đang tải bộ sưu tập phòng...</p>
                            </div>
                        ) : paginatedRooms.length === 0 ? (
                            <div className="col-span-3 text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
                                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <i className="fa-solid fa-calendar-xmark text-2xl text-slate-300"></i>
                                </div>
                                <h3 className="text-xl font-bold text-slate-700 mb-2">Không tìm thấy phòng trống</h3>
                                <p className="text-slate-500">Xin lỗi, không có phòng nào phù hợp với thời gian hoặc từ khóa bạn chọn.</p>
                            </div>
                        ) : (
                            paginatedRooms.map((room) => {
                                const isAvailable = room.status === "available";
                                const statusText = room.status === "maintenance" ? "Đang bảo trì" : "Đã có khách";
                                return (
                                    <div key={room.id} className={`bg-white p-4 md:p-5 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50 flex flex-col h-full transition-all duration-300 group ${!isAvailable ? 'opacity-80' : 'hover:shadow-[0_8px_30px_rgb(37,99,235,0.08)]'}`}>
                                        <div className="h-60 relative rounded-2xl overflow-hidden mb-6">
                                            <img src={room.image || 'https://images.unsplash.com/photo-1611892440504-42a792e24d32'} className={`w-full h-full object-cover transition-transform duration-700 ${isAvailable ? 'group-hover:scale-105' : ''}`} alt={room.name} />
                                            {!isAvailable && (
                                                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-10 flex items-center justify-center">
                                                    <span className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full font-bold text-slate-800 shadow-lg text-sm">
                                                        <i className={`fa-solid ${room.status === 'maintenance' ? 'fa-wrench text-amber-500' : 'fa-lock text-slate-500'} mr-2`}></i>{statusText}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-slate-800 shadow-sm z-20">{room.type}</div>
                                            <div className="absolute top-3 right-3 bg-blue-600/90 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center shadow-sm z-20">
                                                <i className="fa-solid fa-star text-amber-300 mr-1 text-[10px]"></i> 5.0
                                            </div>
                                        </div>

                                        <div className="flex flex-col flex-grow px-2">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-2xl font-bold text-slate-900 leading-tight">Phòng {room.code}</h3>
                                                <div className="text-right">
                                                    <span className={`text-xl font-bold block ${isAvailable ? 'text-blue-600' : 'text-slate-400'}`}>{formatCurrency(room.price)}</span>
                                                    <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">/ Đêm</span>
                                                </div>
                                            </div>
                                            <p className="text-slate-500 text-[15px] mb-6 line-clamp-2">{room.name}</p>

                                            <div className="grid grid-cols-2 gap-3 text-[14px] text-slate-600 font-medium mb-8 bg-slate-50/50 p-4 rounded-2xl mt-auto border border-slate-100">
                                                <div className="flex items-center"><i className={`fa-solid fa-expand ${isAvailable ? 'text-blue-400' : 'text-slate-300'} w-5`}></i>{room.area}m²</div>
                                                <div className="flex items-center"><i className={`fa-regular fa-user ${isAvailable ? 'text-blue-400' : 'text-slate-300'} w-5`}></i>{room.capacity} khách</div>
                                                <div className="flex items-center col-span-2"><i className={`fa-solid fa-bed ${isAvailable ? 'text-blue-400' : 'text-slate-300'} w-5`}></i>{room.bedType || '1 giường King'}</div>
                                            </div>

                                            {isAvailable ? (
                                                <button onClick={() => openBookingModal(room)} className="w-full bg-slate-100 text-slate-800 py-3.5 rounded-xl font-bold text-[15px] hover:bg-blue-600 hover:text-white hover:shadow-lg hover:shadow-blue-600/20 transition-all duration-300">Đặt ngay</button>
                                            ) : (
                                                <button disabled className="w-full bg-slate-100 text-slate-400 py-3.5 rounded-xl font-bold text-[15px] cursor-not-allowed border border-slate-200">{statusText}</button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Phân trang */}
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-2 mt-12 flex-wrap">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="w-11 h-11 rounded-xl font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                            >
                                <i className="fa-solid fa-arrow-left text-sm"></i>
                            </button>

                            {Array.from({ length: totalPages }).map((_, i) => {
                                const page = i + 1;
                                // Hiển thị tối đa 5 trang xung quanh trang hiện tại
                                if (page < currentPage - 2 || page > currentPage + 2) return null;

                                return (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`min-w-[44px] h-11 px-3 rounded-xl font-bold flex items-center justify-center transition-all ${currentPage === page ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:-translate-y-0.5'}`}
                                    >
                                        {page}
                                    </button>
                                );
                            })}

                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="w-11 h-11 rounded-xl font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                            >
                                <i className="fa-solid fa-arrow-right text-sm"></i>
                            </button>
                        </div>
                    )}
                </div>
            </main>
            <Footer />

            {/* Booking Modal */}
            {isModalOpen && currentRoom && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col md:flex-row overflow-hidden relative animate-in fade-in zoom-in duration-300 border border-slate-100">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 z-20 text-slate-400 hover:text-slate-800 bg-white/80 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center shadow-sm transition-all hover:scale-105">
                            <i className="fa-solid fa-xmark text-lg"></i>
                        </button>

                        {/* Cột trái: Thông tin phòng */}
                        <div className="w-full md:w-2/5 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-8 md:p-10 flex flex-col relative border-r border-slate-100">
                            <div className="relative z-10 h-full flex flex-col">
                                <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-4 self-start">
                                    <i className="fa-solid fa-key mr-2"></i>Mã: <span className="ml-1">{currentRoom.code}</span>
                                </div>
                                <h3 className="text-3xl font-playfair font-bold text-slate-900 mb-2">{currentRoom.name}</h3>
                                <div className="flex text-amber-400 text-sm mb-8"><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i></div>

                                <div className="space-y-5 mb-8 text-slate-600 text-[15px] bg-white/60 p-5 rounded-2xl border border-white">
                                    <div className="flex justify-between items-center"><span className="flex items-center"><i className="fa-regular fa-bookmark w-5 text-blue-500"></i> Phân hạng</span><span className="font-semibold text-slate-900">{currentRoom.type}</span></div>
                                    <div className="flex justify-between items-center"><span className="flex items-center"><i className="fa-regular fa-user w-5 text-blue-500"></i> Sức chứa</span><span className="font-semibold text-slate-900">{currentRoom.capacity} khách</span></div>
                                    <div className="flex justify-between items-center"><span className="flex items-center"><i className="fa-solid fa-tag w-5 text-blue-500"></i> Giá cơ bản</span><span className="font-bold text-blue-600 text-lg">{formatCurrency(currentRoom.price)}</span></div>
                                </div>

                                <div className="mt-auto bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                    <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center"><i className="fa-solid fa-receipt text-blue-500 mr-2"></i>Chi tiết thanh toán</h4>
                                    <div className="space-y-3 text-[15px] text-slate-600">
                                        <div className="flex justify-between"><span>Tiền phòng (<span className="font-medium">{calculation.nights} đêm</span>)</span><span className="font-semibold text-slate-800">{formatCurrency(calculation.roomTotal)}</span></div>
                                        <div className="flex justify-between"><span>Tiện ích kèm theo</span><span className="font-semibold text-slate-800">{formatCurrency(calculation.serviceTotal)}</span></div>
                                        <div className="flex justify-between"><span>Thuế & Phí (10%)</span><span className="font-semibold text-slate-800">{formatCurrency(calculation.fee)}</span></div>
                                        <div className="border-t border-slate-200 mt-4 pt-4">
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-slate-900">Tổng cộng</span>
                                                <span className="text-2xl font-bold text-blue-600">{formatCurrency(calculation.total)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Cột phải: Form nhập */}
                        <div className="w-full md:w-3/5 p-8 md:p-10 overflow-y-auto bg-white">
                            <h3 className="text-2xl font-bold text-slate-900 mb-6">Thông tin khách hàng</h3>

                            {bookedDates.length > 0 && (
                                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                    <h4 className="text-sm font-bold text-amber-800 mb-2"><i className="fa-solid fa-calendar-xmark mr-2"></i>Phòng này đã kẹt lịch vào các ngày:</h4>
                                    <ul className="text-[13px] text-amber-700 font-medium space-y-1 ml-6 list-disc">
                                        {bookedDates.map((d, i) => (
                                            <li key={i}>Từ <span className="font-bold">{new Date(d.checkIn).toLocaleDateString('vi-VN')}</span> đến <span className="font-bold">{new Date(d.checkOut).toLocaleDateString('vi-VN')}</span></li>
                                        ))}
                                    </ul>
                                    <p className="text-xs text-amber-600 mt-2 italic">* Vui lòng không chọn ngày Nhận/Trả phòng trùng vào khoảng thời gian trên.</p>
                                </div>
                            )}

                            <form onSubmit={handleBookingSubmit} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-[13px] font-semibold color-slate-700 mb-2">Họ và tên <span className="text-red-500">*</span></label>
                                        <input required className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all text-sm" placeholder="Nhập tên người đại diện" value={bookingForm.guestName} onChange={e => setBookingForm({ ...bookingForm, guestName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-semibold color-slate-700 mb-2">Email nhận xác nhận <span className="text-red-500">*</span></label>
                                        <input required type="email" className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all text-sm" placeholder="email@example.com" value={bookingForm.guestEmail} onChange={e => setBookingForm({ ...bookingForm, guestEmail: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-semibold color-slate-700 mb-2">Số điện thoại <span className="text-red-500">*</span></label>
                                        <input required type="tel" className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all text-sm" placeholder="090 123 4567" value={bookingForm.guestPhone} onChange={e => setBookingForm({ ...bookingForm, guestPhone: e.target.value })} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                                    <div>
                                        <label className="block text-[13px] font-semibold color-slate-700 mb-2">Nhận phòng <span className="text-red-500">*</span></label>
                                        <input required type="date" min={today} className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all text-sm" value={bookingForm.checkInDate} onChange={e => setBookingForm({ ...bookingForm, checkInDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-semibold color-slate-700 mb-2">Trả phòng <span className="text-red-500">*</span></label>
                                        <input required type="date" min={bookingForm.checkInDate || today} className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all text-sm" value={bookingForm.checkOutDate} onChange={e => setBookingForm({ ...bookingForm, checkOutDate: e.target.value })} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-[13px] font-semibold color-slate-700 mb-2">Khách người lớn</label>
                                        <select className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all text-sm" value={bookingForm.adultCount} onChange={e => setBookingForm({ ...bookingForm, adultCount: e.target.value })}>
                                            <option value="1">1 người lớn</option>
                                            <option value="2">2 người lớn</option>
                                            <option value="3">3 người lớn</option>
                                            <option value="4">4 người lớn</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-semibold color-slate-700 mb-2">Trẻ em (Dưới 12t)</label>
                                        <select className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all text-sm" value={bookingForm.childCount} onChange={e => setBookingForm({ ...bookingForm, childCount: e.target.value })}>
                                            <option value="0">Không có</option>
                                            <option value="1">1 trẻ em</option>
                                            <option value="2">2 trẻ em</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <label className="block text-[13px] font-semibold color-slate-700 mb-3">Thêm dịch vụ tiện ích</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-40 overflow-y-auto pr-2">
                                        {services.length === 0 ? (
                                            <p className="text-slate-400 italic text-sm col-span-2 bg-slate-50 p-4 rounded-xl text-center">Chưa có dịch vụ nào cung cấp</p>
                                        ) : (
                                            services.map(s => {
                                                const isChecked = selectedServices.some(sel => sel.id === s.id);
                                                return (
                                                    <label key={s.id} className="flex items-start p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-blue-500 hover:shadow-sm transition-all group">
                                                        <input type="checkbox" className="mt-1 mr-3 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" checked={isChecked} onChange={(e) => {
                                                            if (e.target.checked) setSelectedServices([...selectedServices, { id: s.id, name: s.name, price: s.price }]);
                                                            else setSelectedServices(selectedServices.filter(sel => sel.id !== s.id));
                                                        }} />
                                                        <div className="flex-1 min-w-0">
                                                            <span className="font-semibold text-slate-800 text-[14px] block group-hover:text-blue-600 transition-colors">{s.name}</span>
                                                            <span className="text-blue-600 font-bold text-[13px] mt-1 block">+{formatCurrency(s.price)}</span>
                                                        </div>
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[13px] font-semibold color-slate-700 mb-2">Yêu cầu đặc biệt</label>
                                    <textarea rows="2" className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all text-sm" placeholder="Ví dụ: Cần phòng tầng cao, dị ứng lông xốp..." value={bookingForm.specialRequests} onChange={e => setBookingForm({ ...bookingForm, specialRequests: e.target.value })}></textarea>
                                </div>

                                {calculation.error && <div className="text-red-500 text-sm font-semibold italic text-center">{calculation.error}</div>}

                                <div className="pt-4">
                                    <button type="submit" disabled={!calculation.isValid || isSubmitting} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-[15px] shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:shadow-blue-600/40 hover:-translate-y-0.5 disabled:bg-slate-300 disabled:shadow-none disabled:transform-none disabled:cursor-not-allowed transition-all duration-300">
                                        {isSubmitting ? <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Đang xử lý...</> : "Xác nhận đặt phòng"}
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

export default function RoomsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>}>
            <RoomsContent />
        </Suspense>
    );
}
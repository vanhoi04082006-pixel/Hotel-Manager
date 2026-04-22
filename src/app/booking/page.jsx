// src/app/booking/page.jsx
"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, addDoc, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const formatCurrency = (amount) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
};

function BookingContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const roomId = searchParams.get("roomId");
    const preCheckIn = searchParams.get("checkIn");
    const preCheckOut = searchParams.get("checkOut");

    // States Dữ liệu
    const [currentUser, setCurrentUser] = useState(null);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [services, setServices] = useState([]);
    const [bookedDates, setBookedDates] = useState([]);

    // States Form & Xử lý
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [bookingForm, setBookingForm] = useState({
        guestName: "",
        guestEmail: "",
        guestPhone: "",
        checkInDate: preCheckIn || "",
        checkOutDate: preCheckOut || "",
        adultCount: 2,
        childCount: 0,
        specialRequests: "",
    });
    const [selectedServices, setSelectedServices] = useState([]);

    const [notification, setNotification] = useState({ show: false, title: "", message: "", type: "success" });

    // Lấy dữ liệu Phòng & Dịch vụ khi load
    useEffect(() => {
        if (!roomId) {
            router.push("/rooms");
            return;
        }

        const fetchBookingData = async () => {
            try {
                // Lấy thông tin phòng
                const roomDoc = await getDoc(doc(db, "rooms", roomId));
                if (!roomDoc.exists() || roomDoc.data().status !== "available") {
                    router.push("/rooms");
                    return;
                }
                setCurrentRoom({ id: roomDoc.id, ...roomDoc.data() });

                // Lấy danh sách dịch vụ
                const servicesSnap = await getDocs(collection(db, "services"));
                setServices(servicesSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.available !== false));

                // Lấy lịch đã đặt của phòng này
                const todayStr = new Date().toISOString().split("T")[0];
                const q = query(collection(db, "bookings"), where("roomId", "==", roomId), where("status", "in", ["pending", "confirmed", "completed"]));
                const snapshot = await getDocs(q);
                const dates = [];
                snapshot.forEach(docSnap => {
                    const b = docSnap.data();
                    if (b.checkOut >= todayStr) dates.push({ checkIn: b.checkIn, checkOut: b.checkOut });
                });
                setBookedDates(dates.sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn)));

                // Lấy dịch vụ đã lưu từ Session
                const savedServicesStr = sessionStorage.getItem("selectedServices");
                if (savedServicesStr) {
                    try { setSelectedServices(JSON.parse(savedServicesStr)); } catch (e) { }
                }

            } catch (error) {
                console.error("Lỗi tải trang booking:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchBookingData();

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                const savedUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
                setCurrentUser({ uid: user.uid, email: user.email });
                setBookingForm(prev => ({
                    ...prev,
                    guestName: savedUser.name || user.displayName || "",
                    guestEmail: user.email || "",
                    guestPhone: savedUser.phone || ""
                }));
            }
        });

        return () => unsubscribe();
    }, [roomId, router]);

    // Tính toán tiền tự động
    const calculation = useMemo(() => {
        if (!currentRoom || !bookingForm.checkInDate || !bookingForm.checkOutDate)
            return { nights: 0, roomTotal: 0, serviceTotal: 0, fee: 0, total: 0, isValid: false, error: "" };

        const start = new Date(bookingForm.checkInDate);
        const end = new Date(bookingForm.checkOutDate);
        const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

        if (nights <= 0) return { nights: 0, isValid: false, error: "Ngày trả phòng phải sau ngày nhận" };

        const reqIn = start.setHours(0, 0, 0, 0);
        const reqOut = end.setHours(0, 0, 0, 0);
        const isOverlap = bookedDates.some(range => {
            const bIn = new Date(range.checkIn).setHours(0, 0, 0, 0);
            const bOut = new Date(range.checkOut).setHours(0, 0, 0, 0);
            return reqIn < bOut && bIn < reqOut;
        });

        if (isOverlap) return { nights, isValid: false, error: "Khoảng thời gian này đã có người đặt!" };

        const roomTotal = currentRoom.price * nights;
        const serviceTotal = selectedServices.reduce((acc, s) => acc + s.price, 0);
        const fee = Math.round((roomTotal + serviceTotal) * 0.1);

        return { nights, roomTotal, serviceTotal, fee, total: roomTotal + serviceTotal + fee, isValid: true, error: "" };
    }, [currentRoom, bookingForm.checkInDate, bookingForm.checkOutDate, selectedServices, bookedDates]);

    const handleBookingSubmit = async (e) => {
        e.preventDefault();
        if (!calculation.isValid) {
            setNotification({ show: true, title: "Lỗi ngày đặt", message: calculation.error || "Vui lòng chọn ngày hợp lệ", type: "error" });
            return;
        }

        setIsSubmitting(true);
        try {
            const q = query(collection(db, "bookings"), where("roomId", "==", currentRoom.id), where("status", "in", ["pending", "confirmed", "completed"]));
            const snapshot = await getDocs(q);
            let isOverlapDB = false;
            snapshot.forEach(docSnap => {
                const b = docSnap.data();
                if (bookingForm.checkInDate < b.checkOut && b.checkIn < bookingForm.checkOutDate) isOverlapDB = true;
            });

            if (isOverlapDB) {
                setNotification({ show: true, title: "Phòng đã được đặt", message: "Rất tiếc! Phòng này vừa có người đặt xong.", type: "warning" });
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
                totalPrice: calculation.total,
                specialRequests: bookingForm.specialRequests,
                status: "pending",
                paymentStatus: "unpaid",
                isGuest: !currentUser,
                createdAt: new Date().toISOString()
            };

            const docRef = await addDoc(collection(db, "bookings"), bookingData);

            // --- THÊM ĐOẠN GỬI EMAIL Ở ĐÂY ---
            try {
                await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        customerName: bookingForm.guestName,
                        customerEmail: bookingForm.guestEmail,
                        roomCode: currentRoom.code,
                        checkIn: bookingForm.checkInDate,
                        checkOut: bookingForm.checkOutDate,
                        totalPrice: calculation.total,
                        bookingId: docRef.id.slice(-8).toUpperCase()
                    }),
                });
                console.log("Email xác nhận đã được gửi đi!");
            } catch (emailErr) {
                console.error("Gửi email thất bại nhưng booking đã được lưu:", emailErr);
            }
            // --------------------------------

            sessionStorage.removeItem("selectedServices");

            setNotification({ show: true, title: "Đặt phòng thành công!", message: `Mã đặt phòng của bạn là: #${docRef.id.slice(-8).toUpperCase()}`, type: "success" });
        } catch (error) {
            setNotification({ show: true, title: "Lỗi hệ thống", message: error.message, type: "error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const closeNotification = () => {
        setNotification({ ...notification, show: false });
        if (notification.type === "success") {
            router.push("/");
        }
    };

    const today = new Date().toISOString().split("T")[0];

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
    if (!currentRoom) return null;

    return (
        <div className="bg-[#f0f2f5] min-h-screen flex flex-col font-sans">
            <Header />

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-24 md:py-32">
                <div className="mb-6">
                    <button onClick={() => router.back()} className="text-blue-600 hover:text-blue-800 font-bold text-sm flex items-center transition-colors mb-2">
                        <i className="fa-solid fa-arrow-left mr-2"></i> Trở về
                    </button>
                    <h1 className="text-3xl font-bold text-slate-900">Chi tiết đặt phòng của bạn</h1>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 items-start">

                    {/* Cột Trái: Thông tin phòng & Bill Tạm Tính (Chiếm 35%) */}
                    <div className="w-full lg:w-[35%] flex flex-col gap-6 lg:sticky lg:top-24">
                        {/* Box 1: Tóm tắt phòng */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-5">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Khách sạn Luna Hotel</span>
                                <h2 className="text-xl font-bold text-slate-900 mb-1">{currentRoom.name}</h2>
                                <div className="flex items-center text-xs text-slate-600 mb-4">
                                    <i className="fa-solid fa-star text-yellow-400 mr-1"></i>
                                    <i className="fa-solid fa-star text-yellow-400 mr-1"></i>
                                    <i className="fa-solid fa-star text-yellow-400 mr-1"></i>
                                    <i className="fa-solid fa-star text-yellow-400 mr-1"></i>
                                    <i className="fa-solid fa-star text-yellow-400 mr-2"></i>
                                    (Tuyệt hảo)
                                </div>

                                <div className="aspect-[4/3] rounded-lg overflow-hidden mb-4 relative">
                                    <img src={currentRoom.image} alt={currentRoom.name} className="w-full h-full object-cover" />
                                    <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded shadow-md">
                                        Phòng {currentRoom.code}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-sm text-slate-700">
                                    <div className="flex items-center"><i className="fa-solid fa-bed w-5 text-slate-400"></i> {currentRoom.bedType || '1 Giường King'}</div>
                                    <div className="flex items-center"><i className="fa-regular fa-user w-5 text-slate-400"></i> Max {currentRoom.capacity} khách</div>
                                    <div className="flex items-center"><i className="fa-solid fa-expand w-5 text-slate-400"></i> {currentRoom.area} m²</div>
                                </div>
                            </div>
                        </div>

                        {/* Box 2: Tóm tắt chi phí */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="bg-blue-50/50 p-5 border-b border-slate-100">
                                <h3 className="font-bold text-slate-800 text-lg">Chi tiết giá</h3>
                            </div>
                            <div className="p-5">
                                {calculation.error ? (
                                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2">
                                        <i className="fa-solid fa-circle-exclamation mt-0.5"></i>
                                        <span>{calculation.error}</span>
                                    </div>
                                ) : (
                                    <div className="space-y-3 text-sm text-slate-700">
                                        <div className="flex justify-between items-center">
                                            <span>{formatCurrency(currentRoom.price)} x {calculation.nights} đêm</span>
                                            <span className="font-medium">{formatCurrency(calculation.roomTotal)}</span>
                                        </div>
                                        {selectedServices.length > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span>Dịch vụ thêm ({selectedServices.length})</span>
                                                <span className="font-medium">{formatCurrency(calculation.serviceTotal)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center">
                                            <span>Thuế & Phí (10%)</span>
                                            <span className="font-medium">{formatCurrency(calculation.fee)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="bg-[#ebf3ff] p-5 flex flex-col items-end">
                                <span className="text-sm font-bold text-slate-700 mb-1">Tổng cộng (Gồm thuế)</span>
                                <span className="text-3xl font-bold text-blue-700 font-mono tracking-tight">{formatCurrency(calculation.total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Cột Phải: Form Điền Thông Tin (Chiếm 65%) */}
                    <div className="w-full lg:w-[65%] flex flex-col gap-6">

                        {/* Cảnh báo ngày kẹt */}
                        {bookedDates.length > 0 && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3">
                                <i className="fa-solid fa-triangle-exclamation text-yellow-600 text-xl mt-0.5"></i>
                                <div>
                                    <h4 className="font-bold text-yellow-800 text-sm mb-1">Chú ý: Phòng này đã có lịch đặt trước</h4>
                                    <p className="text-xs text-yellow-700 mb-2">Vui lòng không chọn ngày trùng với các mốc thời gian sau:</p>
                                    <div className="flex flex-wrap gap-2 text-xs font-medium">
                                        {bookedDates.map((d, i) => (
                                            <span key={i} className="bg-white border border-yellow-300 px-2 py-1 rounded shadow-sm text-slate-700">
                                                {new Date(d.checkIn).toLocaleDateString('vi-VN')} <i className="fa-solid fa-arrow-right mx-1 text-[10px] text-slate-400"></i> {new Date(d.checkOut).toLocaleDateString('vi-VN')}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <form id="booking-form" onSubmit={handleBookingSubmit} className="flex flex-col gap-6">

                            {/* Section 1: Lịch trình */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <h3 className="text-xl font-bold text-slate-900 mb-5 flex items-center gap-2">
                                    <i className="fa-regular fa-calendar-check text-blue-600"></i> Lịch trình chuyến đi
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Ngày nhận phòng <span className="text-red-500">*</span></label>
                                        <input required type="date" min={today} className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm cursor-pointer" value={bookingForm.checkInDate} onChange={e => setBookingForm({ ...bookingForm, checkInDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Ngày trả phòng <span className="text-red-500">*</span></label>
                                        <input required type="date" min={bookingForm.checkInDate || today} className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm cursor-pointer" value={bookingForm.checkOutDate} onChange={e => setBookingForm({ ...bookingForm, checkOutDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Người lớn</label>
                                        <select className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm cursor-pointer" value={bookingForm.adultCount} onChange={e => setBookingForm({ ...bookingForm, adultCount: e.target.value })}>
                                            {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} người lớn</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Trẻ em (Dưới 12t)</label>
                                        <select className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm cursor-pointer" value={bookingForm.childCount} onChange={e => setBookingForm({ ...bookingForm, childCount: e.target.value })}>
                                            {[0, 1, 2].map(n => <option key={n} value={n}>{n === 0 ? "Không có" : `${n} trẻ em`}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Thông tin cá nhân */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <h3 className="text-xl font-bold text-slate-900 mb-5 flex items-center gap-2">
                                    <i className="fa-regular fa-address-card text-blue-600"></i> Chi tiết liên hệ
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Họ và tên <span className="text-red-500">*</span></label>
                                        <input required className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm placeholder-slate-400" placeholder="VD: Nguyễn Văn A" value={bookingForm.guestName} onChange={e => setBookingForm({ ...bookingForm, guestName: e.target.value })} />
                                        <p className="text-xs text-slate-500 mt-1">Điền tên chính xác như trên CMND/CCCD để nhận phòng.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Email <span className="text-red-500">*</span></label>
                                        <input required type="email" className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm placeholder-slate-400" placeholder="Email xác nhận sẽ gửi về đây" value={bookingForm.guestEmail} onChange={e => setBookingForm({ ...bookingForm, guestEmail: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Số điện thoại <span className="text-red-500">*</span></label>
                                        <input required type="tel" className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm placeholder-slate-400" placeholder="09xx xxx xxx" value={bookingForm.guestPhone} onChange={e => setBookingForm({ ...bookingForm, guestPhone: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Nâng cấp dịch vụ */}
                            {services.length > 0 && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                    <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                                        <i className="fa-solid fa-bell-concierge text-blue-600"></i> Nâng cấp kỳ nghỉ của bạn
                                    </h3>
                                    <p className="text-sm text-slate-500 mb-5">Thêm các tiện ích để có trải nghiệm hoàn hảo nhất (Không bắt buộc)</p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {services.map(s => {
                                            const isChecked = selectedServices.some(sel => sel.id === s.id);
                                            return (
                                                <label key={s.id} className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all group ${isChecked ? 'bg-[#ebf3ff] border-blue-400' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                                                    <input type="checkbox" className="mt-1 mr-3 w-4 h-4 text-blue-600 rounded cursor-pointer" checked={isChecked} onChange={(e) => {
                                                        let updated = e.target.checked
                                                            ? [...selectedServices, { id: s.id, name: s.name, price: s.price }]
                                                            : selectedServices.filter(sel => sel.id !== s.id);
                                                        setSelectedServices(updated);
                                                        sessionStorage.setItem("selectedServices", JSON.stringify(updated));
                                                    }} />
                                                    <div className="flex-1">
                                                        <span className="font-bold text-sm text-slate-800 block mb-0.5">{s.name}</span>
                                                        <span className="font-medium text-xs text-blue-600 block">+{formatCurrency(s.price)}</span>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Section 4: Ghi chú & Nút Submit */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <div className="mb-6">
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Ghi chú đặc biệt</label>
                                    <p className="text-xs text-slate-500 mb-2">Các yêu cầu đặc biệt không được đảm bảo chắc chắn nhưng chỗ nghỉ sẽ cố gắng hết sức để đáp ứng.</p>
                                    <textarea rows="3" className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm placeholder-slate-400" placeholder="Ví dụ: Tôi cần phòng yên tĩnh, dị ứng..." value={bookingForm.specialRequests} onChange={e => setBookingForm({ ...bookingForm, specialRequests: e.target.value })}></textarea>
                                </div>

                                <div className="bg-blue-50 rounded-lg p-4 mb-6 text-sm text-blue-800">
                                    Bằng cách hoàn tất việc đặt phòng này, bạn đồng ý với các <strong>Điều kiện Đặt phòng</strong> và <strong>Chính sách Bảo mật</strong> của chúng tôi.
                                </div>

                                <div className="flex justify-end">
                                    <button type="submit" disabled={!calculation.isValid || isSubmitting} className="w-full sm:w-auto px-10 py-4 bg-blue-600 text-white rounded-lg font-bold text-lg shadow-md hover:bg-blue-700 hover:shadow-lg disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed transition-all flex items-center justify-center min-w-[250px]">
                                        {isSubmitting ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Đang xử lý...</> : "Hoàn tất đặt phòng"}
                                    </button>
                                </div>
                            </div>

                        </form>
                    </div>

                </div>
            </main>

            <Footer />

            {/* Notification Modal */}
            {notification.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center animate-in zoom-in-95 duration-200">
                        {notification.type === 'success' && <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><i className="fa-solid fa-check text-3xl text-green-500"></i></div>}
                        {notification.type === 'error' && <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><i className="fa-solid fa-xmark text-3xl text-red-500"></i></div>}
                        {notification.type === 'warning' && <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4"><i className="fa-solid fa-exclamation text-3xl text-yellow-500"></i></div>}

                        <h3 className="text-xl font-bold text-slate-800 mb-2">{notification.title}</h3>
                        <p className="text-slate-600 mb-6 text-sm">{notification.message}</p>
                        <button onClick={closeNotification} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all text-sm">Đóng</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function BookingPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>}>
            <BookingContent />
        </Suspense>
    );
}
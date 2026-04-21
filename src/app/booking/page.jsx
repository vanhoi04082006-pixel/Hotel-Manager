// src/app/booking/page.jsx
// Developer: Nguyễn Minh Nhân (MaSV: 124000104)

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
                const roomDoc = await getDoc(doc(db, "rooms", roomId));
                if (!roomDoc.exists() || roomDoc.data().status !== "available") {
                    router.push("/rooms");
                    return;
                }
                setCurrentRoom({ id: roomDoc.id, ...roomDoc.data() });

                const servicesSnap = await getDocs(collection(db, "services"));
                setServices(servicesSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.available !== false));

                const todayStr = new Date().toISOString().split("T")[0];
                const q = query(collection(db, "bookings"), where("roomId", "==", roomId), where("status", "in", ["pending", "confirmed", "completed"]));
                const snapshot = await getDocs(q);
                const dates = [];
                snapshot.forEach(docSnap => {
                    const b = docSnap.data();
                    if (b.checkOut >= todayStr) dates.push({ checkIn: b.checkIn, checkOut: b.checkOut });
                });
                setBookedDates(dates.sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn)));

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

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div></div>;
    if (!currentRoom) return null;

    return (
        <div className="bg-[#fcfbf9] min-h-screen flex flex-col font-sans">
            <Header />

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-28 md:py-32">
                <div className="mb-10">
                    <button onClick={() => router.back()} className="text-slate-500 hover:text-amber-700 font-medium text-sm flex items-center transition-colors group">
                        <i className="fa-solid fa-arrow-left mr-2 transform group-hover:-translate-x-1 transition-transform"></i> Trở về
                    </button>
                    <h1 className="text-3xl md:text-5xl font-playfair font-bold text-slate-900 mt-5 tracking-tight">Hoàn tất đặt phòng</h1>
                    <p className="text-slate-500 mt-2">Vui lòng điền thông tin bên dưới để xác nhận kỳ nghỉ của bạn.</p>
                </div>

                <div className="flex flex-col lg:flex-row gap-10 items-start">

                    {/* Cột Trái: Form Điền Thông Tin */}
                    <div className="w-full lg:w-[60%] bg-white rounded-2xl p-6 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                        <h3 className="text-xl font-playfair font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4">Thông tin liên hệ</h3>

                        <form id="booking-form" onSubmit={handleBookingSubmit} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Họ và tên <span className="text-amber-600">*</span></label>
                                    <input required className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-sm font-medium text-slate-800" value={bookingForm.guestName} onChange={e => setBookingForm({ ...bookingForm, guestName: e.target.value })} placeholder="VD: Nguyễn Văn A" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Email <span className="text-amber-600">*</span></label>
                                    <input required type="email" className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-sm font-medium text-slate-800" value={bookingForm.guestEmail} onChange={e => setBookingForm({ ...bookingForm, guestEmail: e.target.value })} placeholder="email@example.com" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Số điện thoại <span className="text-amber-600">*</span></label>
                                    <input required type="tel" className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-sm font-medium text-slate-800" value={bookingForm.guestPhone} onChange={e => setBookingForm({ ...bookingForm, guestPhone: e.target.value })} placeholder="0901234567" />
                                </div>
                            </div>

                            <h3 className="text-xl font-playfair font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4 pt-4">Lịch trình & Số lượng khách</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Nhận phòng <span className="text-amber-600">*</span></label>
                                    <input required type="date" min={today} className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-sm font-medium text-slate-800 cursor-pointer" value={bookingForm.checkInDate} onChange={e => setBookingForm({ ...bookingForm, checkInDate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Trả phòng <span className="text-amber-600">*</span></label>
                                    <input required type="date" min={bookingForm.checkInDate || today} className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-sm font-medium text-slate-800 cursor-pointer" value={bookingForm.checkOutDate} onChange={e => setBookingForm({ ...bookingForm, checkOutDate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Người lớn</label>
                                    <select className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 text-sm font-medium text-slate-800 cursor-pointer appearance-none" value={bookingForm.adultCount} onChange={e => setBookingForm({ ...bookingForm, adultCount: e.target.value })}>
                                        {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} người lớn</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Trẻ em (Dưới 12t)</label>
                                    <select className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 text-sm font-medium text-slate-800 cursor-pointer appearance-none" value={bookingForm.childCount} onChange={e => setBookingForm({ ...bookingForm, childCount: e.target.value })}>
                                        {[0, 1, 2].map(n => <option key={n} value={n}>{n === 0 ? "Không có" : `${n} trẻ em`}</option>)}
                                    </select>
                                </div>
                            </div>

                            <h3 className="text-xl font-playfair font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4 pt-4">Dịch vụ & Tiện ích thêm</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {services.map(s => {
                                    const isChecked = selectedServices.some(sel => sel.id === s.id);
                                    return (
                                        <label key={s.id} className={`flex items-start p-5 border rounded-xl cursor-pointer transition-all duration-200 group ${isChecked ? 'bg-amber-50/50 border-amber-500 shadow-[0_0_0_1px_#f59e0b]' : 'bg-white border-slate-200 hover:border-amber-300'}`}>
                                            <input type="checkbox" className="mt-0.5 mr-4 w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer" checked={isChecked} onChange={(e) => {
                                                let updated = e.target.checked
                                                    ? [...selectedServices, { id: s.id, name: s.name, price: s.price }]
                                                    : selectedServices.filter(sel => sel.id !== s.id);
                                                setSelectedServices(updated);
                                                sessionStorage.setItem("selectedServices", JSON.stringify(updated));
                                            }} />
                                            <div>
                                                <span className={`font-semibold text-sm block ${isChecked ? 'text-amber-900' : 'text-slate-700'}`}>{s.name}</span>
                                                <span className={`font-bold text-xs mt-1.5 block ${isChecked ? 'text-amber-600' : 'text-slate-500'}`}>+{formatCurrency(s.price)}</span>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>

                            <div className="pt-4">
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Yêu cầu đặc biệt</label>
                                <textarea rows="3" placeholder="Ghi chú thêm về dị ứng thực phẩm, yêu cầu phòng tầng cao..." className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-sm text-slate-800" value={bookingForm.specialRequests} onChange={e => setBookingForm({ ...bookingForm, specialRequests: e.target.value })}></textarea>
                            </div>
                        </form>
                    </div>

                    {/* Cột Phải: Bill Tạm Tính - Sticky */}
                    <div className="w-full lg:w-[40%] sticky top-28">
                        <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden text-white">
                            <div className="h-56 relative bg-slate-800">
                                <img src={currentRoom.image} className="w-full h-full object-cover opacity-80 mix-blend-overlay" alt="Room" />
                                <div className="absolute top-5 left-5 bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-white border border-white/20">
                                    Phòng {currentRoom.code}
                                </div>
                            </div>

                            <div className="p-8">
                                <h3 className="text-2xl font-playfair font-bold text-amber-500 mb-2">{currentRoom.name}</h3>
                                <div className="flex gap-4 text-xs text-slate-300 font-medium mb-8">
                                    <span className="flex items-center"><i className="fa-solid fa-expand text-slate-400 mr-2"></i>{currentRoom.area}m²</span>
                                    <span className="flex items-center"><i className="fa-regular fa-user text-slate-400 mr-2"></i>{currentRoom.capacity} Khách</span>
                                </div>

                                <div className="space-y-4 text-sm text-slate-300 border-t border-slate-700/50 pt-6">
                                    <div className="flex justify-between items-center">
                                        <span>Phòng ({calculation.nights || 0} đêm)</span>
                                        <span className="font-semibold text-white">{formatCurrency(calculation.roomTotal)}</span>
                                    </div>
                                    {selectedServices.length > 0 && (
                                        <div className="flex justify-between items-start">
                                            <span className="max-w-[70%]">Dịch vụ bổ sung ({selectedServices.length})</span>
                                            <span className="font-semibold text-white">{formatCurrency(calculation.serviceTotal)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center">
                                        <span>Thuế & Phí (10%)</span>
                                        <span className="font-semibold text-white">{formatCurrency(calculation.fee)}</span>
                                    </div>
                                </div>

                                <div className="border-t border-dashed border-slate-600 mt-6 pt-6 flex justify-between items-end">
                                    <span className="font-bold text-slate-400 uppercase tracking-widest text-xs mb-1">Tổng thanh toán</span>
                                    <span className="text-3xl font-bold text-amber-500 font-mono">{formatCurrency(calculation.total)}</span>
                                </div>

                                <button form="booking-form" type="submit" disabled={!calculation.isValid || isSubmitting} className="w-full mt-8 bg-amber-600 text-white py-4 rounded-xl font-bold text-[15px] shadow-[0_0_20px_rgba(217,119,6,0.3)] hover:bg-amber-500 hover:shadow-[0_0_25px_rgba(217,119,6,0.5)] disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed transition-all duration-300">
                                    {isSubmitting ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Đang xử lý...</> : "Xác nhận đặt phòng"}
                                </button>

                                {calculation.error && (
                                    <p className="text-rose-400 text-xs text-center mt-4 font-medium flex items-center justify-center bg-rose-400/10 py-2 rounded-lg"><i className="fa-solid fa-circle-exclamation mr-2"></i> {calculation.error}</p>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </main>

            <Footer />

            {/* Notification Modal */}
            {notification.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in-95 duration-300">
                        {notification.type === 'success' && <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-emerald-100"><i className="fa-solid fa-check text-2xl text-emerald-500"></i></div>}
                        {notification.type === 'error' && <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-rose-100"><i className="fa-solid fa-xmark text-2xl text-rose-500"></i></div>}
                        {notification.type === 'warning' && <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-amber-100"><i className="fa-solid fa-exclamation text-2xl text-amber-500"></i></div>}

                        <h3 className="text-xl font-bold text-slate-800 mb-2">{notification.title}</h3>
                        <p className="text-sm text-slate-500 mb-8">{notification.message}</p>
                        <button onClick={closeNotification} className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all">Đã hiểu</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function BookingPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div></div>}>
            <BookingContent />
        </Suspense>
    );
}
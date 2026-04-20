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
                    try { setSelectedServices(JSON.parse(savedServicesStr)); } catch (e) {}
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
            // Check trùng lặp lần cuối trên DB
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
            router.push("/"); // Về trang chủ sau khi đặt thành công
        }
    };

    const today = new Date().toISOString().split("T")[0];

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
    if (!currentRoom) return null;

    return (
        <div className="bg-slate-50 min-h-screen flex flex-col font-sans">
            <Header />
            
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-32">
                <div className="mb-8">
                    <button onClick={() => router.back()} className="text-slate-500 hover:text-blue-600 font-bold text-sm flex items-center transition-colors">
                        <i className="fa-solid fa-arrow-left mr-2"></i> Quay lại
                    </button>
                    <h1 className="text-3xl md:text-4xl font-playfair font-bold text-slate-900 mt-4">Xác nhận Đặt phòng</h1>
                </div>

                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    
                    {/* Cột Trái: Form Điền Thông Tin (Chiếm 60%) */}
                    <div className="w-full lg:w-[60%] bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
                        <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4">Thông tin khách hàng</h3>
                        
                        <form id="booking-form" onSubmit={handleBookingSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Họ và tên <span className="text-red-500">*</span></label>
                                    <input required className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-medium text-slate-800" value={bookingForm.guestName} onChange={e => setBookingForm({ ...bookingForm, guestName: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Email <span className="text-red-500">*</span></label>
                                    <input required type="email" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-medium text-slate-800" value={bookingForm.guestEmail} onChange={e => setBookingForm({ ...bookingForm, guestEmail: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Số điện thoại <span className="text-red-500">*</span></label>
                                    <input required type="tel" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-medium text-slate-800" value={bookingForm.guestPhone} onChange={e => setBookingForm({ ...bookingForm, guestPhone: e.target.value })} />
                                </div>
                            </div>

                            <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4 pt-4">Lịch trình & Khách</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Nhận phòng <span className="text-red-500">*</span></label>
                                    <input required type="date" min={today} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-medium text-slate-800 cursor-pointer" value={bookingForm.checkInDate} onChange={e => setBookingForm({ ...bookingForm, checkInDate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Trả phòng <span className="text-red-500">*</span></label>
                                    <input required type="date" min={bookingForm.checkInDate || today} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-medium text-slate-800 cursor-pointer" value={bookingForm.checkOutDate} onChange={e => setBookingForm({ ...bookingForm, checkOutDate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Người lớn</label>
                                    <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-sm font-medium text-slate-800 cursor-pointer" value={bookingForm.adultCount} onChange={e => setBookingForm({ ...bookingForm, adultCount: e.target.value })}>
                                        {[1,2,3,4].map(n => <option key={n} value={n}>{n} người lớn</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Trẻ em (Dưới 12t)</label>
                                    <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-sm font-medium text-slate-800 cursor-pointer" value={bookingForm.childCount} onChange={e => setBookingForm({ ...bookingForm, childCount: e.target.value })}>
                                        {[0,1,2].map(n => <option key={n} value={n}>{n === 0 ? "Không có" : `${n} trẻ em`}</option>)}
                                    </select>
                                </div>
                            </div>

                            <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4 pt-4">Nâng cấp trải nghiệm</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {services.map(s => {
                                    const isChecked = selectedServices.some(sel => sel.id === s.id);
                                    return (
                                        <label key={s.id} className={`flex items-start p-4 border rounded-xl cursor-pointer transition-all group ${isChecked ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                                            <input type="checkbox" className="mt-1 mr-3 w-4 h-4 text-blue-600 rounded cursor-pointer" checked={isChecked} onChange={(e) => {
                                                let updated = e.target.checked 
                                                    ? [...selectedServices, { id: s.id, name: s.name, price: s.price }]
                                                    : selectedServices.filter(sel => sel.id !== s.id);
                                                setSelectedServices(updated);
                                                sessionStorage.setItem("selectedServices", JSON.stringify(updated));
                                            }} />
                                            <div>
                                                <span className={`font-semibold text-sm block ${isChecked ? 'text-blue-800' : 'text-slate-700'}`}>{s.name}</span>
                                                <span className={`font-bold text-xs mt-1 block ${isChecked ? 'text-blue-600' : 'text-slate-500'}`}>+{formatCurrency(s.price)}</span>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>

                            <div className="pt-4">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Ghi chú đặc biệt</label>
                                <textarea rows="3" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all text-sm text-slate-800" value={bookingForm.specialRequests} onChange={e => setBookingForm({ ...bookingForm, specialRequests: e.target.value })}></textarea>
                            </div>
                        </form>
                    </div>

                    {/* Cột Phải: Bill Tạm Tính (Chiếm 40%) - Dính chặt khi cuộn (Sticky) */}
                    <div className="w-full lg:w-[40%] sticky top-24">
                        <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden">
                            <div className="h-48 relative bg-slate-100">
                                <img src={currentRoom.image} className="w-full h-full object-cover" alt="Room" />
                                <div className="absolute top-4 left-4 bg-white/90 px-3 py-1.5 rounded-full text-xs font-bold text-slate-800 shadow-sm">
                                    Phòng {currentRoom.code}
                                </div>
                            </div>
                            
                            <div className="p-6 md:p-8">
                                <h3 className="text-2xl font-playfair font-bold text-slate-900 mb-2">{currentRoom.name}</h3>
                                <div className="flex gap-3 text-xs text-slate-600 font-medium mb-6">
                                    <span><i className="fa-solid fa-expand text-blue-400 mr-1"></i>{currentRoom.area}m²</span>
                                    <span><i className="fa-regular fa-user text-emerald-500 mr-1"></i>{currentRoom.capacity} Khách</span>
                                </div>

                                <div className="space-y-4 text-sm text-slate-600 border-t border-slate-100 pt-6">
                                    <div className="flex justify-between items-center">
                                        <span>{formatCurrency(currentRoom.price)} x {calculation.nights || 0} đêm</span>
                                        <span className="font-bold text-slate-800">{formatCurrency(calculation.roomTotal)}</span>
                                    </div>
                                    {selectedServices.length > 0 && (
                                        <div className="flex justify-between items-start">
                                            <span className="max-w-[70%]">Dịch vụ bổ sung ({selectedServices.length})</span>
                                            <span className="font-bold text-slate-800">{formatCurrency(calculation.serviceTotal)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center">
                                        <span>Thuế & Phí (10%)</span>
                                        <span className="font-bold text-slate-800">{formatCurrency(calculation.fee)}</span>
                                    </div>
                                </div>

                                <div className="border-t border-dashed border-slate-300 mt-6 pt-6 flex justify-between items-center">
                                    <span className="font-bold text-slate-800 uppercase tracking-widest text-sm">Tổng cộng</span>
                                    <span className="text-3xl font-bold text-blue-600 font-mono">{formatCurrency(calculation.total)}</span>
                                </div>

                                <button form="booking-form" type="submit" disabled={!calculation.isValid || isSubmitting} className="w-full mt-8 bg-blue-600 text-white py-4 rounded-xl font-bold text-[15px] shadow-lg shadow-blue-600/30 hover:bg-blue-700 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed transition-all">
                                    {isSubmitting ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Đang xử lý...</> : "Xác nhận đặt phòng"}
                                </button>
                                
                                {calculation.error && (
                                    <p className="text-red-500 text-xs text-center mt-3 font-bold flex items-center justify-center"><i className="fa-solid fa-circle-exclamation mr-1"></i> {calculation.error}</p>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </main>

            <Footer />

            {/* Notification Modal */}
            {notification.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center animate-in zoom-in-95 duration-300">
                        {notification.type === 'success' && <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5"><i className="fa-solid fa-check text-4xl text-emerald-500"></i></div>}
                        {notification.type === 'error' && <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-5"><i className="fa-solid fa-xmark text-4xl text-rose-500"></i></div>}
                        {notification.type === 'warning' && <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5"><i className="fa-solid fa-exclamation text-4xl text-amber-500"></i></div>}
                        
                        <h3 className="text-2xl font-bold text-slate-800 mb-3">{notification.title}</h3>
                        <p className="text-slate-600 mb-8">{notification.message}</p>
                        <button onClick={closeNotification} className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all">Đã hiểu</button>
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
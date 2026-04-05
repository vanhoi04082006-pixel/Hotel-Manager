// src/app/my-bookings/page.jsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, addDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// Hàm tiện ích
const formatCurrency = (amount) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString("vi-VN") : "";

export default function MyBookingsPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState(null);
    const [bookings, setBookings] = useState([]);
    
    // States Loading toàn cục
    const [loading, setLoading] = useState(true);
    const [isPageLoaded, setIsPageLoaded] = useState(false); 

    // States cho Payment Modal
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [currentBooking, setCurrentBooking] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [promoCode, setPromoCode] = useState("");
    const [discount, setDiscount] = useState(0);
    const [promoMessage, setPromoMessage] = useState({ text: "", type: "" });
    const [isProcessing, setIsProcessing] = useState(false);

    // States cho Form Credit Card
    const [cardNumber, setCardNumber] = useState("");
    const [cardExpiry, setCardExpiry] = useState("");
    const [cardCvv, setCardCvv] = useState("");
    const [cardName, setCardName] = useState("");

    // Lấy dữ liệu đặt phòng
    const fetchBookings = async (userEmail) => {
        try {
            const q = query(collection(db, "bookings"), where("userEmail", "==", userEmail));
            const querySnapshot = await getDocs(q);
            const loadedBookings = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setBookings(loadedBookings);
        } catch (error) {
            console.error("Lỗi tải lịch sử đặt phòng:", error);
            alert("Hệ thống đang gặp sự cố khi tải dữ liệu của bạn.");
        } finally {
            setLoading(false);
            setTimeout(() => setIsPageLoaded(true), 600); // Tắt màn hình Loading ảo
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser({ uid: user.uid, email: user.email });
                fetchBookings(user.email);
            } else {
                setCurrentUser(null);
                setLoading(false);
                setTimeout(() => setIsPageLoaded(true), 600);
            }
        });
        return () => unsubscribe();
    }, []);

    // Hàm Hủy phòng
    const handleCancelBooking = async (bookingId) => {
        if (confirm("Bạn có chắc chắn muốn hủy đặt phòng này? Hành động này không thể hoàn tác.")) {
            try {
                await updateDoc(doc(db, "bookings", bookingId), {
                    status: "cancelled",
                    updatedAt: new Date().toISOString()
                });
                alert("Đã hủy lịch đặt phòng");
                fetchBookings(currentUser.email);
            } catch (error) {
                alert("Có lỗi xảy ra: " + error.message);
            }
        }
    };

    // Mở Modal Thanh Toán
    const openPaymentModal = (booking) => {
        setCurrentBooking(booking);
        setPaymentMethod("cash");
        setPromoCode("");
        setDiscount(0);
        setPromoMessage({ text: "", type: "" });

        // Reset Form Thẻ
        setCardNumber("");
        setCardExpiry("");
        setCardCvv("");
        setCardName("");

        setIsPaymentModalOpen(true);
    };

    // Áp dụng mã giảm giá
    const handleApplyPromo = async () => {
        if (!promoCode.trim()) {
            setPromoMessage({ text: "Vui lòng nhập mã giảm giá", type: "error" });
            return;
        }
        try {
            const promotionsSnap = await getDocs(collection(db, "promotions"));
            const promoList = promotionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const promo = promoList.find(p => p.code === promoCode.trim().toUpperCase() && p.active);

            if (!promo) {
                setPromoMessage({ text: "Mã giảm giá không hợp lệ hoặc đã hết hạn", type: "error" });
                setDiscount(0);
                return;
            }

            if (new Date(promo.endDate) < new Date()) {
                setPromoMessage({ text: "Mã giảm giá đã hết hạn", type: "error" });
                setDiscount(0);
                return;
            }

            let calculatedDiscount = promo.type === "percent"
                ? (currentBooking.totalPrice * promo.value) / 100
                : promo.value;

            calculatedDiscount = Math.min(calculatedDiscount, currentBooking.totalPrice);
            setDiscount(calculatedDiscount);
            setPromoMessage({
                text: `Áp dụng thành công! Giảm ${promo.type === "percent" ? promo.value + "%" : formatCurrency(promo.value)}`,
                type: "success"
            });
        } catch (error) {
            console.error("Lỗi áp dụng mã:", error);
            setPromoMessage({ text: "Có lỗi xảy ra khi áp dụng mã", type: "error" });
        }
    };

    // Xử lý thanh toán
    const processPayment = async () => {
        if (!currentBooking) return;
        setIsProcessing(true);

        try {
            const finalAmount = currentBooking.totalPrice - discount;

            const paymentData = {
                bookingId: currentBooking.id,
                amount: finalAmount,
                originalAmount: currentBooking.totalPrice,
                discount: discount,
                discountCode: discount > 0 ? promoCode.toUpperCase() : null,
                method: paymentMethod,
                status: "completed",
                transactionId: "TXN" + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase(),
                createdAt: new Date().toISOString(),
                userEmail: currentUser.email,
                userId: currentUser.uid,
                roomCode: currentBooking.roomCode,
            };

            const paymentRef = await addDoc(collection(db, "payments"), paymentData);

            await updateDoc(doc(db, "bookings", currentBooking.id), {
                paymentStatus: "paid",
                paymentId: paymentRef.id,
                discountApplied: discount,
                discountCode: discount > 0 ? promoCode.toUpperCase() : null,
                finalPaidAmount: finalAmount,
                updatedAt: new Date().toISOString()
            });

            alert("Thanh toán thành công!");
            setIsPaymentModalOpen(false);
            fetchBookings(currentUser.email);
        } catch (error) {
            alert("Lỗi thanh toán: " + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    // Hàm xử lý sao chép thông tin ngân hàng
    const copyBankInfo = () => {
        const content = `PAY ${currentBooking?.id?.slice(-8).toUpperCase()}`;
        navigator.clipboard.writeText(`Ngân hàng: Vietcombank\nSố TK: 1234 5678 9012 3456\nChủ TK: LUNA HOTEL & RESORT\nNội dung: ${content}`);
        alert('Đã sao chép thông tin chuyển khoản');
    };

    // Handlers format input Credit Card
    const handleCardNumberChange = (e) => {
        let val = e.target.value.replace(/\D/g, "");
        let formatted = "";
        for (let i = 0; i < val.length; i++) {
            if (i > 0 && i % 4 === 0) formatted += " ";
            formatted += val[i];
        }
        setCardNumber(formatted);
    };
    const handleCardExpiryChange = (e) => {
        let val = e.target.value.replace(/\D/g, "");
        if (val.length >= 2) val = val.slice(0, 2) + "/" + val.slice(2, 4);
        setCardExpiry(val);
    };

    // Map cấu hình Trạng thái theo UI mới nhất
    const getStatusStyles = (status) => {
        const styles = {
            pending: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", icon: "fa-clock", label: "Chờ xác nhận" },
            confirmed: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: "fa-check", label: "Đã xác nhận" },
            completed: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: "fa-flag-checkered", label: "Hoàn tất" },
            cancelled: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: "fa-xmark", label: "Đã hủy" }
        };
        return styles[status] || styles.pending;
    };

    const formInputClass = "w-full p-3 border border-slate-200 rounded-xl bg-white focus:bg-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-800 text-[15px]";

    return (
        <>
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes popInItem { 0% { opacity: 0; transform: scale(0.95) translateY(20px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .animate-item { opacity: 0; animation: popInItem 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .custom-loader {
                    border: 3px solid #e2e8f0;
                    border-top: 3px solid #2563eb;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                }
                .page-banner {
                    background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
                    position: relative;
                    overflow: hidden;
                }
                .page-banner::after {
                    content: '';
                    position: absolute;
                    top: 0; right: 0; bottom: 0; left: 0;
                    background: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=');
                    opacity: 0.5;
                }
            `}} />

            {/* Màn hình Loading Khởi tạo */}
            <div className={`fixed inset-0 bg-white z-[9999] flex items-center justify-center flex-col transition-opacity duration-700 ease-in-out ${isPageLoaded ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                <div className="text-center transition-transform duration-700 scale-100">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <i className="fa-solid fa-list-check text-4xl text-blue-600"></i>
                    </div>
                    <h2 className="text-3xl font-playfair font-bold text-slate-900 mb-4">Luna Hotel</h2>
                    <div className="custom-loader mx-auto mb-5"></div>
                    <p className="text-slate-500 font-medium">Đang tải lịch sử đặt phòng...</p>
                </div>
            </div>

            <div className={`min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col transition-opacity duration-1000 ${isPageLoaded ? "opacity-100" : "opacity-0"}`}>
                <Header />

                <main className="flex-1 pb-24 min-h-[calc(100vh-80px)]">
                    {/* Page Banner */}
                    <div className="page-banner pt-16 pb-24 mb-10 text-center px-4">
                        <div className="relative z-10">
                            <h2 className="text-4xl md:text-5xl font-playfair font-bold text-white mb-4 leading-tight">Danh sách Đặt phòng</h2>
                            <p className="text-blue-100 text-[15px] font-medium max-w-xl mx-auto">
                                Quản lý lịch trình, kiểm tra trạng thái và thanh toán các dịch vụ của bạn tại Luna Hotel một cách dễ dàng.
                            </p>
                        </div>
                    </div>

                    <div className="max-w-5xl mx-auto px-4 md:px-8 -mt-20 relative z-20">
                        <div className="flex flex-wrap items-center justify-between mb-8 gap-4 bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-white/50 shadow-sm">
                            <div className="flex items-center space-x-2 text-slate-600">
                                <i className="fa-solid fa-clock-rotate-left text-blue-600"></i>
                                <span className="font-bold text-[15px]">Lịch sử gần đây</span>
                            </div>
                            <Link href="/rooms" className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-[14px] shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex items-center">
                                <i className="fa-solid fa-plus mr-2"></i>Đặt phòng mới
                            </Link>
                        </div>

                        <div className="space-y-6">
                            {loading ? (
                                <div className="text-center py-20 bg-white rounded-[2rem] shadow-sm border border-slate-100">
                                    <div className="custom-loader mx-auto mb-4"></div>
                                    <p className="text-slate-500 font-medium">Đang tải dữ liệu của bạn...</p>
                                </div>
                            ) : !currentUser ? (
                                <div className="bg-white rounded-[2rem] p-10 text-center shadow-lg border border-slate-100 max-w-2xl mx-auto animate-item">
                                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                        <i className="fa-regular fa-user text-3xl text-blue-500"></i>
                                    </div>
                                    <h3 className="text-2xl font-playfair font-bold text-slate-800 mb-3">Vui lòng đăng nhập</h3>
                                    <p className="text-slate-500 mb-8 text-[15px]">Đăng nhập để xem lịch sử và quản lý đặt phòng của bạn tại Luna Hotel.</p>
                                    <Link href="/login" className="inline-flex items-center px-8 py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-blue-600 shadow-lg transition-all">
                                        Đăng nhập ngay
                                    </Link>
                                </div>
                            ) : bookings.length === 0 ? (
                                <div className="bg-white rounded-[2rem] p-10 text-center shadow-lg border border-slate-100 max-w-2xl mx-auto animate-item">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                        <i className="fa-regular fa-calendar-xmark text-3xl text-slate-400"></i>
                                    </div>
                                    <h3 className="text-2xl font-playfair font-bold text-slate-800 mb-3">Chưa có lịch trình</h3>
                                    <p className="text-slate-500 mb-8 text-[15px]">Bạn chưa có phòng nào được đặt. Hãy bắt đầu lên kế hoạch cho kỳ nghỉ tuyệt vời của bạn!</p>
                                    <Link href="/rooms" className="inline-flex items-center px-8 py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all">
                                        Khám phá phòng ngay
                                    </Link>
                                </div>
                            ) : (
                                bookings.map((b, index) => {
                                    const st = getStatusStyles(b.status);
                                    const isPaid = b.paymentStatus === "paid";

                                    return (
                                        <div key={b.id} className="animate-item bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50 hover:shadow-[0_8px_30px_rgb(37,99,235,0.08)] transition-all duration-300" style={{ animationDelay: `${index * 0.1}s` }}>
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 md:p-6 border-b border-slate-50 gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold font-playfair shadow-md text-lg">
                                                        {b.roomCode}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Mã đặt phòng</p>
                                                        <p className="font-mono font-bold text-slate-800">#{b.id.slice(-8).toUpperCase()}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${st.bg} ${st.text} ${st.border} border shadow-sm flex items-center`}>
                                                        <i className={`fa-solid ${st.icon} mr-1.5`}></i>{st.label}
                                                    </span>
                                                    {isPaid ? (
                                                        <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-green-50 text-green-600 border border-green-200 shadow-sm flex items-center">
                                                            <i className="fa-solid fa-check mr-1.5"></i>Đã thanh toán
                                                        </span>
                                                    ) : (
                                                        <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-50 text-slate-500 border border-slate-200 shadow-sm">
                                                            Chưa thanh toán
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="p-5 md:p-6 bg-slate-50/30">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                                    <div>
                                                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Nhận phòng</p>
                                                        <p className="font-bold text-slate-800 text-[15px]">{formatDate(b.checkIn)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Trả phòng</p>
                                                        <p className="font-bold text-slate-800 text-[15px]">{formatDate(b.checkOut)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Thời gian</p>
                                                        <p className="font-bold text-slate-800 text-[15px]">{b.nights} đêm</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Khách</p>
                                                        <p className="font-bold text-slate-800 text-[15px]">
                                                            {b.adultCount} <i className="fa-solid fa-user text-slate-300 mx-1"></i>
                                                            {b.childCount > 0 && <>, {b.childCount} <i className="fa-solid fa-child text-slate-300 ml-1"></i></>}
                                                        </p>
                                                    </div>
                                                </div>

                                                {b.services?.length > 0 && (
                                                    <div className="mt-5 pt-5 border-t border-slate-100">
                                                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Dịch vụ đi kèm</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {b.services.map((s, idx) => (
                                                                <span key={idx} className="bg-white border border-slate-200 text-slate-600 text-xs px-3 py-1 rounded-full font-medium shadow-sm">
                                                                    {s.name} <span className="text-blue-600 font-bold ml-1">(+{formatCurrency(s.price)})</span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {b.specialRequests && (
                                                    <div className="mt-4 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                                                        <p className="text-[13px] text-blue-800"><span className="font-bold mr-1">Yêu cầu đặc biệt:</span> {b.specialRequests}</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-5 md:p-6 border-t border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-b-[2rem]">
                                                <div>
                                                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Tổng chi phí</p>
                                                    <p className={`text-2xl font-bold font-mono ${isPaid ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                        {b.finalPaidAmount ? formatCurrency(b.finalPaidAmount) : formatCurrency(b.totalPrice)}
                                                    </p>
                                                    {b.discountApplied > 0 && (
                                                        <>
                                                            <p className="text-[11px] text-slate-400 mt-1">Giá gốc: <del>{formatCurrency(b.totalPrice)}</del></p>
                                                            <p className="text-xs text-green-600 font-medium">Đã áp mã: -{formatCurrency(b.discountApplied)}</p>
                                                        </>
                                                    )}
                                                </div>
                                                
                                                <div className="flex gap-3 w-full sm:w-auto">
                                                    {(b.status === "pending" || (b.status === "confirmed" && !isPaid)) && (
                                                        <button onClick={() => handleCancelBooking(b.id)} className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-all text-sm border border-transparent hover:border-red-200">
                                                            Hủy lịch
                                                        </button>
                                                    )}
                                                    {b.status !== "cancelled" && !isPaid && (
                                                        <button onClick={() => openPaymentModal(b)} className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all text-sm text-center flex items-center justify-center transform hover:-translate-y-0.5">
                                                            Thanh toán ngay
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </main>

                <Footer />

                {/* Payment Modal */}
                {isPaymentModalOpen && currentBooking && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0" onClick={() => !isProcessing && setIsPaymentModalOpen(false)}></div>

                        <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-2xl relative z-10 animate-in zoom-in duration-300 border border-slate-100 custom-scroll">
                            <div className="p-6 md:p-8">
                                {/* Header Modal */}
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mb-3 shadow-sm border border-blue-200">
                                            <i className="fa-solid fa-shield-halved mr-1.5"></i> Thanh toán an toàn
                                        </span>
                                        <h3 className="text-3xl font-playfair font-bold text-slate-900">Chi tiết thanh toán</h3>
                                        <p className="text-slate-500 font-medium mt-1 text-[15px]">Mã: #{currentBooking.id.slice(-8).toUpperCase()}</p>
                                    </div>
                                    <button onClick={() => !isProcessing && setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center transition-all">
                                        <i className="fa-solid fa-xmark text-lg"></i>
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    {/* Khối Banner Tiền */}
                                    <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 md:p-8 rounded-2xl text-white shadow-lg relative overflow-hidden">
                                        <i className="fa-solid fa-wallet absolute -bottom-4 -right-4 text-8xl opacity-10 transform -rotate-12"></i>
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-end mb-2">
                                                <span className="text-sm font-medium text-blue-100 tracking-wide uppercase">Tổng thanh toán</span>
                                                <span className="text-right text-sm text-blue-100">Phòng {currentBooking.roomCode}<br />{currentBooking.nights} đêm</span>
                                            </div>
                                            <span className="text-4xl font-bold tracking-tight font-mono drop-shadow-md">{formatCurrency(currentBooking.totalPrice - discount)}</span>
                                        </div>
                                    </div>

                                    {/* Form Tạm tính & Mã giảm giá */}
                                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="font-bold text-slate-700">Tạm tính</span>
                                            <span className="text-xl font-bold text-slate-800">{formatCurrency(currentBooking.totalPrice)}</span>
                                        </div>

                                        <div className="border-t border-slate-200 pt-4 mb-4">
                                            <div className="flex gap-3">
                                                <input
                                                    type="text"
                                                    value={promoCode}
                                                    onChange={(e) => setPromoCode(e.target.value)}
                                                    placeholder="Nhập mã giảm giá"
                                                    className="w-full p-3 border border-slate-200 rounded-xl bg-white outline-none focus:border-blue-500 text-sm font-medium uppercase font-mono"
                                                />
                                                <button onClick={handleApplyPromo} className="px-5 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all whitespace-nowrap shadow-md">
                                                    Áp dụng
                                                </button>
                                            </div>
                                            {promoMessage.text && <div className={`text-xs mt-2.5 font-bold flex items-center ${promoMessage.type === 'error' ? 'text-red-500' : 'text-emerald-600'}`}><i className={`fa-solid ${promoMessage.type === 'error' ? 'fa-triangle-exclamation' : 'fa-check'} mr-1.5`}></i>{promoMessage.text}</div>}
                                        </div>

                                        {discount > 0 && (
                                            <div className="border-t border-slate-200 pt-4 mb-4 animate-in slide-in-from-top-2">
                                                <div className="flex justify-between items-center text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                                                    <span className="font-bold flex items-center"><i className="fa-solid fa-tags mr-2"></i>Giảm giá</span>
                                                    <span className="text-xl font-bold font-mono">-{formatCurrency(discount)}</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="border-t border-slate-200 pt-4">
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-slate-800 text-lg">Tổng cộng</span>
                                                <span className="text-2xl font-bold text-blue-600 font-mono">{formatCurrency(currentBooking.totalPrice - discount)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Chọn phương thức thanh toán (Radio) */}
                                    <h4 className="font-bold text-slate-900 mb-4 text-[15px]">Chọn phương thức thanh toán</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {[
                                            { id: "cash", icon: "fa-money-bill-wave", label: "Tiền mặt" },
                                            { id: "bank", icon: "fa-building-columns", label: "Chuyển khoản" },
                                            { id: "credit", icon: "fa-credit-card", label: "Thẻ Visa/Master" },
                                            { id: "wallet", icon: "fa-qrcode", label: "Ví điện tử" }
                                        ].map((method) => (
                                            <label
                                                key={method.id}
                                                className={`flex flex-col items-center p-4 bg-white rounded-2xl border-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all group ${paymentMethod === method.id ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/50 shadow-sm' : 'border-slate-100'}`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="paymentMethod"
                                                    value={method.id}
                                                    checked={paymentMethod === method.id}
                                                    onChange={() => setPaymentMethod(method.id)}
                                                    className="hidden"
                                                />
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors shadow-inner ${paymentMethod === method.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-600 group-hover:bg-white'}`}>
                                                    <i className={`fa-solid ${method.icon} text-xl`}></i>
                                                </div>
                                                <span className="text-sm font-bold text-slate-700 text-center leading-tight">{method.label}</span>
                                            </label>
                                        ))}
                                    </div>

                                    {/* --- HIỂN THỊ THÔNG TIN THEO LOẠI THANH TOÁN --- */}

                                    {/* 1. Ngân Hàng */}
                                    {paymentMethod === "bank" && (
                                        <div className="mt-5 p-5 bg-blue-50/80 rounded-2xl border border-blue-100 animate-in slide-in-from-bottom-4 duration-300">
                                            <div className="flex items-center mb-4 text-blue-800">
                                                <i className="fa-solid fa-circle-info mr-2"></i><h4 className="font-bold">Thông tin chuyển khoản</h4>
                                            </div>
                                            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-3 text-[15px] text-slate-700">
                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-2">
                                                    <span className="text-slate-500 text-sm mb-1 sm:mb-0">Ngân hàng</span>
                                                    <span className="font-bold text-slate-900">Vietcombank</span>
                                                </div>
                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-2">
                                                    <span className="text-slate-500 text-sm mb-1 sm:mb-0">Số tài khoản</span>
                                                    <span className="font-mono font-bold text-blue-600 text-lg tracking-wider">1234 5678 9012 3456</span>
                                                </div>
                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-2">
                                                    <span className="text-slate-500 text-sm mb-1 sm:mb-0">Chủ tài khoản</span>
                                                    <span className="font-bold text-slate-900">LUNA HOTEL & RESORT</span>
                                                </div>
                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                                                    <span className="text-slate-500 text-sm mb-1 sm:mb-0">Nội dung chuyển khoản</span>
                                                    <span className="font-mono font-bold bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-800">PAY {currentBooking.id.slice(-8).toUpperCase()}</span>
                                                </div>
                                            </div>
                                            <button onClick={copyBankInfo} className="mt-4 w-full bg-white border border-blue-200 text-blue-700 py-3.5 rounded-xl font-bold hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                                                <i className="fa-regular fa-copy mr-2"></i>Sao chép thông tin
                                            </button>
                                        </div>
                                    )}

                                    {/* 2. Thẻ tín dụng */}
                                    {paymentMethod === "credit" && (
                                        <div className="mt-5 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                                            <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden h-48 flex flex-col justify-between border border-slate-800">
                                                <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400 via-transparent to-transparent"></div>
                                                <div className="flex justify-between items-center relative z-10">
                                                    <i className="fa-solid fa-microchip text-4xl text-yellow-400 opacity-90 drop-shadow-md"></i>
                                                    <div className="space-x-3 text-3xl opacity-80">
                                                        <i className="fa-brands fa-cc-visa drop-shadow-md"></i>
                                                        <i className="fa-brands fa-cc-mastercard drop-shadow-md"></i>
                                                    </div>
                                                </div>
                                                <div className="relative z-10 text-center">
                                                    <p className="text-[26px] font-mono tracking-[0.2em] shadow-sm drop-shadow-md">{cardNumber || "**** **** **** ****"}</p>
                                                </div>
                                                <div className="flex justify-between relative z-10">
                                                    <div>
                                                        <p className="text-[10px] opacity-70 uppercase tracking-widest mb-0.5">Hạn thẻ (Vaild Thru)</p>
                                                        <p className="font-mono text-sm tracking-widest">{cardExpiry || "**/**"}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] opacity-70 uppercase tracking-widest mb-0.5">CVC/CVV</p>
                                                        <p className="font-mono text-sm tracking-widest">{cardCvv ? cardCvv.replace(/./g, "*") : "***"}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-2">
                                                <label className="block text-[13px] font-semibold text-slate-600 mb-2">Số thẻ</label>
                                                <input type="text" maxLength="19" placeholder="0000 0000 0000 0000" className={`${formInputClass} text-lg font-mono tracking-wider`} value={cardNumber} onChange={handleCardNumberChange} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-5">
                                                <div>
                                                    <label className="block text-[13px] font-semibold text-slate-600 mb-2">Hạn thẻ (MM/YY)</label>
                                                    <input type="text" maxLength="5" placeholder="MM/YY" className={`${formInputClass} text-center tracking-widest`} value={cardExpiry} onChange={handleCardExpiryChange} />
                                                </div>
                                                <div>
                                                    <label className="block text-[13px] font-semibold text-slate-600 mb-2">Mã bảo mật (CVV)</label>
                                                    <input type="password" maxLength="3" placeholder="***" className={`${formInputClass} text-center tracking-widest`} value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))} />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[13px] font-semibold text-slate-600 mb-2">Tên chủ thẻ (Không dấu)</label>
                                                <input type="text" placeholder="NGUYEN VAN A" className={`${formInputClass} uppercase tracking-wider`} value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} />
                                            </div>
                                        </div>
                                    )}

                                    {/* 3. Ví điện tử */}
                                    {paymentMethod === "wallet" && (
                                        <div className="mt-5 p-8 bg-slate-50 rounded-2xl border border-slate-100 text-center animate-in slide-in-from-bottom-4 duration-300">
                                            <h4 className="font-bold text-slate-800 mb-2 text-lg">Quét mã QR để thanh toán</h4>
                                            <p className="text-sm text-slate-500 mb-8">Mở ứng dụng ngân hàng hoặc ví điện tử Momo, ZaloPay để quét mã QR bên dưới.</p>
                                            <div className="inline-block p-4 bg-white rounded-3xl shadow-xl border border-slate-200">
                                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=LUNA%20HOTEL%20${currentBooking.id}`} alt="QR Code" className="w-56 h-56" />
                                            </div>
                                            <div className="flex justify-center gap-6 mt-8">
                                                <img src="https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png" alt="MoMo" className="h-10 opacity-70 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer transform hover:scale-110 drop-shadow-sm" />
                                                <img src="https://seeklogo.com/images/Z/zalopay-logo-6EA3E8E20B-seeklogo.com.png" alt="ZaloPay" className="h-10 opacity-70 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer transform hover:scale-110 drop-shadow-sm" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
                                    <button onClick={() => setIsPaymentModalOpen(false)} disabled={isProcessing} className="px-6 py-3.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all disabled:opacity-50 text-[15px]">
                                        Hủy / Đóng
                                    </button>
                                    <button onClick={processPayment} disabled={isProcessing} className="px-8 py-3.5 rounded-xl font-bold text-white bg-blue-600 shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none text-[15px]">
                                        {isProcessing ? (
                                            <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i>Đang xử lý...</>
                                        ) : (
                                            <><i className="fa-regular fa-credit-card mr-2"></i>Xác nhận thanh toán</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
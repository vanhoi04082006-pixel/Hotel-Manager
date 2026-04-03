// src/app/booking-lookup/page.jsx
"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { db, auth } from "@/lib/firebase";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    addDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// ========== Helper functions ==========
const formatCurrency = (amount) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

const formatDate = (dateString) =>
    dateString ? new Date(dateString).toLocaleDateString("vi-VN") : "";

// ========== Toast component ==========
const Toast = ({ message, type = "success", onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const icons = {
        success: "fa-check-circle text-green-500",
        error: "fa-exclamation-circle text-red-500",
        warning: "fa-exclamation-triangle text-amber-500",
        info: "fa-info-circle text-blue-500",
    };

    const bgColors = {
        success: "bg-white border-green-100",
        error: "bg-white border-red-100",
        warning: "bg-white border-amber-100",
        info: "bg-white border-blue-100",
    };

    return (
        <div
            className={`flex items-center p-4 shadow-xl border rounded-2xl ${bgColors[type]} slide-in-up max-w-md bg-white/90 backdrop-blur-md z-[10000]`}
        >
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center mr-3">
                <i className={`fa-solid ${icons[type]} text-sm`}></i>
            </div>
            <span className="font-semibold text-slate-800 text-[15px]">{message}</span>
        </div>
    );
};

// ========== Main lookup content ==========
function LookupContent() {
    const searchParams = useSearchParams();

    // ---- Tra cứu state ----
    const [email, setEmail] = useState("");
    const [bookingId, setBookingId] = useState("");
    const [foundBooking, setFoundBooking] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState("");

    // ---- Thanh toán state ----
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [promoCode, setPromoCode] = useState("");
    const [discount, setDiscount] = useState(0);
    const [discountCodeApplied, setDiscountCodeApplied] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [promoMessage, setPromoMessage] = useState({ text: "", type: "" });

    // ---- Credit card form state ----
    const [cardNumber, setCardNumber] = useState("");
    const [cardExpiry, setCardExpiry] = useState("");
    const [cardCvv, setCardCvv] = useState("");
    const [cardName, setCardName] = useState("");

    // ---- Toast state ----
    const [toast, setToast] = useState(null);

    // ---- Loading screen state ----
    const [isLoading, setIsLoading] = useState(true);

    // ---- Ref for auto search from URL ----
    const hasAutoSearched = useRef(false);

    // ---- Helper: show toast ----
    const showToast = (message, type = "success") => {
        setToast({ message, type });
    };

    // ---- Lấy user từ auth và tự động điền email + search nếu có booking param ----
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setEmail(user.email);
                // Nếu có param ?booking=... trên URL thì tự search luôn
                const bId = searchParams.get("booking");
                if (bId && !hasAutoSearched.current) {
                    hasAutoSearched.current = true;
                    setBookingId(bId);
                    // Đợi một chút để state cập nhật rồi search
                    setTimeout(() => {
                        handleLookup(null, user.email, bId);
                    }, 100);
                }
            }
            // Ẩn loading sau khi auth xong
            setTimeout(() => setIsLoading(false), 500);
        });
        return () => unsubscribe();
    }, [searchParams]);

    // ---- Tra cứu booking ----
    const handleLookup = async (e, forcedEmail, forcedId) => {
        if (e) e.preventDefault();

        const searchEmail = forcedEmail || email;
        const searchId = (forcedId || bookingId).replace("#", "").trim().toUpperCase();

        if (!searchEmail || !searchId) {
            setSearchError("Vui lòng nhập đầy đủ email và mã đặt phòng.");
            return;
        }

        setIsSearching(true);
        setSearchError("");
        setFoundBooking(null);

        try {
            const q = query(collection(db, "bookings"), where("userEmail", "==", searchEmail));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setSearchError(`Không tìm thấy đặt phòng nào liên kết với email ${searchEmail}`);
                return;
            }

            let match = null;
            querySnapshot.forEach((docSnap) => {
                const id = docSnap.id.toUpperCase();
                if (id.includes(searchId) || id.slice(-8) === searchId) {
                    match = { id: docSnap.id, ...docSnap.data() };
                }
            });

            if (!match) {
                setSearchError(`Mã đặt phòng #${searchId} không chính xác hoặc không thuộc email này.`);
            } else {
                setFoundBooking(match);
                // Reset discount khi tra cứu mới
                setDiscount(0);
                setDiscountCodeApplied("");
                setPromoCode("");
                setPromoMessage({ text: "", type: "" });
            }
        } catch (error) {
            console.error(error);
            setSearchError("Có lỗi xảy ra trong quá trình tra cứu.");
        } finally {
            setIsSearching(false);
        }
    };

    // ---- Áp dụng mã giảm giá ----
    const applyPromoCode = async () => {
        if (!foundBooking) return;
        const code = promoCode.trim().toUpperCase();
        if (!code) {
            setPromoMessage({ text: "Vui lòng nhập mã giảm giá", type: "error" });
            return;
        }

        try {
            const promotionsSnap = await getDocs(collection(db, "promotions"));
            const promotions = promotionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            const promo = promotions.find((p) => p.code === code && p.active === true);

            if (!promo) {
                setPromoMessage({ text: "Mã giảm giá không hợp lệ hoặc đã hết hạn", type: "error" });
                setDiscount(0);
                setDiscountCodeApplied("");
                return;
            }

            const now = new Date();
            const endDate = new Date(promo.endDate);
            if (endDate < now) {
                setPromoMessage({ text: "Mã giảm giá đã hết hạn", type: "error" });
                setDiscount(0);
                setDiscountCodeApplied("");
                return;
            }

            let discountAmount = 0;
            if (promo.type === "percent") {
                discountAmount = (foundBooking.totalPrice * promo.value) / 100;
            } else {
                discountAmount = promo.value;
            }
            discountAmount = Math.min(discountAmount, foundBooking.totalPrice);

            setDiscount(discountAmount);
            setDiscountCodeApplied(code);
            setPromoMessage({
                text: `Áp dụng thành công! Giảm ${promo.type === "percent" ? promo.value + "%" : formatCurrency(promo.value)}`,
                type: "success",
            });
        } catch (error) {
            console.error("Lỗi áp mã:", error);
            setPromoMessage({ text: "Có lỗi xảy ra khi áp dụng mã", type: "error" });
        }
    };

    // ---- Sao chép thông tin chuyển khoản ----
    const copyBankInfo = () => {
        const content = `PAY ${foundBooking?.id?.slice(-8).toUpperCase() || ""}`;
        const text = `Ngân hàng: Vietcombank\nSố TK: 1234 5678 9012 3456\nChủ TK: LUNA HOTEL & RESORT\nNội dung: ${content}`;
        navigator.clipboard.writeText(text);
        showToast("Đã sao chép thông tin chuyển khoản", "success");
    };

    // ---- Xử lý thanh toán ----
    const processPayment = async () => {
        if (!foundBooking) return;
        setIsProcessing(true);

        try {
            const finalAmount = foundBooking.totalPrice - discount;

            // Dữ liệu thanh toán
            const paymentData = {
                bookingId: foundBooking.id,
                amount: finalAmount,
                originalAmount: foundBooking.totalPrice,
                discount: discount,
                discountCode: discountCodeApplied || null,
                method: paymentMethod,
                status: "completed",
                transactionId: "TXN" + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase(),
                createdAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                userEmail: foundBooking.userEmail,
                roomCode: foundBooking.roomCode,
                bookingDetails: {
                    checkIn: foundBooking.checkIn,
                    checkOut: foundBooking.checkOut,
                    nights: foundBooking.nights,
                    adultCount: foundBooking.adultCount,
                    childCount: foundBooking.childCount,
                },
            };

            // Nếu là thẻ tín dụng, lưu thêm 4 số cuối (demo)
            if (paymentMethod === "credit" && cardNumber) {
                const last4 = cardNumber.replace(/\s/g, "").slice(-4);
                paymentData.cardLast4 = last4;
            }

            const paymentRef = await addDoc(collection(db, "payments"), paymentData);
            await updateDoc(doc(db, "bookings", foundBooking.id), {
                paymentStatus: "paid",
                paymentId: paymentRef.id,
                discountApplied: discount,
                discountCode: discountCodeApplied || null,
                finalPaidAmount: finalAmount,
                updatedAt: new Date().toISOString(),
            });

            showToast("Thanh toán thành công!", "success");
            setIsPaymentModalOpen(false);
            // Refresh lại thông tin booking
            handleLookup(null, foundBooking.userEmail, foundBooking.id);
        } catch (error) {
            console.error("Payment error:", error);
            showToast("Lỗi thanh toán: " + error.message, "error");
        } finally {
            setIsProcessing(false);
        }
    };

    // ---- Format thẻ tín dụng ----
    const handleCardNumberInput = (e) => {
        let value = e.target.value.replace(/\D/g, "");
        let formatted = "";
        for (let i = 0; i < value.length; i++) {
            if (i > 0 && i % 4 === 0) formatted += " ";
            formatted += value[i];
        }
        setCardNumber(formatted);
    };

    const handleCardExpiryInput = (e) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.length >= 2) {
            value = value.slice(0, 2) + "/" + value.slice(2, 4);
        }
        setCardExpiry(value);
    };

    const handleCardCvvInput = (e) => {
        setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 3));
    };

    // ---- Loading screen ----
    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center flex-col transition-opacity duration-500">
                <div className="text-center">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i className="fa-solid fa-magnifying-glass text-4xl text-blue-600"></i>
                    </div>
                    <h2 className="text-3xl font-playfair font-bold text-slate-900 mb-4">Luna Hotel</h2>
                    <div className="loader mx-auto mb-4"></div>
                    <p className="text-slate-500 font-medium">Đang tải hệ thống tra cứu...</p>
                </div>
                <style jsx>{`
          .loader {
            border: 3px solid #e2e8f0;
            border-top: 3px solid #2563eb;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
            </div>
        );
    }

    return (
        <>
            <Header />
            <main className="relative min-h-[calc(100vh-80px)] pt-16 pb-24 bg-[#f8fafc]">
                {/* Hero background */}
                <div className="absolute top-0 left-0 w-full h-[60vh] z-0 overflow-hidden">
                    <img
                        src="https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=2000&auto=format&fit=crop"
                        className="w-full h-full object-cover"
                        alt="Hero"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 to-[#f8fafc]"></div>
                </div>

                <div className="relative z-10 max-w-3xl mx-auto px-4">
                    <div className="text-center mb-10 slide-in-up">
                        <span className="inline-block py-1 px-3 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30 text-xs font-bold uppercase tracking-widest mb-4">
                            Quản lý hành trình
                        </span>
                        <h2 className="text-4xl md:text-5xl font-playfair font-bold text-white mb-4 drop-shadow-md">
                            Tra cứu mã đặt phòng
                        </h2>
                        <p className="text-slate-200 text-[15px] font-medium">
                            Nhập thông tin bên dưới để kiểm tra trạng thái và thanh toán
                        </p>
                    </div>

                    {/* Form tra cứu */}
                    <div className="bg-white/95 backdrop-blur-2xl rounded-[2rem] p-8 md:p-10 shadow-[0_20px_50px_rgb(0,0,0,0.1)] border border-white/50 slide-in-up">
                        <form onSubmit={(e) => handleLookup(e)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-2">
                                        Email đặt phòng
                                    </label>
                                    <div className="relative">
                                        <i className="fa-regular fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-11 p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all"
                                            placeholder="email@example.com"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-2">
                                        Mã đặt phòng
                                    </label>
                                    <div className="relative">
                                        <i className="fa-solid fa-hashtag absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                        <input
                                            type="text"
                                            value={bookingId}
                                            onChange={(e) => setBookingId(e.target.value)}
                                            className="w-full pl-11 p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all"
                                            placeholder="VD: 1A2B3C4D"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isSearching}
                                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:-translate-y-0.5 transition-all duration-300"
                            >
                                {isSearching ? (
                                    <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>
                                ) : (
                                    <i className="fa-solid fa-magnifying-glass mr-2"></i>
                                )}
                                Tìm kiếm thông tin
                            </button>
                        </form>
                    </div>

                    {/* Kết quả tra cứu */}
                    {searchError && (
                        <div className="mt-8 bg-white rounded-[2rem] p-8 text-center shadow-lg border border-red-100 slide-in-up">
                            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i className="fa-solid fa-file-circle-xmark text-3xl text-red-400"></i>
                            </div>
                            <p className="text-slate-700 font-medium">{searchError}</p>
                        </div>
                    )}

                    {foundBooking && (
                        <div className="mt-8 bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden slide-in-up">
                            <div className="bg-slate-900 p-6 md:p-8 text-white relative">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <i className="fa-solid fa-ticket text-8xl"></i>
                                </div>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                                    <div>
                                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest block mb-1">
                                            Mã xác nhận
                                        </span>
                                        <h3 className="text-3xl font-mono font-bold tracking-wider">
                                            #{foundBooking.id.slice(-8).toUpperCase()}
                                        </h3>
                                    </div>
                                    <span
                                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${foundBooking.status === "completed"
                                                ? "bg-green-100 text-green-700"
                                                : foundBooking.status === "cancelled"
                                                    ? "bg-red-100 text-red-700"
                                                    : "bg-blue-100 text-blue-700"
                                            }`}
                                    >
                                        {foundBooking.status === "pending"
                                            ? "Chờ thanh toán"
                                            : foundBooking.status === "confirmed"
                                                ? "Đã xác nhận"
                                                : "Hoàn tất"}
                                    </span>
                                </div>
                            </div>

                            <div className="relative h-6 bg-white overflow-hidden flex items-center w-full">
                                <div className="absolute -left-3 w-6 h-6 bg-[#f8fafc] rounded-full shadow-[inset_-3px_0_5px_rgba(0,0,0,0.05)]"></div>
                                <div className="w-full border-t-2 border-dashed border-slate-200"></div>
                                <div className="absolute -right-3 w-6 h-6 bg-[#f8fafc] rounded-full shadow-[inset_3px_0_5px_rgba(0,0,0,0.05)]"></div>
                            </div>

                            <div className="p-6 md:p-8 pt-2">
                                <h4 className="font-bold text-slate-900 text-lg mb-6 border-b border-slate-100 pb-4">
                                    Phòng {foundBooking.roomCode}
                                </h4>

                                <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-8">
                                    <div>
                                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                                            Nhận phòng
                                        </p>
                                        <p className="font-bold text-slate-800">{formatDate(foundBooking.checkIn)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                                            Trả phòng
                                        </p>
                                        <p className="font-bold text-slate-800">{formatDate(foundBooking.checkOut)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                                            Thời gian
                                        </p>
                                        <p className="font-bold text-slate-800">{foundBooking.nights} đêm</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                                            Số khách
                                        </p>
                                        <p className="font-bold text-slate-800">
                                            {foundBooking.adultCount} <i className="fa-solid fa-user text-slate-300 mx-1"></i>
                                            {foundBooking.childCount
                                                ? `, ${foundBooking.childCount} <i className="fa-solid fa-child text-slate-300 ml-1"></i>`
                                                : ""}
                                        </p>
                                    </div>
                                </div>

                                {foundBooking.services?.length > 0 && (
                                    <div className="bg-slate-50 rounded-xl p-4 mb-8">
                                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
                                            Dịch vụ đi kèm
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {foundBooking.services.map((s, idx) => (
                                                <span
                                                    key={idx}
                                                    className="bg-white border border-slate-200 text-slate-700 text-xs px-3 py-1 rounded-full font-medium shadow-sm"
                                                >
                                                    {s.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">
                                            Tổng chi phí
                                        </p>
                                        <p className="text-2xl font-bold text-blue-700">
                                            {formatCurrency(foundBooking.totalPrice)}
                                        </p>
                                        {foundBooking.discountApplied ? (
                                            <p className="text-xs text-green-600">
                                                Đã giảm {formatCurrency(foundBooking.discountApplied)}
                                            </p>
                                        ) : null}
                                    </div>
                                    {foundBooking.paymentStatus === "paid" ? (
                                        <div className="bg-white px-4 py-2 rounded-xl text-green-600 font-bold shadow-sm border border-green-100 flex items-center">
                                            <i className="fa-solid fa-check-circle mr-2 text-lg"></i>Đã thanh toán
                                        </div>
                                    ) : foundBooking.status !== "cancelled" ? (
                                        <button
                                            onClick={() => setIsPaymentModalOpen(true)}
                                            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:-translate-y-0.5 transition-all"
                                        >
                                            Thanh toán ngay
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Modal thanh toán */}
            {isPaymentModalOpen && foundBooking && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 slide-in-up">
                        <div className="p-6 md:p-8">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
                                        <i className="fa-solid fa-shield-halved mr-1"></i> Thanh toán an toàn
                                    </span>
                                    <h3 className="text-3xl font-playfair font-bold text-slate-900">
                                        Chi tiết thanh toán
                                    </h3>
                                    <p className="text-slate-500 font-medium mt-1">
                                        Mã: #{foundBooking.id.slice(-8).toUpperCase()}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsPaymentModalOpen(false)}
                                    className="text-slate-400 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center transition-all"
                                >
                                    <i className="fa-solid fa-xmark text-lg"></i>
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Tổng tiền + promo */}
                                <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 md:p-8 rounded-2xl text-white shadow-lg relative overflow-hidden">
                                    <i className="fa-solid fa-wallet absolute -bottom-4 -right-4 text-8xl opacity-10 transform -rotate-12"></i>
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-sm font-medium text-blue-100 tracking-wide uppercase">
                                                Tổng thanh toán
                                            </span>
                                            <span className="text-right text-sm text-blue-100">
                                                Phòng {foundBooking.roomCode}
                                                <br />
                                                {foundBooking.nights || 1} đêm
                                            </span>
                                        </div>
                                        <span className="text-4xl font-bold tracking-tight" id="modal-total-amount">
                                            {formatCurrency(foundBooking.totalPrice - discount)}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-2xl p-5">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="font-bold text-slate-700">Tạm tính</span>
                                        <span className="text-xl font-bold text-slate-800">
                                            {formatCurrency(foundBooking.totalPrice)}
                                        </span>
                                    </div>

                                    <div className="border-t border-slate-200 pt-4 mb-4">
                                        <div className="flex gap-3">
                                            <input
                                                type="text"
                                                value={promoCode}
                                                onChange={(e) => setPromoCode(e.target.value)}
                                                placeholder="Nhập mã giảm giá"
                                                className="flex-1 p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm"
                                            />
                                            <button
                                                onClick={applyPromoCode}
                                                className="px-5 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all whitespace-nowrap"
                                            >
                                                Áp dụng
                                            </button>
                                        </div>
                                        {promoMessage.text && (
                                            <p
                                                className={`text-xs mt-2 ${promoMessage.type === "success" ? "text-green-600" : "text-red-500"
                                                    }`}
                                            >
                                                {promoMessage.text}
                                            </p>
                                        )}
                                    </div>

                                    {discount > 0 && (
                                        <div className="border-t border-slate-200 pt-4 mb-4">
                                            <div className="flex justify-between items-center text-green-600">
                                                <span className="font-bold">Giảm giá</span>
                                                <span className="text-xl font-bold">-{formatCurrency(discount)}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="border-t border-slate-200 pt-4">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-slate-800 text-lg">Tổng cộng</span>
                                            <span className="text-2xl font-bold text-blue-600">
                                                {formatCurrency(foundBooking.totalPrice - discount)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Phương thức thanh toán */}
                                <h4 className="font-bold text-slate-900 mb-4 text-[15px]">
                                    Chọn phương thức thanh toán
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { value: "cash", icon: "fa-solid fa-money-bill-wave", label: "Tiền mặt" },
                                        { value: "bank", icon: "fa-solid fa-building-columns", label: "Chuyển khoản" },
                                        { value: "credit", icon: "fa-regular fa-credit-card", label: "Thẻ Visa/Master" },
                                        { value: "wallet", icon: "fa-solid fa-qrcode", label: "Ví điện tử" },
                                    ].map((method) => (
                                        <label
                                            key={method.value}
                                            className={`flex flex-col items-center p-4 bg-white rounded-2xl border-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all group ${paymentMethod === method.value
                                                    ? "border-blue-500 ring-2 ring-blue-100"
                                                    : "border-slate-100"
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="paymentMethod"
                                                value={method.value}
                                                className="hidden"
                                                checked={paymentMethod === method.value}
                                                onChange={() => setPaymentMethod(method.value)}
                                            />
                                            <div
                                                className={`w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3 group-hover:bg-white transition-colors ${paymentMethod === method.value ? "bg-blue-100 text-blue-600" : ""
                                                    }`}
                                            >
                                                <i className={`${method.icon} text-xl text-slate-600 group-hover:text-blue-600 ${paymentMethod === method.value ? "text-blue-600" : ""}`}></i>
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">{method.label}</span>
                                        </label>
                                    ))}
                                </div>

                                {/* Chi tiết theo phương thức */}
                                {paymentMethod === "bank" && (
                                    <div className="mt-5 p-5 bg-blue-50/80 rounded-2xl border border-blue-100 slide-in-up">
                                        <div className="flex items-center mb-4 text-blue-800">
                                            <i className="fa-solid fa-circle-info mr-2"></i>
                                            <h4 className="font-bold">Thông tin chuyển khoản</h4>
                                        </div>
                                        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-3 text-[15px] text-slate-700">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-2">
                                                <span className="text-slate-500 text-sm mb-1 sm:mb-0">Ngân hàng</span>
                                                <span className="font-bold text-slate-900">Vietcombank</span>
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-2">
                                                <span className="text-slate-500 text-sm mb-1 sm:mb-0">Số tài khoản</span>
                                                <span className="font-mono font-bold text-blue-600 text-lg">1234 5678 9012 3456</span>
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-2">
                                                <span className="text-slate-500 text-sm mb-1 sm:mb-0">Chủ tài khoản</span>
                                                <span className="font-bold text-slate-900">LUNA HOTEL & RESORT</span>
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                                                <span className="text-slate-500 text-sm mb-1 sm:mb-0">Nội dung</span>
                                                <span className="font-mono font-bold bg-slate-100 px-3 py-1 rounded">
                                                    PAY {foundBooking.id.slice(-8).toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={copyBankInfo}
                                            className="mt-4 w-full bg-white border border-blue-200 text-blue-700 py-3 rounded-xl font-bold hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                        >
                                            <i className="fa-regular fa-copy mr-2"></i>Sao chép thông tin
                                        </button>
                                    </div>
                                )}

                                {paymentMethod === "credit" && (
                                    <div className="mt-5 space-y-4 slide-in-up">
                                        <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden h-48 flex flex-col justify-between">
                                            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400 via-transparent to-transparent"></div>
                                            <div className="flex justify-between items-center relative z-10">
                                                <i className="fa-solid fa-microchip text-4xl text-yellow-400 opacity-80"></i>
                                                <div className="space-x-2 text-2xl">
                                                    <i className="fa-brands fa-cc-visa"></i>
                                                    <i className="fa-brands fa-cc-mastercard"></i>
                                                </div>
                                            </div>
                                            <div className="relative z-10 text-center">
                                                <p className="text-2xl font-mono tracking-[0.2em] shadow-sm">
                                                    {cardNumber || "**** **** **** ****"}
                                                </p>
                                            </div>
                                            <div className="flex justify-between relative z-10">
                                                <div>
                                                    <p className="text-[10px] opacity-70 uppercase tracking-widest mb-0.5">Hạn thẻ</p>
                                                    <p className="font-mono text-sm">{cardExpiry || "**/**"}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] opacity-70 uppercase tracking-widest mb-0.5">CVC/CVV</p>
                                                    <p className="font-mono text-sm">{cardCvv.padEnd(3, "*")}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-600 mb-2">Số thẻ</label>
                                            <input
                                                type="text"
                                                value={cardNumber}
                                                onChange={handleCardNumberInput}
                                                maxLength={19}
                                                placeholder="0000 0000 0000 0000"
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-lg font-mono"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-600 mb-2">Hạn thẻ (MM/YY)</label>
                                                <input
                                                    type="text"
                                                    value={cardExpiry}
                                                    onChange={handleCardExpiryInput}
                                                    maxLength={5}
                                                    placeholder="MM/YY"
                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-center"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-600 mb-2">CVV</label>
                                                <input
                                                    type="password"
                                                    value={cardCvv}
                                                    onChange={handleCardCvvInput}
                                                    maxLength={3}
                                                    placeholder="***"
                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-center"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-600 mb-2">Tên chủ thẻ (không dấu)</label>
                                            <input
                                                type="text"
                                                value={cardName}
                                                onChange={(e) => setCardName(e.target.value.toUpperCase())}
                                                placeholder="NGUYEN VAN A"
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 uppercase"
                                            />
                                        </div>
                                    </div>
                                )}

                                {paymentMethod === "wallet" && (
                                    <div className="mt-5 p-6 bg-slate-50 rounded-2xl border border-slate-100 slide-in-up text-center">
                                        <h4 className="font-bold text-slate-800 mb-2">Quét mã QR để thanh toán</h4>
                                        <p className="text-sm text-slate-500 mb-6">Mở ứng dụng ngân hàng hoặc Momo, ZaloPay để quét mã</p>
                                        <div className="inline-block p-4 bg-white rounded-2xl shadow-lg border border-slate-100">
                                            <img
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=LUNA%20HOTEL%20${foundBooking.id}`}
                                                alt="QR Code"
                                                className="w-48 h-48"
                                            />
                                        </div>
                                        <div className="flex justify-center gap-4 mt-6">
                                            <img
                                                src="https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png"
                                                className="h-8 opacity-70 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer"
                                                alt="MoMo"
                                            />
                                            <img
                                                src="https://seeklogo.com/images/Z/zalopay-logo-6EA3E8E20B-seeklogo.com.png"
                                                className="h-8 opacity-70 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer"
                                                alt="ZaloPay"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
                                <button
                                    onClick={() => setIsPaymentModalOpen(false)}
                                    className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                                >
                                    Đóng
                                </button>
                                <button
                                    onClick={processPayment}
                                    disabled={isProcessing}
                                    className="px-6 py-3 rounded-xl font-bold text-white bg-blue-600 shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:-translate-y-0.5 transition-all disabled:opacity-50"
                                >
                                    {isProcessing ? (
                                        <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>
                                    ) : (
                                        <i className="fa-regular fa-credit-card mr-2"></i>
                                    )}
                                    Xác nhận thanh toán
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <Footer />

            {/* Toast container */}
            {toast && (
                <div className="fixed top-5 right-5 z-[9998] space-y-3">
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                </div>
            )}

            <style jsx global>{`
        @keyframes slideInUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .slide-in-up {
          animation: slideInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .loader {
          border: 3px solid #e2e8f0;
          border-top: 3px solid #2563eb;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
        </>
    );
}

// ========== Page export with Suspense ==========
export default function BookingLookupPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            }
        >
            <LookupContent />
        </Suspense>
    );
}
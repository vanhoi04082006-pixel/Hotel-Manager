// src/app/loyalty/page.jsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// Hàm tiện ích
const formatCurrency = (amount) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString("vi-VN") : "";

// Cấu hình hạng thành viên đồng bộ với HTML gốc
const getMemberTier = (points) => {
    if (points >= 10000) return { tier: "Platinum", icon: "fa-crown", color: "from-purple-600 to-purple-800", text: "text-purple-100", bgCard: "from-slate-800 to-slate-900" };
    if (points >= 5000) return { tier: "Gold", icon: "fa-medal", color: "from-yellow-500 to-yellow-600", text: "text-yellow-100", bgCard: "from-yellow-500 to-amber-600" };
    if (points >= 1000) return { tier: "Silver", icon: "fa-star", color: "from-slate-400 to-slate-600", text: "text-slate-100", bgCard: "from-slate-400 to-slate-500" };
    return { tier: "Bronze", icon: "fa-seedling", color: "from-amber-600 to-amber-800", text: "text-amber-200", bgCard: "from-amber-700 to-amber-800" };
};

export default function LoyaltyPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loyaltyData, setLoyaltyData] = useState({
        profile: {},
        paidBookings: [],
        totalSpent: 0,
        points: 0,
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push("/login");
                return;
            }

            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                const profile = userDoc.data() || {};

                const q = query(
                    collection(db, "bookings"),
                    where("userEmail", "==", user.email),
                    where("paymentStatus", "==", "paid")
                );
                const querySnapshot = await getDocs(q);
                const paidBookings = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const totalSpent = paidBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
                const points = Math.floor(totalSpent / 100000);

                setCurrentUser(user);
                setLoyaltyData({
                    profile,
                    paidBookings: paidBookings.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)),
                    totalSpent,
                    points
                });
            } catch (error) {
                console.error("Lỗi tải dữ liệu Loyalty:", error);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    if (loading) {
        return (
            <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center flex-col">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="fa-solid fa-crown text-4xl text-blue-600"></i>
                </div>
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 font-medium">Đang tải thẻ thành viên...</p>
            </div>
        );
    }

    const tierInfo = getMemberTier(loyaltyData.points);
    const displayName = loyaltyData.profile.name || currentUser?.email?.split("@")[0] || "Khách Hàng";
    const shortUid = currentUser?.uid?.slice(0, 4).toUpperCase() || "0000";

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-800">
            <Header />

            <main className="min-h-[calc(100vh-80px)] pb-24">
                {/* Page Banner */}
                <div className="bg-gradient-to-br from-slate-900 to-blue-900 py-16 px-4 mb-20 text-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
                    <div className="relative z-10 max-w-3xl mx-auto">
                        <span className="inline-block py-1 px-3 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/20 text-xs font-bold tracking-widest uppercase mb-4">
                            Luna Rewards
                        </span>
                        <h2 className="text-4xl md:text-5xl font-playfair font-bold text-white mb-4">Chương Trình Khách Hàng Thân Thiết</h2>
                        <p className="text-blue-100 text-lg">Trải nghiệm những đặc quyền độc quyền dành riêng cho bạn tại Luna Hotel.</p>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-32">

                    {/* Thẻ thành viên 3D lật */}
                    <div className="relative max-w-2xl mx-auto mb-20 [perspective:1500px] group">
                        <div className="relative transition-all duration-[800ms] [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] min-h-[380px]">

                            {/* Mặt trước thẻ */}
                            <div className="absolute inset-0 [backface-visibility:hidden] rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_rgb(0,0,0,0.15)] border border-white/20">
                                <div className={`absolute inset-0 bg-gradient-to-br ${tierInfo.bgCard} opacity-95 transition-all duration-500`}></div>
                                <div className="absolute inset-0 opacity-[0.15] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTU0LjYyNyAzLjM3M2ExLjUgMS41IDAgMCAwLTIuMTIxIDBsLTIuMTIxIDIuMTIxYTEuNSAxLjUgMCAxIDAgMi4xMjEgMi4xMjFsMi4xMjEtMi4xMjFhMS41IDEuNSAwIDAgMCAwLTIuMTIxeiIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==')]"></div>

                                <div className="relative h-full p-8 md:p-10 flex flex-col justify-between text-white z-10 font-sans">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.2em] opacity-80 mb-1 font-bold">Luna Hotel & Resort</p>
                                            <h3 className="text-3xl font-playfair font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white via-white/90 to-white/70">Membership</h3>
                                        </div>
                                        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                                            <i className={`fa-solid ${tierInfo.icon} text-3xl`}></i>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-xs uppercase tracking-widest opacity-80 font-semibold">Cấp bậc hiện tại</p>
                                        <p className={`text-3xl font-bold uppercase tracking-wider ${tierInfo.text} drop-shadow-md`}>{tierInfo.tier}</p>
                                    </div>

                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-6">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest opacity-70 mb-1">Mã thẻ thành viên</p>
                                            <p className="text-2xl font-mono tracking-[0.15em] drop-shadow-sm">4021 **** **** {shortUid}</p>
                                        </div>
                                        <div className="sm:text-right">
                                            <p className="font-bold text-lg uppercase tracking-wide drop-shadow-sm truncate max-w-[200px]">{displayName}</p>
                                            <p className="text-xs opacity-70 font-mono mt-1">Valid: 12/26</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Mặt sau thẻ */}
                            <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-slate-900 rounded-[2.5rem] p-8 md:p-10 shadow-2xl border border-slate-700">
                                <div className="h-full flex flex-col relative z-10 text-white">
                                    <h4 className="text-2xl font-playfair font-bold mb-6">Điều khoản sử dụng</h4>
                                    <div className="absolute -left-10 -right-10 top-16 h-12 bg-black opacity-80"></div>

                                    <ul className="space-y-4 text-slate-300 mt-16 text-[14px]">
                                        <li className="flex items-start"><i className="fa-solid fa-circle-check text-blue-500 mr-3 mt-0.5"></i>Thẻ có giá trị đến hết ngày 31/12/2026.</li>
                                        <li className="flex items-start"><i className="fa-solid fa-circle-check text-blue-500 mr-3 mt-0.5"></i>Không được chuyển nhượng dưới mọi hình thức.</li>
                                        <li className="flex items-start"><i className="fa-solid fa-circle-check text-blue-500 mr-3 mt-0.5"></i>Điểm thưởng có giá trị sử dụng trong vòng 12 tháng.</li>
                                        <li className="flex items-start"><i className="fa-solid fa-circle-check text-blue-500 mr-3 mt-0.5"></i>Vui lòng xuất trình mã thẻ khi check-in để tích điểm.</li>
                                    </ul>

                                    <div className="mt-auto pt-6 border-t border-slate-700/50 text-center">
                                        <p className="text-slate-400 text-xs font-mono">support@lunahotel.com | 1900 1234</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p className="text-center text-slate-400 text-sm mt-6 flex items-center justify-center gap-2 animate-bounce">
                            <i className="fa-solid fa-hand-pointer"></i> Di chuột vào thẻ để xem mặt sau
                        </p>
                    </div>

                    {/* Dashboard thông số */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
                        <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Điểm tích lũy hiện tại</p>
                                <p className="text-4xl font-bold text-amber-600 font-mono">{loyaltyData.points.toLocaleString("vi-VN")}</p>
                            </div>
                            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 text-2xl">
                                <i className="fa-solid fa-coins"></i>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Tổng chi tiêu</p>
                                <p className="text-3xl font-bold text-blue-600 font-mono">{formatCurrency(loyaltyData.totalSpent)}</p>
                            </div>
                            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 text-2xl">
                                <i className="fa-solid fa-wallet"></i>
                            </div>
                        </div>
                    </div>

                    {/* Grid các hạng thành viên */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                        {[
                            { id: 'bronze', tier: 'Bronze', icon: 'fa-seedling', color: 'from-amber-600 to-amber-800', discount: '5%' },
                            { id: 'silver', tier: 'Silver', icon: 'fa-star', color: 'from-slate-400 to-slate-600', discount: '10%' },
                            { id: 'gold', tier: 'Gold', icon: 'fa-medal', color: 'from-yellow-500 to-yellow-600', discount: '15%' },
                            { id: 'platinum', tier: 'Platinum', icon: 'fa-crown', color: 'from-purple-600 to-purple-800', discount: '20%' }
                        ].map((item) => (
                            <div key={item.id} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                                <div className={`absolute top-0 right-0 w-24 h-24 bg-slate-400/5 rounded-bl-[4rem] -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} text-white flex items-center justify-center mb-4 shadow-md`}>
                                    <i className={`fa-solid ${item.icon} text-lg`}></i>
                                </div>
                                <h4 className="font-bold text-xl text-slate-900 mb-1">{item.tier}</h4>
                                <p className="text-3xl font-bold text-slate-800 mb-2">{item.discount}</p>
                                <p className="text-sm text-slate-500 font-medium">Giảm giá đặt phòng</p>
                            </div>
                        ))}
                    </div>

                    {/* So sánh quyền lợi & Lịch sử */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
                            <h3 className="text-2xl font-playfair font-bold text-slate-900 mb-6 flex items-center">
                                <i className="fa-solid fa-layer-group text-blue-500 mr-3 text-xl"></i>So sánh quyền lợi
                            </h3>
                            <div className="overflow-x-auto rounded-2xl border border-slate-100 font-sans">
                                <table className="w-full text-left whitespace-nowrap">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-600 text-[13px] uppercase tracking-wide">
                                            <th className="p-4 font-bold">Quyền lợi</th>
                                            <th className="p-4 font-bold">Silver</th>
                                            <th className="p-4 font-bold">Gold</th>
                                            <th className="p-4 font-bold text-blue-600">Plat</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-[15px] text-slate-700">
                                        {[
                                            { label: 'Giảm giá Spa/Ăn uống', s: '5%', g: '10%', p: '15%' },
                                            { label: 'Nâng cấp phòng', s: 'Giảm 30%', g: 'Giảm 50%', p: 'Miễn phí' },
                                            { label: 'Check-in sớm', s: 'Tùy thực tế', g: 'Đảm bảo', p: 'Đảm bảo' },
                                            { label: 'Check-out muộn', s: '-', g: 'Tới 14:00', p: 'Tới 16:00' },
                                            { label: 'Phòng chờ VIP', s: '-', g: 'Có phí', p: 'Miễn phí' },
                                            { label: 'Tích điểm thưởng', s: '1.2x', g: '1.5x', p: '2.0x' },
                                        ].map((row, i) => (
                                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4 font-medium">{row.label}</td>
                                                <td className="p-4 text-slate-500">{row.s}</td>
                                                <td className="p-4 font-bold">{row.g}</td>
                                                <td className="p-4 font-bold text-blue-600">{row.p}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col h-full">
                            <h3 className="text-2xl font-playfair font-bold text-slate-900 mb-6 flex items-center">
                                <i className="fa-solid fa-clock-rotate-left text-blue-500 mr-3 text-xl"></i>Lịch sử tích điểm
                            </h3>

                            <div className="space-y-3 flex-grow overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                                {loyaltyData.paidBookings.length === 0 ? (
                                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-slate-300">
                                            <i className="fa-solid fa-receipt text-2xl"></i>
                                        </div>
                                        <p className="text-slate-500 font-medium">Chưa có giao dịch tích điểm</p>
                                    </div>
                                ) : (
                                    loyaltyData.paidBookings.map((b, i) => {
                                        const earnedPoints = Math.floor((b.finalPaidAmount || b.totalPrice || 0) / 100000);
                                        return (
                                            <div key={b.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:shadow-md transition-all group animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${i * 50}ms` }}>
                                                <div className="flex items-center">
                                                    <div className="w-12 h-12 bg-blue-50 group-hover:bg-blue-600 rounded-xl flex items-center justify-center text-blue-600 group-hover:text-white transition-colors mr-4 shadow-sm">
                                                        <i className="fa-solid fa-bed text-lg"></i>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900">Phòng {b.roomCode}</p>
                                                        <p className="text-[13px] text-slate-500">{formatDate(b.updatedAt || b.createdAt)}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xl font-bold text-green-600 font-mono">+{earnedPoints.toLocaleString()}</p>
                                                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Điểm</p>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />

            <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
        </div>
    );
}
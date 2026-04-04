// src/app/admin/customers/page.jsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, updateDoc, deleteDoc, doc, addDoc, onSnapshot, Timestamp } from "firebase/firestore";

const formatCurrency = (amount) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount || 0);

const initialFormState = {
    id: "",
    name: "",
    email: "",
    phone: "",
    address: "",
    birthday: "",
    role: "regular",
    notes: "",
};

export default function AdminCustomers() {
    const router = useRouter();
    const [users, setUsers] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    // States Lọc & Tìm kiếm
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");

    // States Phân trang
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(10);

    // States Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [isSaving, setIsSaving] = useState(false);

    // 1. Lấy dữ liệu Khách hàng và Booking Real-time
    useEffect(() => {
        const unsubscribeUsers = onSnapshot(collection(db, "users"), (snap) => {
            // Chỉ lấy user thường, bỏ qua admin
            const loadedUsers = snap.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .filter((u) => u.role !== "admin");
            setUsers(loadedUsers);
        });

        const unsubscribeBookings = onSnapshot(collection(db, "bookings"), (snap) => {
            setBookings(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });

        return () => {
            unsubscribeUsers();
            unsubscribeBookings();
        };
    }, []);

    // 2. Trộn dữ liệu, Lọc, Tìm kiếm và Phân trang
    const { customersData, paginatedCustomers, stats, totalPages } = useMemo(() => {
        const query = searchQuery.toLowerCase();

        // Tính toán chi tiêu và điểm cho từng khách hàng
        let processedCustomers = users.map((user) => {
            const customerBookings = bookings.filter((b) => b.userId === user.id || b.userEmail === user.email);
            // Chỉ tính các booking đã thanh toán
            const paidBookings = customerBookings.filter((b) => b.paymentStatus === "paid");
            const totalSpent = paidBookings.reduce((s, b) => s + (b.finalPaidAmount || b.totalPrice || 0), 0);
            const points = user.loyaltyPoints || Math.floor(totalSpent / 100000);

            return {
                ...user,
                bookingCount: customerBookings.length,
                totalSpent,
                points,
            };
        });

        // Lọc theo Role và Search
        processedCustomers = processedCustomers.filter((c) => {
            const matchSearch =
                (c.name || "").toLowerCase().includes(query) ||
                (c.email || "").toLowerCase().includes(query) ||
                (c.phone || "").toLowerCase().includes(query);
            const matchRole = roleFilter === "all" || c.role === roleFilter;

            return matchSearch && matchRole;
        });

        // Sắp xếp theo chi tiêu giảm dần
        processedCustomers.sort((a, b) => b.totalSpent - a.totalSpent);

        const statsObj = {
            total: users.length,
            vip: users.filter(u => u.role === "vip").length,
            corporate: users.filter(u => u.role === "corporate").length,
        };

        // Phân trang
        const totalPagesCount = Math.ceil(processedCustomers.length / limit);
        const start = page * limit;
        const paginated = processedCustomers.slice(start, start + limit);

        return {
            customersData: processedCustomers,
            paginatedCustomers: paginated,
            stats: statsObj,
            totalPages: totalPagesCount
        };
    }, [users, bookings, searchQuery, roleFilter, page, limit]);

    // Đặt lại trang về 0 khi tìm kiếm hoặc đổi bộ lọc
    useEffect(() => {
        setPage(0);
    }, [searchQuery, roleFilter, limit]);

    // 3. Các hàm thao tác
    const openModal = (customer = null) => {
        if (customer) {
            setFormData({
                id: customer.id,
                name: customer.name || "",
                email: customer.email || "",
                phone: customer.phone || "",
                address: customer.address || "",
                birthday: customer.birthday || "",
                role: customer.role || "regular",
                notes: customer.notes || "",
            });
        } else {
            setFormData(initialFormState);
        }
        setIsModalOpen(true);
    };

    const handleSaveCustomer = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const customerData = {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            birthday: formData.birthday,
            role: formData.role,
            notes: formData.notes,
            updatedAt: Timestamp.now(),
        };

        try {
            if (formData.id) {
                await updateDoc(doc(db, "users", formData.id), customerData);
                alert("Cập nhật thông tin khách hàng thành công!");
            } else {
                await addDoc(collection(db, "users"), {
                    ...customerData,
                    createdAt: Timestamp.now(),
                });
                alert("Thêm khách hàng mới thành công!");
            }
            setIsModalOpen(false);
        } catch (error) {
            alert("Lỗi lưu khách hàng: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCustomer = async (id, name) => {
        if (confirm(`Bạn có chắc chắn muốn xóa khách hàng "${name}"? Các hóa đơn và đặt phòng của khách vẫn sẽ được giữ lại.`)) {
            try {
                await deleteDoc(doc(db, "users", id));
            } catch (error) {
                alert("Lỗi xóa khách hàng: " + error.message);
            }
        }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="fade-in max-w-[1600px] mx-auto pb-12 relative z-0">

            {/* Header & Stats */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 border border-slate-200 shadow-sm mb-8 flex flex-col xl:flex-row gap-5 items-start xl:items-center justify-between transition-all">
                <div>
                    <h3 className="text-2xl font-playfair font-bold text-slate-800 flex items-center">
                        Quản lý Khách hàng
                        <span className="ml-3 bg-blue-100 text-blue-600 text-sm font-sans px-3 py-1 rounded-full font-bold shadow-sm">
                            {stats.total} Người
                        </span>
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Quản lý hồ sơ, phân hạng và lịch sử chi tiêu của khách</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                    <div className="relative w-full sm:w-64 flex-shrink-0">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-3.5 text-slate-400"></i>
                        <input
                            type="text"
                            placeholder="Tìm tên, email, sđt..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                        />
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto hide-scrollbar">
                        <button onClick={() => setRoleFilter("all")} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${roleFilter === "all" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Tất cả</button>
                        <button onClick={() => setRoleFilter("vip")} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${roleFilter === "vip" ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-amber-600"}`}>
                            <i className="fa-solid fa-crown mr-1"></i>VIP ({stats.vip})
                        </button>
                        <button onClick={() => setRoleFilter("corporate")} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${roleFilter === "corporate" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-blue-600"}`}>
                            <i className="fa-solid fa-building mr-1"></i>Doanh nghiệp ({stats.corporate})
                        </button>
                    </div>

                    <button onClick={() => openModal()} className="bg-slate-900 text-white rounded-xl px-5 py-2.5 shadow-lg shadow-slate-900/20 hover:bg-blue-600 hover:shadow-blue-600/30 flex-shrink-0 whitespace-nowrap transition-all transform hover:-translate-y-0.5">
                        <i className="fa-solid fa-user-plus mr-2"></i>Thêm khách
                    </button>
                </div>
            </div>

            {/* Bảng danh sách Khách hàng */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-5 font-bold">Khách hàng</th>
                                <th className="px-6 py-5 font-bold">Liên hệ</th>
                                <th className="px-6 py-5 font-bold text-center">Hạng TV</th>
                                <th className="px-6 py-5 font-bold text-right">Tổng chi tiêu</th>
                                <th className="px-6 py-5 font-bold text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100 bg-white">
                            {paginatedCustomers.length > 0 ? paginatedCustomers.map((c, index) => {
                                const isVip = c.role === "vip";
                                const isCorp = c.role === "corporate";

                                // Random chấm xanh lá (Online ảo) để cho giao diện sinh động
                                const isActive = Math.random() > 0.3;

                                return (
                                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${index * 50}ms` }}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="relative mr-4">
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 flex items-center justify-center font-bold text-lg border border-indigo-200 shadow-sm">
                                                        {(c.name || c.email || "U").charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-300"}`}></span>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-[15px]">{c.name || "Khách chưa cập nhật tên"}</div>
                                                    <div className="text-[11px] text-slate-400 font-mono mt-0.5 bg-slate-100 px-2 py-0.5 rounded w-fit">ID: {c.id.slice(-8).toUpperCase()}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center text-slate-600 mb-1.5 text-[13px]"><i className="fa-regular fa-envelope w-5 text-center text-slate-400 mr-1"></i>{c.email}</div>
                                            {c.phone ? (
                                                <div className="flex items-center text-slate-600 text-[13px]"><i className="fa-solid fa-phone w-5 text-center text-slate-400 mr-1"></i>{c.phone}</div>
                                            ) : (
                                                <div className="text-xs text-slate-400 italic ml-6">Chưa cập nhật SĐT</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${isVip ? "bg-amber-50 text-amber-700 border-amber-200" : isCorp ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                                                {isVip ? <><i className="fa-solid fa-crown mr-1.5"></i>VIP</> : isCorp ? <><i className="fa-solid fa-building mr-1.5"></i>Doanh nghiệp</> : "Thường"}
                                            </span>
                                            <div className="text-[11px] text-slate-500 mt-2 font-medium bg-slate-50 px-2 py-1 rounded-lg inline-block border border-slate-100">
                                                <i className="fa-solid fa-star text-amber-400 mr-1"></i>{c.points.toLocaleString()} điểm
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="font-mono font-bold text-slate-800 text-[15px]">{formatCurrency(c.totalSpent)}</div>
                                            <div onClick={() => router.push("/admin/bookings")} className="text-[11px] font-medium text-blue-500 mt-1.5 bg-blue-50 px-2 py-1 rounded-lg inline-block cursor-pointer hover:bg-blue-100 transition-colors">
                                                {c.bookingCount} Booking đã đặt <i className="fa-solid fa-arrow-right text-[8px] ml-1"></i>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openModal(c)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shadow-sm border border-transparent hover:border-blue-100" title="Chỉnh sửa">
                                                    <i className="fa-solid fa-pen-to-square text-sm"></i>
                                                </button>
                                                <button onClick={() => handleDeleteCustomer(c.id, c.name || c.email)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shadow-sm border border-transparent hover:border-red-100" title="Xóa khách hàng">
                                                    <i className="fa-solid fa-trash text-sm"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                            <i className="fa-solid fa-users-slash text-2xl"></i>
                                        </div>
                                        <p className="text-slate-500 font-medium">Không tìm thấy khách hàng nào phù hợp với bộ lọc.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Component Phân trang */}
            {paginatedCustomers.length > 0 && totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-6 p-4 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm gap-4">
                    <div className="flex items-center gap-3">
                        <p className="text-sm text-slate-500 font-medium">Hiển thị</p>
                        <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(0); }} className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none p-1.5 px-3 font-bold cursor-pointer hover:bg-white transition-colors">
                            <option value="5">5</option>
                            <option value="10">10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                        </select>
                        <p className="text-sm text-slate-500">/ {customersData.length} khách hàng</p>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                        <button onClick={() => setPage(page - 1)} disabled={page === 0} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                            <i className="fa-solid fa-chevron-left text-xs"></i>
                        </button>

                        {Array.from({ length: totalPages }).map((_, i) => {
                            if (totalPages > 7 && i !== 0 && i !== totalPages - 1 && Math.abs(i - page) > 1) {
                                if (i === 1 || i === totalPages - 2) return <span key={i} className="px-1 text-slate-400">...</span>;
                                return null;
                            }
                            return (
                                <button key={i} onClick={() => setPage(i)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-all duration-300 ${page === i ? "bg-slate-800 text-white shadow-md scale-110" : "text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-sm"}`}>
                                    {i + 1}
                                </button>
                            );
                        })}

                        <button onClick={() => setPage(page + 1)} disabled={page === totalPages - 1} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                            <i className="fa-solid fa-chevron-right text-xs"></i>
                        </button>
                    </div>
                </div>
            )}

            {/* Modal Thêm/Sửa Khách hàng */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl animate-in zoom-in duration-300 border border-slate-100">
                        <div className="p-6 md:p-8">
                            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                                <h3 className="text-2xl font-playfair font-bold text-slate-900">{formData.id ? "Cập nhật khách hàng" : "Thêm khách hàng mới"}</h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center transition-all"><i className="fa-solid fa-xmark text-xl"></i></button>
                            </div>

                            <form onSubmit={handleSaveCustomer} className="space-y-4">
                                <div>
                                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Họ và tên <span className="text-red-500">*</span></label>
                                    <input type="text" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all" placeholder="VD: Nguyễn Văn A" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>

                                <div>
                                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Email <span className="text-red-500">*</span></label>
                                    <input type="email" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all" placeholder="customer@email.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                </div>

                                <div>
                                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Số điện thoại</label>
                                    <input type="tel" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all" placeholder="090 123 4567" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                </div>

                                <div>
                                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Địa chỉ</label>
                                    <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all" placeholder="123 Đường ABC, Quận 1" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Ngày sinh</label>
                                        <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all" value={formData.birthday} onChange={e => setFormData({ ...formData, birthday: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Phân loại khách</label>
                                        <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all font-medium text-slate-700" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                            <option value="regular">Thường (Regular)</option>
                                            <option value="vip">Khách VIP</option>
                                            <option value="corporate">Doanh nghiệp</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Ghi chú đặc biệt</label>
                                    <textarea rows="2" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all" placeholder="Sở thích ăn uống, lưu ý sức khỏe..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}></textarea>
                                </div>

                                <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100 mt-6">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">Hủy</button>
                                    <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 flex items-center">
                                        {isSaving ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Đang lưu...</> : "Lưu thông tin"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
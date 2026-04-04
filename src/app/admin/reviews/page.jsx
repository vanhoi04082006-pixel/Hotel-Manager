// src/app/admin/reviews/page.jsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, updateDoc, deleteDoc, doc, onSnapshot, Timestamp } from "firebase/firestore";

const formatDateTime = (dateString) => {
    if (!dateString) return "";
    try {
        const d = dateString?.toDate ? dateString.toDate() : new Date(dateString);
        return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
};

export default function AdminReviews() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);

    // States Lọc & Tìm kiếm
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // States Phân trang
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(10);
    const listRef = useRef(null);

    // States Modal Trả lời
    const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
    const [replyForm, setReplyForm] = useState({ id: "", name: "", content: "", reply: "" });
    const [isReplying, setIsReplying] = useState(false);

    // 1. Lấy dữ liệu Real-time
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "reviews"), (snap) => {
            const loadedReviews = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            // Sắp xếp đánh giá mới nhất lên đầu
            loadedReviews.sort((a, b) => {
                const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
                const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
                return timeB - timeA;
            });
            setReviews(loadedReviews);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. Logic Lọc, Thống kê và Phân trang
    const { filteredReviews, paginatedReviews, stats, totalPages } = useMemo(() => {
        const query = searchQuery.toLowerCase();

        // Lọc dữ liệu
        const filtered = reviews.filter((r) => {
            const matchSearch =
                (r.userName || "").toLowerCase().includes(query) ||
                (r.userEmail || "").toLowerCase().includes(query) ||
                (r.roomCode || "").toLowerCase().includes(query) ||
                (r.content || "").toLowerCase().includes(query);

            const rStatus = r.status || (r.approved ? "approved" : "pending");
            const matchStatus = statusFilter === "all" || rStatus === statusFilter;
            return matchSearch && matchStatus;
        });

        // Thống kê (Dựa trên toàn bộ reviews chứ không phải list đã lọc)
        const approvedReviews = reviews.filter((r) => r.status === "approved" || r.approved === true);
        const avgRating = approvedReviews.length > 0
            ? (approvedReviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / approvedReviews.length).toFixed(1)
            : "0.0";

        const starCounts = [5, 4, 3, 2, 1].map(s => reviews.filter(r => (Number(r.rating) || 5) === s).length);

        const statsObj = {
            total: reviews.length,
            pending: reviews.filter((r) => r.status === "pending" || (!r.status && !r.approved)).length,
            approved: approvedReviews.length,
            rejected: reviews.filter((r) => r.status === "rejected").length,
            averageRating: avgRating,
            starCounts
        };

        // Phân trang
        const totalPagesCount = Math.ceil(filtered.length / limit);
        const start = page * limit;
        const paginated = filtered.slice(start, start + limit);

        return { filteredReviews: filtered, paginatedReviews: paginated, stats: statsObj, totalPages: totalPagesCount };
    }, [reviews, searchQuery, statusFilter, page, limit]);

    // Đặt lại trang về 0 khi tìm kiếm / lọc thay đổi
    useEffect(() => {
        setPage(0);
    }, [searchQuery, statusFilter, limit]);

    const handlePageChange = (newPage) => {
        setPage(newPage);
        if (listRef.current) {
            listRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    // 3. Render Ngôi sao
    const renderStars = (rating) => {
        const num = Number(rating) || 5;
        return (
            <div className="flex text-amber-400 text-[10px] mt-0.5">
                {Array(5).fill(0).map((_, i) => (
                    <i key={i} className={`fa-solid fa-star ${i < num ? "" : "text-slate-200"}`}></i>
                ))}
            </div>
        );
    };

    // 4. Các Hàm Thao tác
    const updateReviewStatus = async (id, newStatus) => {
        try {
            await updateDoc(doc(db, "reviews", id), {
                status: newStatus,
                approved: newStatus === "approved",
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            alert("Lỗi cập nhật trạng thái: " + error.message);
        }
    };

    const deleteReview = async (id) => {
        if (confirm("Bạn có chắc chắn muốn xóa vĩnh viễn đánh giá này?")) {
            try {
                await deleteDoc(doc(db, "reviews", id));
            } catch (error) {
                alert("Lỗi xóa đánh giá: " + error.message);
            }
        }
    };

    const openReplyModal = (review) => {
        setReplyForm({
            id: review.id,
            name: review.anonymous ? 'Khách ẩn danh' : (review.userName || 'Khách hàng'),
            content: review.content || '',
            reply: review.reply || ''
        });
        setIsReplyModalOpen(true);
    };

    const handleReplySubmit = async (e) => {
        e.preventDefault();
        if (!replyForm.reply.trim()) {
            alert("Vui lòng nhập nội dung phản hồi!");
            return;
        }

        setIsReplying(true);
        try {
            await updateDoc(doc(db, "reviews", replyForm.id), {
                reply: replyForm.reply.trim(),
                replyAt: Timestamp.now(),
                replyBy: "Admin", // Hoặc lấy từ store.currentUser.name nếu có
                status: "approved", // Tự động duyệt nếu quản lý đã trả lời
                approved: true
            });
            setIsReplyModalOpen(false);
        } catch (error) {
            alert("Lỗi gửi phản hồi: " + error.message);
        } finally {
            setIsReplying(false);
        }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="fade-in pb-12 max-w-5xl mx-auto relative z-0">

            {/* Block Thống kê Tổng quan (Giống HTML gốc) */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-8 shadow-sm">
                <div className="flex flex-col md:flex-row items-center w-full">
                    <div className="text-center md:mr-8 md:border-r border-slate-200 md:pr-8 mb-6 md:mb-0 shrink-0">
                        <h2 className="text-6xl font-bold text-slate-800 mb-1 font-mono tracking-tight">{stats.averageRating}</h2>
                        <div className="flex text-amber-400 text-lg justify-center mb-2">
                            {Array(5).fill(0).map((_, i) => (
                                <i key={i} className={`fa-solid fa-star ${i < Math.round(stats.averageRating) ? "" : "text-slate-200"}`}></i>
                            ))}
                        </div>
                        <p className="text-sm text-slate-500 font-medium">{stats.total} đánh giá</p>
                    </div>
                    <div className="flex-1 space-y-2.5 w-full">
                        {[5, 4, 3, 2, 1].map((s, idx) => (
                            <div key={s} className="flex items-center text-sm">
                                <span className="w-3 text-slate-500 font-medium text-right">{s}</span>
                                <i className="fa-solid fa-star text-amber-400 mx-2 text-[11px]"></i>
                                <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden mx-2">
                                    <div
                                        className="bg-amber-400 h-full rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${reviews.length ? (stats.starCounts[idx] / reviews.length) * 100 : 0}%` }}
                                    ></div>
                                </div>
                                <span className="w-8 text-right text-slate-400 text-xs font-medium">{stats.starCounts[idx]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Thanh Tìm kiếm & Lọc */}
            <div ref={listRef} className="bg-white/80 backdrop-blur-xl p-3 rounded-3xl border border-slate-200/60 shadow-sm mb-8 flex flex-col md:flex-row justify-between gap-4 transition-all">
                <div className="flex overflow-x-auto gap-2 items-center px-2 hide-scrollbar">
                    <button onClick={() => setStatusFilter("all")} className={`px-6 py-2.5 rounded-2xl font-bold text-sm transition-all border whitespace-nowrap ${statusFilter === "all" ? "bg-slate-900 text-white shadow-md border-slate-900" : "text-slate-600 hover:bg-slate-50 border-transparent"}`}>
                        Tất cả
                    </button>
                    <div className="w-px h-6 bg-slate-200 mx-2 hidden sm:block"></div>
                    <button onClick={() => setStatusFilter("pending")} className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all border whitespace-nowrap flex items-center ${statusFilter === "pending" ? "bg-amber-500 text-white shadow-md border-amber-500" : "text-amber-600 hover:bg-amber-50 border-transparent"}`}>
                        <i className="fa-solid fa-clock mr-2"></i>Chờ duyệt ({stats.pending})
                    </button>
                    <button onClick={() => setStatusFilter("approved")} className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all border whitespace-nowrap flex items-center ${statusFilter === "approved" ? "bg-emerald-500 text-white shadow-md border-emerald-500" : "text-emerald-600 hover:bg-emerald-50 border-transparent"}`}>
                        <i className="fa-solid fa-check mr-2"></i>Đã duyệt ({stats.approved})
                    </button>
                    <button onClick={() => setStatusFilter("rejected")} className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all border whitespace-nowrap flex items-center ${statusFilter === "rejected" ? "bg-rose-500 text-white shadow-md border-rose-500" : "text-rose-600 hover:bg-rose-50 border-transparent"}`}>
                        <i className="fa-solid fa-eye-slash mr-2"></i>Đã ẩn ({stats.rejected})
                    </button>
                </div>

                <div className="relative w-full md:w-[350px] shrink-0">
                    <i className="fa-solid fa-magnifying-glass absolute left-5 top-3.5 text-slate-400"></i>
                    <input
                        type="text"
                        placeholder="Tìm theo tên, nội dung, phòng..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-sm font-medium"
                    />
                </div>
            </div>

            {/* Danh sách Đánh giá (Dạng List dọc như HTML) */}
            {paginatedReviews.length > 0 ? (
                <div className="space-y-5">
                    {paginatedReviews.map((r, index) => {
                        const rStatus = r.status || (r.approved ? "approved" : "pending");
                        const isApproved = rStatus === "approved";
                        const isPending = rStatus === "pending";

                        return (
                            <div key={r.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 hover:shadow-lg transition-all duration-300 relative group animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${(index % 10) * 0.05}s` }}>

                                {isPending && <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full m-5 shadow-sm ring-4 ring-red-50" title="Chờ duyệt"></div>}

                                <div className="flex gap-5">
                                    {/* Avatar */}
                                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 flex items-center justify-center font-bold text-xl border border-indigo-200 flex-shrink-0 shadow-sm">
                                        {r.anonymous ? "A" : (r.userName || r.userEmail || "U").charAt(0).toUpperCase()}
                                    </div>

                                    {/* Nội dung */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-2 gap-2">
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-[15px]">{r.anonymous ? "Khách hàng ẩn danh" : r.userName}</h4>
                                                <div className="flex items-center text-xs text-slate-500 mt-1 space-x-2">
                                                    <span><i className="fa-regular fa-clock mr-1 opacity-70"></i>{formatDateTime(r.createdAt)}</span>
                                                    <span>•</span>
                                                    <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Phòng {r.roomCode}</span>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 shrink-0">
                                                {renderStars(r.rating)}
                                            </div>
                                        </div>

                                        <h5 className="font-bold text-slate-700 mt-4 text-[15px]">{r.title || ""}</h5>
                                        <p className="text-slate-600 text-[15px] mt-1 mb-5 leading-relaxed">"{r.content}"</p>

                                        {/* Phản hồi từ KS */}
                                        {r.reply && (
                                            <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100 mb-5 relative">
                                                <i className="fa-solid fa-reply absolute top-5 left-5 text-blue-200 text-lg transform scale-x-[-1]"></i>
                                                <div className="pl-8">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <p className="text-[13px] font-bold text-blue-800">Phản hồi từ khách sạn</p>
                                                        <span className="text-[10px] text-blue-500 bg-white px-2 py-0.5 rounded border border-blue-100">Đã trả lời</span>
                                                    </div>
                                                    <p className="text-[14px] text-slate-700 italic leading-relaxed">{r.reply}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="flex items-center space-x-2 border-t border-slate-100 pt-4">
                                            {isPending && (
                                                <button onClick={() => updateReviewStatus(r.id, "approved")} className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm">
                                                    <i className="fa-solid fa-check mr-1.5"></i>Duyệt hiển thị
                                                </button>
                                            )}
                                            {isApproved && (
                                                <button onClick={() => updateReviewStatus(r.id, "rejected")} className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm">
                                                    <i className="fa-solid fa-eye-slash mr-1.5"></i>Ẩn đánh giá
                                                </button>
                                            )}
                                            <button onClick={() => openReplyModal(r)} className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 rounded-xl text-xs font-bold transition-all shadow-sm">
                                                <i className="fa-solid fa-reply mr-1.5"></i>{r.reply ? "Sửa phản hồi" : "Trả lời khách"}
                                            </button>
                                            <button onClick={() => deleteReview(r.id)} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-500 rounded-xl text-xs transition-all ml-auto shadow-sm border border-transparent hover:border-red-600">
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white rounded-[3rem] border border-dashed border-slate-300 p-24 text-center shadow-sm mt-8">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300 border border-slate-100">
                        <i className="fa-regular fa-comments text-4xl"></i>
                    </div>
                    <h3 className="text-2xl font-playfair font-bold text-slate-800 mb-3">Không có đánh giá nào!</h3>
                    <p className="text-slate-500 text-[15px] mb-8 max-w-md mx-auto">Chưa có bài đánh giá nào khớp với trạng thái lọc hoặc từ khóa của bạn.</p>
                    <button onClick={() => { setStatusFilter("all"); setSearchQuery(""); setPage(0); }} className="bg-slate-900 text-white hover:bg-blue-600 rounded-2xl px-10 py-3.5 font-bold transition-all shadow-lg transform hover:-translate-y-1">
                        Xóa bộ lọc & Tải lại
                    </button>
                </div>
            )}

            {/* Phân trang */}
            {paginatedReviews.length > 0 && totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-10 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm gap-4">
                    <div className="flex items-center gap-3">
                        <p className="text-sm text-slate-500 font-medium">Hiển thị</p>
                        <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(0); }} className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none p-1.5 px-3 font-bold cursor-pointer hover:bg-white transition-colors">
                            <option value="5">5</option>
                            <option value="10">10</option>
                            <option value="20">20</option>
                        </select>
                        <p className="text-sm text-slate-500">/ {filteredReviews.length} mục</p>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                        <button onClick={() => handlePageChange(page - 1)} disabled={page === 0} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                            <i className="fa-solid fa-chevron-left text-xs"></i>
                        </button>

                        {Array.from({ length: totalPages }).map((_, i) => {
                            if (totalPages > 7 && i !== 0 && i !== totalPages - 1 && Math.abs(i - page) > 1) {
                                if (i === 1 || i === totalPages - 2) return <span key={i} className="px-1 text-slate-400">...</span>;
                                return null;
                            }
                            return (
                                <button key={i} onClick={() => handlePageChange(i)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-all duration-300 ${page === i ? "bg-slate-800 text-white shadow-md scale-110" : "text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-sm"}`}>
                                    {i + 1}
                                </button>
                            );
                        })}

                        <button onClick={() => handlePageChange(page + 1)} disabled={page === totalPages - 1} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                            <i className="fa-solid fa-chevron-right text-xs"></i>
                        </button>
                    </div>
                </div>
            )}

            {/* Modal Trả lời Đánh giá */}
            {isReplyModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-in zoom-in duration-300 border border-slate-100 overflow-hidden">
                        <div className="p-6 md:p-8">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-playfair font-bold text-slate-900">Trả lời đánh giá</h3>
                                <button onClick={() => setIsReplyModalOpen(false)} className="text-slate-400 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center transition-all"><i className="fa-solid fa-xmark text-xl"></i></button>
                            </div>

                            <div className="bg-slate-50 p-5 rounded-2xl mb-6 border border-slate-100 relative">
                                <i className="fa-solid fa-quote-left absolute text-3xl text-slate-200/50 top-3 left-4"></i>
                                <p className="text-[13px] font-bold text-slate-800 mb-1 relative z-10">{replyForm.name}</p>
                                <p className="text-[14px] text-slate-600 italic relative z-10">"{replyForm.content}"</p>
                            </div>

                            <form onSubmit={handleReplySubmit}>
                                <div>
                                    <label className="block text-[13px] font-semibold text-slate-600 mb-2">Phản hồi từ Khách sạn <span className="text-red-500">*</span></label>
                                    <textarea rows="4" className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-[15px] text-slate-800" placeholder="Cảm ơn quý khách đã dành thời gian đánh giá..." value={replyForm.reply} onChange={e => setReplyForm({ ...replyForm, reply: e.target.value })} required></textarea>
                                </div>
                                <div className="flex justify-end space-x-3 pt-6 mt-4 border-t border-slate-100">
                                    <button type="button" onClick={() => setIsReplyModalOpen(false)} className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">Hủy</button>
                                    <button type="submit" disabled={isReplying} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 flex items-center">
                                        {isReplying ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Đang gửi...</> : <><i className="fa-solid fa-paper-plane mr-2"></i>Gửi phản hồi</>}
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
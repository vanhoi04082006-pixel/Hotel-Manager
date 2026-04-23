// src/app/admin/reviews/page.jsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, updateDoc, deleteDoc, doc, onSnapshot, Timestamp } from "firebase/firestore";

const formatDateTime = (dateString) => {
    if (!dateString) return "";
    try {
        const d = dateString?.toDate ? dateString.toDate() : new Date(dateString);
        return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
};

export default function AdminRoomDetailsAndReviews() {
    const [rooms, setRooms] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);

    // States Lọc & Tìm kiếm
    const [searchQuery, setSearchQuery] = useState("");

    // States cho Chế độ Xem Trang Chi Tiết (Thay thế Modal)
    const [selectedRoom, setSelectedRoom] = useState(null);
    
    // State Sửa thông tin Phòng (Mô tả & Hình ảnh)
    const [editDesc, setEditDesc] = useState("");
    const [editImages, setEditImages] = useState([""]);
    const [isUpdatingRoom, setIsUpdatingRoom] = useState(false);

    // State cho Form Trả lời Bình luận
    const [replyingTo, setReplyingTo] = useState(null); 
    const [replyText, setReplyText] = useState("");
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);

    // 1. Lấy dữ liệu Real-time cả Phòng và Đánh giá
    useEffect(() => {
        const unsubscribeRooms = onSnapshot(collection(db, "rooms"), (snap) => {
            setRooms(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubscribeReviews = onSnapshot(collection(db, "reviews"), (snap) => {
            const loadedReviews = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            loadedReviews.sort((a, b) => {
                const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
                const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
                return timeB - timeA;
            });
            setReviews(loadedReviews);
            setLoading(false);
        });

        return () => {
            unsubscribeRooms();
            unsubscribeReviews();
        };
    }, []);

    // 2. Phân loại và tính toán
    const { filteredRooms, groupedRooms, sortedFloors, totalReviews } = useMemo(() => {
        const query = searchQuery.toLowerCase();
        let totalRevCount = 0;

        const roomsWithData = rooms.map(room => {
            const roomRevs = reviews.filter(r => r.roomId === room.id);
            totalRevCount += roomRevs.length;
            const avgRating = roomRevs.length > 0 
                ? roomRevs.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / roomRevs.length 
                : 0;
            const hasUnreplied = roomRevs.some(r => !r.reply); 

            return { ...room, reviews: roomRevs, avgRating, hasUnreplied };
        });

        const filtered = roomsWithData.filter(room => {
            return (room.code || "").toLowerCase().includes(query) ||
                   (room.name || "").toLowerCase().includes(query);
        }).sort((a, b) => {
            const numA = parseInt((a.code || "").replace(/\D/g, "")) || 0;
            const numB = parseInt((b.code || "").replace(/\D/g, "")) || 0;
            return numA - numB;
        });

        const grouped = {};
        filtered.forEach(room => {
            let floorStr = "Khác";
            if (room.code) {
                const matches = room.code.match(/\d+/);
                if (matches) floorStr = matches[0].length >= 3 ? matches[0].charAt(0) : matches[0];
            }
            const floorName = `Tầng ${floorStr}`;
            if (!grouped[floorName]) grouped[floorName] = [];
            grouped[floorName].push(room);
        });

        const sorted = Object.keys(grouped).sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, "")) || 999;
            const numB = parseInt(b.replace(/\D/g, "")) || 999;
            return numA - numB;
        });

        return { filteredRooms: filtered, groupedRooms: grouped, sortedFloors: sorted, totalReviews: totalRevCount };
    }, [rooms, reviews, searchQuery]);

    // 3. Mở chế độ xem trang chi tiết
    const openRoomDetails = (room) => {
        setSelectedRoom(room);
        setEditDesc(room.description || "");
        setEditImages(room.images && room.images.length > 0 ? room.images : [room.image || ""]);
        setReplyingTo(null);
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Tự động cuộn lên đầu trang
    };

    // Đóng trang chi tiết
    const closeRoomDetails = () => {
        setSelectedRoom(null);
    };

    // Tự động cập nhật selectedRoom khi có dữ liệu mới (Ví dụ: vừa trả lời xong 1 đánh giá)
    useEffect(() => {
        if (selectedRoom) {
            const updatedRoom = filteredRooms.find(r => r.id === selectedRoom.id);
            if (updatedRoom) setSelectedRoom(updatedRoom);
        }
    }, [filteredRooms]);

    // 4. Xử lý CẬP NHẬT THÔNG TIN PHÒNG (Mô tả & Hình ảnh)
    const handleImageChange = (index, value) => {
        const newImages = [...editImages];
        newImages[index] = value;
        setEditImages(newImages);
    };
    const addImageField = () => setEditImages([...editImages, ""]);
    const removeImageField = (index) => {
        const newImages = [...editImages];
        newImages.splice(index, 1);
        setEditImages(newImages);
    };

    const saveRoomDetails = async () => {
        setIsUpdatingRoom(true);
        try {
            const validImages = editImages.filter(img => img.trim() !== "");
            await updateDoc(doc(db, "rooms", selectedRoom.id), {
                description: editDesc.trim(),
                images: validImages,
                image: validImages.length > 0 ? validImages[0] : selectedRoom.image
            });
            alert("Đã lưu thông tin phòng thành công! Dữ liệu đã đồng bộ sang trang của Khách.");
        } catch (error) {
            alert("Lỗi lưu thông tin: " + error.message);
        } finally {
            setIsUpdatingRoom(false);
        }
    };

    // 5. Các hàm xử lý Review
    const deleteReview = async (id) => {
        if (confirm("Xóa vĩnh viễn bình luận này khỏi hệ thống?")) {
            try {
                await deleteDoc(doc(db, "reviews", id));
            } catch (error) {
                alert("Lỗi xóa đánh giá: " + error.message);
            }
        }
    };

    const submitReply = async (e, reviewId) => {
        e.preventDefault();
        if (!replyText.trim()) return;
        setIsSubmittingReply(true);
        try {
            await updateDoc(doc(db, "reviews", reviewId), {
                reply: replyText.trim(),
                replyAt: Timestamp.now(),
                replyBy: "Quản lý Luna"
            });
            setReplyingTo(null);
            setReplyText("");
        } catch (error) {
            alert("Lỗi gửi phản hồi: " + error.message);
        } finally {
            setIsSubmittingReply(false);
        }
    };

    const renderStars = (rating) => {
        const num = Math.round(Number(rating)) || 0;
        return (
            <div className="flex text-amber-400 text-xs">
                {Array(5).fill(0).map((_, i) => (
                    <i key={i} className={`fa-solid fa-star ${i < num ? "" : "text-slate-200"}`}></i>
                ))}
            </div>
        );
    };

    if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    // HIỂN THỊ CHẾ ĐỘ TRANG CHI TIẾT (NẾU ĐÃ CHỌN 1 PHÒNG)
    if (selectedRoom) {
        return (
            <div className="fade-in pb-12 max-w-[1600px] mx-auto p-4 md:p-8 animate-in slide-in-from-right-8 duration-500">
                {/* Thanh điều hướng Quay lại */}
                <div className="mb-6 flex items-center justify-between">
                    <button onClick={closeRoomDetails} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold bg-white px-5 py-2.5 rounded-full shadow-sm border border-slate-200 hover:border-blue-200 transition-all">
                        <i className="fa-solid fa-arrow-left"></i> Quay lại danh sách
                    </button>
                    <div className="text-right hidden sm:block">
                        <h2 className="text-2xl font-playfair font-bold text-slate-800">Phòng {selectedRoom.code}</h2>
                        <p className="text-sm text-slate-500 font-medium">{selectedRoom.name}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    {/* CỘT TRÁI: CHỈNH SỬA HÌNH ẢNH & MÔ TẢ */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100">
                            <h4 className="font-bold text-xl text-slate-800 mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
                                <i className="fa-solid fa-pen-to-square text-blue-500 bg-blue-50 w-10 h-10 flex items-center justify-center rounded-xl"></i> 
                                Thông tin hiển thị
                            </h4>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Đoạn văn giới thiệu phòng</label>
                                    <textarea rows="5" value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 focus:bg-white transition-all text-sm leading-relaxed" placeholder="Nhập đoạn mô tả hấp dẫn về căn phòng..."></textarea>
                                </div>
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Bộ sưu tập ảnh (Link URL)</label>
                                    <div className="space-y-3">
                                        {editImages.map((img, idx) => (
                                            <div key={idx} className="flex gap-2 items-center group relative">
                                                <div className="relative flex-1">
                                                    <input type="text" value={img} onChange={e => handleImageChange(idx, e.target.value)} className="w-full p-3.5 pl-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs font-medium" placeholder="https://..." />
                                                    {img && <img src={img} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-slate-200 object-cover shadow-sm border border-slate-100" alt="preview" onError={(e) => e.target.style.display='none'} />}
                                                </div>
                                                <button onClick={() => removeImageField(idx)} className="w-12 h-12 shrink-0 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-colors flex items-center justify-center shadow-sm"><i className="fa-solid fa-trash text-sm"></i></button>
                                            </div>
                                        ))}
                                        <button onClick={addImageField} className="text-sm font-bold text-blue-600 hover:text-white hover:bg-blue-600 bg-blue-50 px-4 py-3.5 rounded-2xl w-full transition-all flex items-center justify-center border border-blue-100 border-dashed mt-2">
                                            <i className="fa-solid fa-plus mr-2"></i> Thêm link ảnh mới
                                        </button>
                                    </div>
                                </div>
                                <button onClick={saveRoomDetails} disabled={isUpdatingRoom} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[15px] hover:bg-blue-600 transition-all shadow-xl hover:shadow-blue-600/30 disabled:opacity-50 flex justify-center items-center mt-4">
                                    {isUpdatingRoom ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i>ĐANG LƯU...</> : <><i className="fa-solid fa-cloud-arrow-up mr-2"></i>LƯU THAY ĐỔI</>}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* CỘT PHẢI: DANH SÁCH ĐÁNH GIÁ CỦA PHÒNG ĐÓ */}
                    <div className="lg:col-span-3">
                        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100 h-full min-h-[600px]">
                            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                                <h4 className="font-bold text-xl text-slate-800 flex items-center gap-3">
                                    <i className="fa-solid fa-comments text-amber-500 bg-amber-50 w-10 h-10 flex items-center justify-center rounded-xl"></i> 
                                    Bình luận của Khách
                                </h4>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-amber-500">{selectedRoom.avgRating.toFixed(1)} <i className="fa-solid fa-star"></i></p>
                                    <p className="text-xs text-slate-400 font-medium">({selectedRoom.reviews.length} đánh giá)</p>
                                </div>
                            </div>
                            
                            <div className="space-y-6">
                                {selectedRoom.reviews.length === 0 ? (
                                    <div className="text-center py-20">
                                        <i className="fa-regular fa-comment-dots text-6xl text-slate-200 mb-4 block"></i>
                                        <p className="text-slate-400 font-medium text-lg">Phòng này chưa có bình luận nào.</p>
                                    </div>
                                ) : (
                                    selectedRoom.reviews.map(r => (
                                        <div key={r.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 hover:border-slate-200 transition-colors">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 flex items-center justify-center font-bold text-lg shadow-inner">
                                                        {r.guestName?.charAt(0).toUpperCase() || "K"}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-[15px]">{r.guestName}</h4>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <div className="bg-white px-2 py-0.5 rounded shadow-sm border border-slate-100">{renderStars(r.rating)}</div>
                                                            <span className="text-[11px] text-slate-400 font-medium">{formatDateTime(r.createdAt)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <p className="text-slate-700 text-[15px] leading-relaxed mb-5 italic">"{r.comment}"</p>

                                            {/* Phản hồi của Khách sạn */}
                                            {r.reply && (
                                                <div className="ml-6 sm:ml-12 mb-5 bg-blue-50/70 p-5 rounded-2xl border border-blue-100 relative">
                                                    <i className="fa-solid fa-reply absolute top-5 left-4 text-blue-200 text-lg transform scale-x-[-1]"></i>
                                                    <div className="pl-8">
                                                        <p className="text-xs font-black text-blue-800 mb-1 uppercase tracking-wider">{r.replyBy || "Quản lý Khách sạn"}</p>
                                                        <p className="text-[14px] text-slate-700 leading-relaxed">{r.reply}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Form Nhập câu trả lời */}
                                            {replyingTo === r.id ? (
                                                <form onSubmit={(e) => submitReply(e, r.id)} className="ml-6 sm:ml-12 mt-4 animate-in fade-in slide-in-from-top-2">
                                                    <textarea 
                                                        autoFocus rows="3" placeholder="Nhập câu trả lời chuyên nghiệp của khách sạn..." 
                                                        value={replyText} onChange={(e) => setReplyText(e.target.value)}
                                                        className="w-full p-4 bg-white border border-blue-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 text-sm transition-all mb-3 shadow-sm" required
                                                    />
                                                    <div className="flex justify-end gap-3">
                                                        <button type="button" onClick={() => setReplyingTo(null)} className="px-5 py-2 rounded-xl text-xs font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 transition-colors">Hủy bỏ</button>
                                                        <button type="submit" disabled={isSubmittingReply} className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 flex items-center">
                                                            {isSubmittingReply ? "Đang gửi..." : <><i className="fa-solid fa-paper-plane mr-2"></i> Đăng câu trả lời</>}
                                                        </button>
                                                    </div>
                                                </form>
                                            ) : (
                                                <div className="flex justify-end gap-4 pt-4 border-t border-slate-200/60">
                                                    <button onClick={() => { setReplyingTo(r.id); setReplyText(r.reply || ""); }} className="text-[12px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-4 py-2 rounded-xl transition-colors">
                                                        <i className="fa-solid fa-reply mr-1.5"></i> {r.reply ? "Chỉnh sửa phản hồi" : "Trả lời bình luận"}
                                                    </button>
                                                    <button onClick={() => deleteReview(r.id)} className="text-[12px] font-bold text-rose-500 hover:text-white bg-rose-50 hover:bg-rose-500 px-4 py-2 rounded-xl transition-all">
                                                        <i className="fa-solid fa-trash mr-1.5"></i> Xóa
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // HIỂN THỊ DANH SÁCH CÁC PHÒNG BÌNH THƯỜNG
    return (
        <div className="fade-in pb-12 max-w-[1600px] mx-auto relative animate-in fade-in duration-500">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 border border-slate-200 shadow-sm mb-8 flex flex-col xl:flex-row gap-5 items-start xl:items-center justify-between transition-all w-full">
                <div>
                    <h3 className="text-2xl font-playfair font-bold text-slate-800 flex items-center">
                        Danh sách Phòng
                        <span className="ml-3 bg-blue-100 text-blue-600 text-sm font-sans px-3 py-1 rounded-full font-bold shadow-sm">
                            {totalReviews} bình luận
                        </span>
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Chọn một phòng để Cập nhật hình ảnh, Mô tả và quản lý Phản hồi</p>
                </div>

                <div className="relative w-full xl:w-80 flex-shrink-0">
                    <i className="fa-solid fa-magnifying-glass absolute left-4 top-3.5 text-slate-400"></i>
                    <input type="text" placeholder="Tìm tên phòng, mã phòng..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                </div>
            </div>

            <div>
                {filteredRooms.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-20 text-center shadow-sm mt-8">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                            <i className="fa-regular fa-folder-open text-4xl"></i>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Không tìm thấy phòng nào!</h3>
                    </div>
                ) : (
                    sortedFloors.map(floor => (
                        <div key={floor} className="mb-10">
                            <div className="flex items-center mb-6">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center font-bold mr-4 shadow-md">
                                    <i className="fa-solid fa-layer-group"></i>
                                </div>
                                <h4 className="text-2xl font-playfair font-bold text-slate-800">{floor}</h4>
                                <div className="h-px bg-slate-200 flex-1 ml-4"></div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {groupedRooms[floor].map((room, index) => {
                                    const revCount = room.reviews.length;
                                    let st = { bg: "bg-slate-400", text: "text-slate-500", label: "CHƯA CÓ ĐÁNH GIÁ", ping: "" };
                                    if (revCount > 0) {
                                        if (room.hasUnreplied) {
                                            st = { bg: "bg-amber-500", text: "text-amber-600", label: "CẦN TRẢ LỜI", ping: "animate-ping bg-amber-400" };
                                        } else {
                                            st = { bg: "bg-blue-500", text: "text-blue-600", label: "ĐÃ ĐÁNH GIÁ", ping: "" };
                                        }
                                    }

                                    return (
                                        <div key={room.id} className="bg-white rounded-3xl border border-slate-200 relative group overflow-hidden hover:shadow-xl transition-all flex flex-col">
                                            
                                            <div className="h-36 relative overflow-hidden bg-slate-100 shrink-0">
                                                <img src={room.image || room.images?.[0] || 'https://images.unsplash.com/photo-1611892440504-42a792e24d32'} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={room.name} />
                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent"></div>

                                                <div className="absolute top-3 left-3 flex items-center bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm">
                                                    <span className="relative flex h-2 w-2 mr-1.5">
                                                        {st.ping && <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${st.ping}`}></span>}
                                                        <span className={`relative inline-flex rounded-full h-2 w-2 ${st.bg}`}></span>
                                                    </span>
                                                    <span className={`text-[9px] font-bold ${st.text} tracking-wider`}>{st.label}</span>
                                                </div>

                                                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                                                    <div>
                                                        <h3 className="text-xl font-playfair font-bold text-white leading-none truncate">{room.code}</h3>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 flex flex-col flex-1">
                                                <div className="flex justify-between items-center mb-3">
                                                    <p className="text-slate-800 font-semibold text-sm line-clamp-1" title={room.name}>{room.name}</p>
                                                </div>
                                                
                                                <div className="flex-1">
                                                    {revCount > 0 ? (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-2xl font-black text-slate-800 font-mono">{room.avgRating.toFixed(1)}</span>
                                                                {renderStars(room.avgRating)}
                                                            </div>
                                                            <p className="text-xs text-slate-500 font-medium">Dựa trên {revCount} bình luận</p>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-slate-400 italic mt-2">Chưa có đánh giá nào.</p>
                                                    )}
                                                </div>

                                                <div className="pt-4 mt-3 border-t border-slate-100 border-dashed">
                                                    <button onClick={() => openRoomDetails(room)} className="w-full py-2.5 rounded-xl text-xs font-bold transition-all flex justify-center items-center gap-2 bg-slate-900 text-white hover:bg-blue-600 shadow-md hover:shadow-lg hover:shadow-blue-500/30 transform hover:-translate-y-0.5">
                                                        <i className="fa-solid fa-pen-to-square"></i> 
                                                        Sửa Chi tiết & Bình luận
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>  
        </div>
    );
}
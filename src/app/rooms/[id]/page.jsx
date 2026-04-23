// src/app/rooms/[id]/page.jsx
"use client";

import { useEffect, useState, use } from "react";
import { db } from "@/lib/firebase";
import { doc, collection, query, where, orderBy, addDoc, updateDoc, onSnapshot, serverTimestamp, arrayUnion, Timestamp } from "firebase/firestore";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

// Hàm format thời gian hiển thị đẹp
const formatTime = (timestamp) => {
  if (!timestamp) return "Vừa xong";
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function RoomDetails({ params }) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.id;

  const [room, setRoom] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState("");

  // State Form Đánh giá chính
  const [reviewForm, setReviewForm] = useState({ guestName: "", rating: 5, comment: "" });
  const [submitting, setSubmitting] = useState(false);

  // State Form Phản hồi (Reply như Facebook)
  const [replyingToReviewId, setReplyingToReviewId] = useState(null);
  const [userReplyForm, setUserReplyForm] = useState({ name: "", text: "" });
  const [isReplying, setIsReplying] = useState(false);

  // LẮNG NGHE REAL-TIME (THỜI GIAN THỰC)
  useEffect(() => {
    if (!roomId) return;
    
    // 1. Lắng nghe Dữ liệu Phòng (Nếu admin sửa ảnh, nó đổi ngay lập tức)
    const unsubRoom = onSnapshot(doc(db, "rooms", roomId), (docSnap) => {
      if (docSnap.exists()) {
        const roomData = { id: docSnap.id, ...docSnap.data() };
        setRoom(roomData);
        setActiveImg(prev => prev || roomData.images?.[0] || roomData.image || "");
      }
      setLoading(false);
    });

    // 2. Lắng nghe Đánh giá (Có bình luận mới là hiện ngay, không cần F5)
    // Vẫn giữ query 'approved' để không bị lỗi Index Firebase, nhưng lúc tạo mới ta sẽ set mặc định là approved
    const q = query(
      collection(db, "reviews"),
      where("roomId", "==", roomId),
      where("status", "==", "approved"), 
      orderBy("createdAt", "desc")
    );
    
    const unsubReviews = onSnapshot(q, (snap) => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubRoom();
      unsubReviews();
    };
  }, [roomId]);

  // HÀM GỬI ĐÁNH GIÁ (CÔNG KHAI NGAY LẬP TỨC)
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, "reviews"), {
        ...reviewForm,
        roomId: roomId,
        status: "approved", // Tự động duyệt ngay lập tức
        createdAt: serverTimestamp(),
        userReplies: [] // Khởi tạo mảng trống để chứa các phản hồi của người dùng khác
      });
      setReviewForm({ guestName: "", rating: 5, comment: "" });
      // Không cần alert nữa cho mượt mà, bình luận sẽ tự nhảy xuống dưới
    } catch (error) {
      alert("Lỗi khi gửi: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // HÀM GỬI TRẢ LỜI CỦA NGƯỜI DÙNG KHÁC (NHƯ YOUTUBE/FACEBOOK)
  const handleSubmitUserReply = async (e, reviewId) => {
    e.preventDefault();
    if (!userReplyForm.text.trim()) return;
    setIsReplying(true);
    try {
      await updateDoc(doc(db, "reviews", reviewId), {
        // arrayUnion giúp thêm 1 phần tử mới vào mảng userReplies có sẵn
        userReplies: arrayUnion({
          name: userReplyForm.name.trim() || "Khách ẩn danh",
          text: userReplyForm.text.trim(),
          createdAt: Timestamp.now(),
          isAdmin: false
        })
      });
      setReplyingToReviewId(null);
      setUserReplyForm({ name: "", text: "" });
    } catch (error) {
      alert("Lỗi gửi phản hồi: " + error.message);
    } finally {
      setIsReplying(false);
    }
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-500 font-medium italic">Đang chuẩn bị không gian cho bạn...</p>
    </div>
  );

  if (!room) return <div className="h-screen flex items-center justify-center font-bold">Phòng không tồn tại!</div>;

  return (
    <div className="bg-[#f8fafc] min-h-screen font-sans text-slate-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-12 mt-20">
        <div className="mb-8">
          <Link href="/rooms" className="text-blue-600 hover:gap-3 transition-all font-bold flex items-center gap-2 w-fit bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
            <i className="fa-solid fa-arrow-left"></i> Quay lại danh sách phòng
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
          {/* Gallery hình ảnh thực tế */}
          <div className="space-y-4">
            <div className="relative h-[450px] w-full overflow-hidden rounded-[2.5rem] shadow-2xl border-4 border-white">
              <img src={activeImg} className="w-full h-full object-cover transition-all duration-700 hover:scale-105" alt={room.name} />
            </div>
            
            {room.images && room.images.length > 0 && (
              <div className="grid grid-cols-4 gap-4">
                {room.images.map((img, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setActiveImg(img)}
                    className={`h-24 rounded-2xl overflow-hidden border-2 transition-all ${activeImg === img ? 'border-blue-600 scale-95 shadow-inner' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  >
                    <img src={img} className="w-full h-full object-cover" alt="thumbnail" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Nội dung chi tiết */}
          <div className="flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg shadow-blue-200">
                  {room.type}
                </span>
                <div className="flex text-amber-400 text-xs gap-1 ml-2">
                   <i className="fa-solid fa-star"></i> {room.rating?.toFixed(1) || "5.0"}
                   <span className="text-slate-400 font-medium ml-1">({reviews.length} đánh giá thực tế)</span>
                </div>
              </div>
              
              <h1 className="text-5xl font-playfair font-bold text-slate-900 mb-6 leading-tight">Phòng {room.code}</h1>
              
              <p className="text-slate-500 text-lg leading-relaxed mb-8 italic">
                {room.description || "Tận hưởng không gian nghỉ dưỡng đẳng cấp với tầm nhìn ôm trọn thiên nhiên."}
              </p>

              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center gap-4 shadow-sm">
                   <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 text-xl"><i className="fa-solid fa-expand"></i></div>
                   <div><p className="text-xs text-slate-400 font-bold uppercase">Diện tích</p><p className="font-bold">{room.area || 45} m²</p></div>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center gap-4 shadow-sm">
                   <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 text-xl"><i className="fa-solid fa-user-group"></i></div>
                   <div><p className="text-xs text-slate-400 font-bold uppercase">Sức chứa</p><p className="font-bold">{room.capacity || 2} Khách</p></div>
                </div>
              </div>

              {/* Tiện ích */}
              <div className="mb-10">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Tiện nghi có sẵn:</h3>
                <div className="flex flex-wrap gap-3">
                  {room.amenities?.map((item, i) => (
                    <span key={i} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold flex items-center gap-2 border border-slate-200 capitalize">
                       <i className="fa-solid fa-check text-blue-500 text-[10px]"></i> {item}
                    </span>
                  )) || <span className="text-slate-400 italic">Wifi, Máy lạnh, Mini bar...</span>}
                </div>
              </div>
            </div>

            {/* Giá & Đặt phòng */}
            <div className="p-8 bg-slate-900 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 text-white transform hover:-translate-y-1 transition-all duration-300">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Giá mỗi đêm từ</p>
                <p className="text-3xl font-bold font-mono text-blue-400 tracking-tighter">
                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(room.price)}
                </p>
              </div>
              {room.status === 'available' ? (
                <Link href={`/booking?roomId=${room.id}`} className="w-full md:w-auto bg-white text-slate-900 px-10 py-5 rounded-2xl font-black hover:bg-blue-500 hover:text-white transition-all shadow-xl text-center">
                  ĐẶT PHÒNG NGAY
                </Link>
              ) : (
                <button disabled className="w-full md:w-auto bg-slate-800 text-slate-500 px-10 py-5 rounded-2xl font-bold cursor-not-allowed uppercase tracking-widest">
                  Phòng hiện hết chỗ
                </button>
              )}
            </div>
          </div>
        </div>

        {/* PHẦN MẠNG XÃ HỘI THU NHỎ (BÌNH LUẬN & PHẢN HỒI) */}
        <section className="mt-20 grid grid-cols-1 lg:grid-cols-3 gap-16">
          <div className="lg:col-span-2">
            <h2 className="text-3xl font-playfair font-bold mb-10 flex items-center gap-4">
               <i className="fa-solid fa-comments text-blue-600"></i> Thảo luận & Đánh giá
               <span className="text-sm font-sans bg-blue-100 text-blue-600 px-3 py-1 rounded-full">{reviews.length}</span>
            </h2>
            
            <div className="space-y-8">
              {reviews.length > 0 ? reviews.map((rev) => (
                <div key={rev.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                  
                  {/* Đánh giá gốc */}
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-lg shrink-0">
                      {rev.guestName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-bold text-slate-800">{rev.guestName}</h4>
                        <span className="text-[11px] text-slate-400 font-medium">{formatTime(rev.createdAt)}</span>
                      </div>
                      <div className="flex text-amber-400 text-[10px] mb-2 gap-0.5">
                        {[...Array(rev.rating)].map((_, i) => <i key={i} className="fa-solid fa-star"></i>)}
                      </div>
                      <p className="text-slate-600 leading-relaxed mb-3">"{rev.comment}"</p>
                      
                      <button onClick={() => setReplyingToReviewId(replyingToReviewId === rev.id ? null : rev.id)} className="text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1.5">
                        <i className="fa-solid fa-reply"></i> Phản hồi
                      </button>
                    </div>
                  </div>

                  {/* Khu vực Phản hồi (Admin & Người dùng khác) */}
                  {(rev.reply || (rev.userReplies && rev.userReplies.length > 0) || replyingToReviewId === rev.id) && (
                    <div className="mt-4 ml-8 pl-4 border-l-2 border-slate-100 space-y-4">
                      
                      {/* 1. Phản hồi của ADMIN (Màu xanh nổi bật) */}
                      {rev.reply && (
                        <div className="flex gap-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-md">
                            <i className="fa-solid fa-hotel"></i>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-bold text-blue-800 text-[13px]">{rev.replyBy || "Quản lý Khách sạn"}</h5>
                              <i className="fa-solid fa-circle-check text-blue-500 text-[10px]" title="Đã xác thực"></i>
                            </div>
                            <p className="text-slate-700 text-[13px] leading-relaxed">{rev.reply}</p>
                          </div>
                        </div>
                      )}

                      {/* 2. Phản hồi của KHÁCH HÀNG KHÁC */}
                      {rev.userReplies && rev.userReplies.map((uReply, idx) => (
                        <div key={idx} className="flex gap-3">
                          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
                            {uReply.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <h5 className="font-bold text-slate-700 text-[13px]">{uReply.name}</h5>
                              <span className="text-[10px] text-slate-400">{formatTime(uReply.createdAt)}</span>
                            </div>
                            <p className="text-slate-600 text-[13px] leading-relaxed">{uReply.text}</p>
                          </div>
                        </div>
                      ))}

                      {/* 3. Form nhập Phản hồi mới */}
                      {replyingToReviewId === rev.id && (
                        <form onSubmit={(e) => handleSubmitUserReply(e, rev.id)} className="pt-2 animate-in fade-in">
                          <div className="flex gap-2">
                            <input 
                              type="text" placeholder="Tên của bạn..." required value={userReplyForm.name} onChange={e => setUserReplyForm({...userReplyForm, name: e.target.value})}
                              className="w-1/3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-400"
                            />
                            <input 
                              type="text" placeholder="Viết phản hồi..." required autoFocus value={userReplyForm.text} onChange={e => setUserReplyForm({...userReplyForm, text: e.target.value})}
                              className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-400"
                            />
                            <button type="submit" disabled={isReplying} className="px-4 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                              Gửi
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                </div>
              )) : (
                <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
                   <i className="fa-regular fa-face-smile text-6xl text-slate-100 mb-4 block"></i>
                   <p className="text-slate-400 font-medium italic">Hãy là người đầu tiên bóc tem căn phòng này!</p>
                </div>
              )}
            </div>
          </div>

          {/* Form viết đánh giá Gốc */}
          <div className="lg:col-span-1">
             <div className="sticky top-28 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                   <i className="fa-solid fa-pen-nib text-blue-600"></i> Viết đánh giá mới
                </h3>
                <form onSubmit={handleSubmitReview} className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1">Họ tên của bạn</label>
                    <input type="text" required value={reviewForm.guestName} onChange={(e) => setReviewForm({...reviewForm, guestName: e.target.value})} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 border border-transparent focus:border-blue-500 transition-all font-medium text-sm" placeholder="VD: Nguyễn Văn An" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1">Đánh giá điểm số</label>
                    <select value={reviewForm.rating} onChange={(e) => setReviewForm({...reviewForm, rating: Number(e.target.value)})} className="w-full p-4 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-blue-500 font-bold text-amber-500 text-sm">
                      <option value="5">⭐⭐⭐⭐⭐ Tuyệt vời</option>
                      <option value="4">⭐⭐⭐⭐ Rất tốt</option>
                      <option value="3">⭐⭐⭐ Bình thường</option>
                      <option value="2">⭐⭐ Tệ</option>
                      <option value="1">⭐ Rất tệ</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1">Nội dung trải nghiệm</label>
                    <textarea rows="4" required value={reviewForm.comment} onChange={(e) => setReviewForm({...reviewForm, comment: e.target.value})} className="w-full p-4 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-blue-500 font-medium placeholder:italic text-sm" placeholder="Phòng rất sạch, view đẹp..."></textarea>
                  </div>
                  <button type="submit" disabled={submitting} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black shadow-lg shadow-slate-200 hover:bg-blue-600 hover:-translate-y-1 transition-all disabled:bg-slate-400">
                    {submitting ? "ĐANG ĐĂNG TẢI..." : "ĐĂNG BÌNH LUẬN"}
                  </button>
                  <p className="text-[10px] text-emerald-500 text-center font-bold mt-4"><i className="fa-solid fa-earth-americas mr-1"></i> Bình luận của bạn sẽ được công khai ngay lập tức.</p>
                </form>
             </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
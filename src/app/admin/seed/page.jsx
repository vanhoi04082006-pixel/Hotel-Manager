// src/app/admin/seed/page.jsx
"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";

export default function SeedDataPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSeedData = async () => {
    if (!confirm("Hành động này sẽ cập nhật TẤT CẢ các phòng hiện có và tạo thêm hàng chục đánh giá mẫu. Bạn có chắc chắn muốn tiếp tục?")) return;
    
    setLoading(true);
    setMessage("Đang quét danh sách phòng...");

    try {
      // Khởi tạo một Batch (Lô) để ghi dữ liệu hàng loạt nhằm tối ưu hiệu suất
      const batch = writeBatch(db);
      
      // Lấy tất cả các phòng hiện tại
      const roomsSnap = await getDocs(collection(db, "rooms"));
      let opCount = 0; // Đếm số lượng hành động

      // Kho hình ảnh mẫu chất lượng cao
      const sampleImages = [
        "https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=1000",
        "https://images.unsplash.com/photo-1582719478250-c89d14c77345?q=80&w=1000",
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1000",
        "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=1000",
        "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=1000",
        "https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=1000"
      ];

      const sampleAmenities = ["wifi", "pool", "ac", "tv", "breakfast", "parking"];
      
      const sampleComments = [
        "Phòng cực kỳ sạch sẽ, view nhìn ra biển buổi sáng rất tuyệt vời. Nhân viên phục vụ nhiệt tình.",
        "Nội thất sang trọng, giường nằm rất êm. Tuy nhiên đồ ăn sáng hơi ít món.",
        "Trải nghiệm tuyệt vời! Hồ bơi vô cực rất đẹp, gia đình tôi đã có một kỳ nghỉ đáng nhớ.",
        "Giá cả hợp lý so với chất lượng 5 sao. Không gian yên tĩnh, rất thích hợp để nghỉ dưỡng.",
        "Mọi thứ đều hoàn hảo, từ lúc check-in đến lúc check-out. Chắc chắn sẽ quay lại!"
      ];

      for (const roomDoc of roomsSnap.docs) {
        const roomId = roomDoc.id;
        const roomRef = doc(db, "rooms", roomId);

        // Lấy ngẫu nhiên 3 ảnh cho mỗi phòng
        const shuffledImages = [...sampleImages].sort(() => 0.5 - Math.random());
        const roomImages = shuffledImages.slice(0, 3);

        // 1. Cập nhật dữ liệu Chi tiết cho Phòng
        batch.update(roomRef, {
          images: roomImages, // Mảng 3 hình ảnh
          description: "Tận hưởng không gian nghỉ dưỡng riêng tư và sang trọng bậc nhất. Phòng được thiết kế với cửa sổ kính sát trần bao quát toàn cảnh thiên nhiên, nội thất cao cấp mang âm hưởng kiến trúc nhiệt đới đương đại, cùng hệ thống tiện ích thông minh đáp ứng mọi nhu cầu của quý khách.",
          amenities: sampleAmenities.sort(() => 0.5 - Math.random()).slice(0, 4), // Ngẫu nhiên 4 tiện ích
          area: Math.floor(Math.random() * 30) + 35, // Diện tích 35 - 65m2
          capacity: Math.floor(Math.random() * 3) + 2, // 2 - 4 khách
          bedType: "1 Giường King cỡ lớn",
          rating: 4.5 + (Math.random() * 0.5), // Điểm 4.5 - 5.0
        });
        opCount++;

        // 2. Tạo 3 đánh giá mẫu cho mỗi phòng
        for (let i = 0; i < 3; i++) {
          const reviewRef = doc(collection(db, "reviews")); // Tự động tạo ID mới
          const isApproved = i < 2; // 2 review đầu sẽ được duyệt sẵn, review cuối để pending cho bạn test Admin

          batch.set(reviewRef, {
            roomId: roomId,
            guestName: `Khách Hàng ${Math.floor(Math.random() * 1000) + 100}`,
            rating: Math.floor(Math.random() * 2) + 4, // Điểm 4 hoặc 5 sao
            comment: sampleComments[Math.floor(Math.random() * sampleComments.length)],
            status: isApproved ? "approved" : "pending",
            createdAt: new Date(Date.now() - Math.floor(Math.random() * 10000000000)) // Random thời gian trong quá khứ
          });
          opCount++;
        }
      }

      setMessage(`Đang ghi ${opCount} bản ghi vào hệ thống... Vui lòng đợi.`);
      await batch.commit(); // Thực thi ghi toàn bộ dữ liệu lên Firebase cùng lúc
      
      setMessage("🎉 THÀNH CÔNG! Đã cập nhật toàn bộ phòng và thêm các đánh giá mẫu.");
    } catch (error) {
      console.error(error);
      setMessage("❌ Có lỗi xảy ra: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-10 rounded-3xl shadow-xl max-w-xl w-full text-center border border-slate-100">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="fa-solid fa-database text-4xl text-blue-600"></i>
        </div>
        <h1 className="text-3xl font-bold text-slate-800 mb-4">Công cụ Bơm Dữ Liệu</h1>
        <p className="text-slate-500 mb-8 leading-relaxed">
          Công cụ này sẽ tự động thêm hình ảnh chất lượng cao (Gallery), thông số chi tiết (diện tích, giường) và tạo ngẫu nhiên 3 bài đánh giá (Review) cho <b>TẤT CẢ</b> các phòng hiện có trong hệ thống.
        </p>

        {message && (
          <div className={`p-4 mb-8 rounded-xl font-medium ${message.includes('THÀNH CÔNG') ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : message.includes('lỗi') ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-blue-50 text-blue-600'}`}>
            {message}
          </div>
        )}

        <button 
          onClick={handleSeedData} 
          disabled={loading}
          className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-600 transition-all shadow-lg hover:shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-3"
        >
          {loading ? (
             <><i className="fa-solid fa-spinner animate-spin"></i> Đang xử lý...</>
          ) : (
             <><i className="fa-solid fa-bolt"></i> Bắt đầu Bơm Dữ Liệu</>
          )}
        </button>

        <p className="text-xs text-slate-400 mt-6 italic">
          *Lưu ý: Sau khi thực hiện xong và test web ok, bạn có thể xóa file này đi để bảo mật hệ thống.
        </p>
      </div>
    </div>
  );
}
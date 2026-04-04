// src/app/admin/gallery/page.jsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, Timestamp } from "firebase/firestore";

// Hàm tiện ích định dạng ngày tháng
const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
        const d = dateString?.toDate ? dateString.toDate() : new Date(dateString);
        return d.toLocaleDateString("vi-VN");
    } catch (e) { return ""; }
};

const initialFormState = {
    id: "",
    title: "",
    url: "",
    category: "rooms",
    description: "",
    featured: false,
};

export default function AdminGallery() {
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);

    // States Lọc & Tìm kiếm
    const [searchQuery, setSearchQuery] = useState("");
    const [catFilter, setCatFilter] = useState("all");

    // States Phân trang
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(12);
    const listRef = useRef(null);

    // States Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [isSaving, setIsSaving] = useState(false);

    // Mở ảnh full
    const [fullImageUrl, setFullImageUrl] = useState("");

    // 1. Lấy dữ liệu Real-time
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "gallery"), (snap) => {
            const loadedImages = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            // Xếp ảnh Nổi bật (featured) lên đầu, sau đó theo ngày tạo
            loadedImages.sort((a, b) => {
                if (a.featured && !b.featured) return -1;
                if (!a.featured && b.featured) return 1;
                const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
                const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
                return timeB - timeA;
            });
            setImages(loadedImages);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. Logic Lọc và Phân trang
    const { filteredImages, paginatedImages, totalPages } = useMemo(() => {
        const query = searchQuery.toLowerCase();
        const filtered = images.filter((img) => {
            const matchSearch =
                (img.title || "").toLowerCase().includes(query) ||
                (img.description || "").toLowerCase().includes(query);
            const matchCat = catFilter === "all" || img.category === catFilter;
            return matchSearch && matchCat;
        });

        const totalPagesCount = Math.ceil(filtered.length / limit);
        const start = page * limit;
        const paginated = filtered.slice(start, start + limit);

        return { filteredImages: filtered, paginatedImages: paginated, totalPages: totalPagesCount };
    }, [images, searchQuery, catFilter, page, limit]);

    // Đặt lại trang về 0 khi tìm kiếm / lọc thay đổi
    useEffect(() => {
        setPage(0);
    }, [searchQuery, catFilter, limit]);

    const handlePageChange = (newPage) => {
        setPage(newPage);
        if (listRef.current) {
            listRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    // 3. Xử lý Form Thêm/Sửa
    const openModal = (image = null) => {
        if (image) {
            setFormData({
                id: image.id,
                title: image.title || "",
                url: image.image || image.url || "", // Support cả trường 'image' cũ hoặc 'url'
                category: image.category || "rooms",
                description: image.description || "",
                featured: image.featured || false,
            });
        } else {
            setFormData(initialFormState);
        }
        setIsModalOpen(true);
    };

    const handleSaveImage = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const imageData = {
            title: formData.title,
            image: formData.url, // Lưu trường image giống cấu trúc Firebase cũ
            url: formData.url,
            category: formData.category,
            description: formData.description,
            featured: formData.featured,
            updatedAt: Timestamp.now(),
        };

        try {
            if (formData.id) {
                await updateDoc(doc(db, "gallery", formData.id), imageData);
                alert("Cập nhật thông tin ảnh thành công!");
            } else {
                await addDoc(collection(db, "gallery"), {
                    ...imageData,
                    createdAt: Timestamp.now(),
                });
                alert("Đã thêm ảnh vào thư viện!");
            }
            setIsModalOpen(false);
        } catch (error) {
            alert("Lỗi lưu ảnh: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    // 4. Thao tác Nhanh
    const handleDeleteImage = async (id, title) => {
        if (confirm(`Bạn có chắc chắn muốn xóa ảnh "${title}" khỏi thư viện?`)) {
            try {
                await deleteDoc(doc(db, "gallery", id));
            } catch (error) {
                alert("Lỗi xóa ảnh: " + error.message);
            }
        }
    };

    const toggleFeatured = async (e, id, currentStatus) => {
        e.stopPropagation(); // Ngăn sự kiện click vào ảnh mở popup
        try {
            await updateDoc(doc(db, "gallery", id), { featured: !currentStatus });
        } catch (error) {
            alert("Lỗi đánh dấu nổi bật: " + error.message);
        }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="fade-in max-w-[1600px] mx-auto pb-12 relative z-0">

            {/* Header & Công cụ tìm kiếm */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 border border-slate-200 shadow-sm mb-8 flex flex-col xl:flex-row gap-5 items-start xl:items-center justify-between transition-all">
                <div>
                    <h3 className="text-2xl font-playfair font-bold text-slate-800 flex items-center">
                        Thư viện Hình ảnh
                        <span className="ml-3 bg-blue-100 text-blue-600 text-sm font-sans px-3 py-1 rounded-full font-bold shadow-sm">
                            {filteredImages.length} Hình
                        </span>
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Quản lý kho ảnh truyền thông cho Phòng nghỉ và Dịch vụ</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                    <div className="relative w-full sm:w-64 flex-shrink-0">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-3.5 text-slate-400"></i>
                        <input
                            type="text"
                            placeholder="Tìm tên, mô tả ảnh..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                        />
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto hide-scrollbar">
                        <button onClick={() => setCatFilter("all")} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${catFilter === "all" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Tất cả</button>
                        <button onClick={() => setCatFilter("rooms")} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${catFilter === "rooms" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-blue-600"}`}>
                            <i className="fa-solid fa-bed mr-1"></i>Phòng
                        </button>
                        <button onClick={() => setCatFilter("facilities")} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${catFilter === "facilities" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-emerald-600"}`}>
                            <i className="fa-solid fa-swimming-pool mr-1"></i>Cơ sở vật chất
                        </button>
                        <button onClick={() => setCatFilter("events")} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${catFilter === "events" ? "bg-white text-purple-600 shadow-sm" : "text-slate-500 hover:text-purple-600"}`}>
                            <i className="fa-solid fa-champagne-glasses mr-1"></i>Sự kiện
                        </button>
                    </div>

                    <button onClick={() => openModal()} className="bg-slate-900 text-white rounded-xl px-5 py-2.5 shadow-lg hover:bg-blue-600 flex-shrink-0 whitespace-nowrap transition-all transform hover:-translate-y-0.5">
                        <i className="fa-solid fa-cloud-arrow-up mr-2"></i>Thêm ảnh mới
                    </button>
                </div>
            </div>

            <div ref={listRef} className="scroll-mt-6"></div>

            {/* Lưới Hình Ảnh */}
            {paginatedImages.length > 0 ? (
                <div className="columns-1 sm:columns-2 md:columns-3 xl:columns-4 gap-6 space-y-6">
                    {paginatedImages.map((img, index) => {
                        let catColor = "bg-slate-500";
                        if (img.category === "rooms") catColor = "bg-blue-500";
                        if (img.category === "facilities") catColor = "bg-emerald-500";
                        if (img.category === "events") catColor = "bg-purple-500";

                        return (
                            <div key={img.id} className="break-inside-avoid relative group bg-slate-100 rounded-3xl overflow-hidden border border-slate-200/50 shadow-sm hover:shadow-2xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${(index % 10) * 50}ms` }}>

                                {/* Ảnh chính */}
                                <div className="relative w-full overflow-hidden cursor-zoom-in" style={{ minHeight: "150px" }} onClick={() => setFullImageUrl(img.url || img.image)}>
                                    <img src={img.url || img.image} alt={img.title} className="w-full h-auto object-cover transform group-hover:scale-110 transition-transform duration-700 ease-in-out bg-slate-200" loading="lazy" />

                                    {/* Overlay khi Hover */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                                    {/* Nút đánh dấu Nổi bật */}
                                    <button onClick={(e) => toggleFeatured(e, img.id, img.featured)} className={`absolute top-4 left-4 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg border ${img.featured ? "bg-amber-400 text-white border-amber-300 opacity-100 scale-100" : "bg-white/80 backdrop-blur-sm text-slate-400 border-white/20 opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 hover:bg-amber-400 hover:text-white"}`} title="Đánh dấu nổi bật">
                                        <i className={`fa-solid fa-star ${img.featured ? "" : "fa-regular"}`}></i>
                                    </button>

                                    {/* Nút Sửa/Xóa (Luôn hiển thị nhưng nhạt mờ, hover sẽ rõ) */}
                                    <div className="absolute top-4 right-4 flex flex-col space-y-2 opacity-50 group-hover:opacity-100 transition-opacity duration-300">
                                        <button onClick={(e) => { e.stopPropagation(); openModal(img); }} className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white shadow-lg transition-colors border border-white/20">
                                            <i className="fa-solid fa-pen text-sm"></i>
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteImage(img.id, img.title); }} className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-red-600 hover:bg-red-600 hover:text-white shadow-lg transition-colors border border-white/20">
                                            <i className="fa-solid fa-trash text-sm"></i>
                                        </button>
                                    </div>

                                    {/* Nội dung text (Góc dưới) */}
                                    <div className="absolute bottom-0 left-0 right-0 p-5 transform translate-y-4 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 pointer-events-none">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`w-2 h-2 rounded-full ${catColor}`}></span>
                                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{img.category === "rooms" ? "Phòng" : img.category === "facilities" ? "Tiện ích" : img.category === "events" ? "Sự kiện" : "Khác"}</span>
                                        </div>
                                        <h4 className="text-lg font-playfair font-bold text-white mb-1 leading-tight line-clamp-1">{img.title || "Chưa có tên ảnh"}</h4>
                                        <p className="text-xs text-slate-300 line-clamp-2">{img.description || "Tải lên vào " + formatDate(img.createdAt)}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white rounded-[3rem] border-2 border-dashed border-slate-300 p-24 text-center shadow-inner mt-8">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300 border border-slate-100">
                        <i className="fa-regular fa-images text-4xl"></i>
                    </div>
                    <h3 className="text-2xl font-playfair font-bold text-slate-800 mb-3">Thư viện trống!</h3>
                    <p className="text-slate-500 max-w-sm mx-auto mb-8 text-sm">Không có hình ảnh nào khớp với bộ lọc hiện tại của bạn.</p>
                    <button onClick={() => { setCatFilter("all"); setSearchQuery(""); setPage(0); }} className="bg-blue-600 text-white px-8 py-3 rounded-xl shadow-lg hover:bg-blue-700 transition-colors font-bold">
                        Hiển thị tất cả
                    </button>
                </div>
            )}

            {/* Phân trang */}
            {paginatedImages.length > 0 && totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-10 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm gap-4">
                    <div className="flex items-center gap-3">
                        <p className="text-sm text-slate-500 font-medium">Hiển thị</p>
                        <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(0); }} className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none p-1.5 px-3 font-bold cursor-pointer hover:bg-white transition-colors">
                            <option value="12">12</option>
                            <option value="24">24</option>
                            <option value="48">48</option>
                        </select>
                        <p className="text-sm text-slate-500">/ {filteredImages.length} ảnh</p>
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

            {/* Modal Thêm/Sửa Ảnh */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl animate-in zoom-in duration-300 border border-slate-100">
                        <div className="p-6 md:p-8">
                            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                                <h3 className="text-2xl font-playfair font-bold text-slate-900">{formData.id ? "Cập nhật ảnh" : "Thêm ảnh mới"}</h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center transition-all"><i className="fa-solid fa-xmark text-xl"></i></button>
                            </div>

                            <form onSubmit={handleSaveImage} className="space-y-4">

                                {/* Image Preview */}
                                <div className="w-full h-40 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden mb-2">
                                    {formData.url ? (
                                        <img src={formData.url} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center text-slate-400">
                                            <i className="fa-regular fa-image text-3xl mb-2 block"></i>
                                            <span className="text-xs font-medium">Xem trước hình ảnh</span>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Đường dẫn ảnh (URL) <span className="text-red-500">*</span></label>
                                    <input type="url" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all font-mono text-sm" placeholder="https://example.com/image.jpg" value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} />
                                </div>

                                <div>
                                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Tên / Tiêu đề ảnh <span className="text-red-500">*</span></label>
                                    <input type="text" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all" placeholder="Phòng Deluxe hướng biển" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Phân loại</label>
                                        <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-medium text-slate-700" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                            <option value="rooms">Nội thất Phòng</option>
                                            <option value="facilities">Cơ sở vật chất</option>
                                            <option value="events">Hoạt động Sự kiện</option>
                                            <option value="other">Khác</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Trạng thái</label>
                                        <label className="flex items-center space-x-2 mt-3 cursor-pointer bg-amber-50 px-3 py-2.5 rounded-xl border border-amber-100 hover:bg-amber-100 transition-colors">
                                            <input type="checkbox" className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 cursor-pointer" checked={formData.featured} onChange={e => setFormData({ ...formData, featured: e.target.checked })} />
                                            <span className="text-[13px] font-bold text-amber-700">Đánh dấu Nổi bật</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">Mô tả ngắn</label>
                                    <textarea rows="2" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all text-sm" placeholder="Góc chụp từ ban công..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}></textarea>
                                </div>

                                <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100 mt-6">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">Hủy</button>
                                    <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 flex items-center">
                                        {isSaving ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Đang lưu...</> : "Lưu hình ảnh"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Ảnh Full màn hình */}
            {fullImageUrl && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setFullImageUrl("")}>
                    <div className="relative max-w-5xl w-full flex flex-col items-center">
                        <button onClick={() => setFullImageUrl("")} className="absolute -top-12 right-0 text-white hover:text-slate-300 bg-black/50 w-10 h-10 rounded-full flex items-center justify-center transition-colors">
                            <i className="fa-solid fa-xmark text-xl"></i>
                        </button>
                        <img src={fullImageUrl} className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain animate-in zoom-in-95 duration-300" alt="Gallery Full" onClick={(e) => e.stopPropagation()} />
                    </div>
                </div>
            )}
        </div>
    );
}
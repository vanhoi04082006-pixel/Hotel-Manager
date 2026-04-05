// src/app/services/page.jsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

// Hàm format tiền tệ
const formatCurrency = (amount) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
};

// Cấu hình các danh mục dịch vụ
const CATEGORIES = [
    { id: "All", icon: "✨", label: "Tất cả" },
    { id: "dining", icon: "🍽️", label: "Nhà hàng" },
    { id: "spa", icon: "💆", label: "Spa" },
    { id: "wellness", icon: "🏋️", label: "Sức khỏe" },
    { id: "transport", icon: "🚗", label: "Di chuyển" },
    { id: "activities", icon: "🎉", label: "Hoạt động" },
];

// Hình ảnh mặc định nếu dịch vụ không có ảnh
const DEFAULT_IMAGES = {
    dining: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=800",
    spa: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=800",
    wellness: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800",
    transport: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=800",
    activities: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=800",
};

export default function ServicesPage() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isPageLoaded, setIsPageLoaded] = useState(false); // State Loading toàn cục

    // State Tìm kiếm & Lọc
    const [searchQuery, setSearchQuery] = useState("");
    const [currentCategory, setCurrentCategory] = useState("All");

    // State Phân trang
    const [currentPage, setCurrentPage] = useState(1);
    const servicesPerPage = 6;
    const listRef = useRef(null);

    // ==========================================
    // STATE: TÙY CHỈNH THÔNG BÁO (THAY THẾ ALERT)
    // ==========================================
    const [notification, setNotification] = useState({
        show: false,
        title: "",
        message: "",
        type: "success" // "success", "error", "warning"
    });

    const showNotification = (title, message, type = "success") => {
        setNotification({ show: true, title, message, type });
    };

    const closeNotification = () => {
        setNotification(prev => ({ ...prev, show: false }));
    };

    // 1. Fetch dữ liệu từ Firestore
    useEffect(() => {
        const fetchServices = async () => {
            try {
                const servicesSnap = await getDocs(collection(db, "services"));
                // Chỉ lấy các dịch vụ đang hoạt động
                const loadedServices = servicesSnap.docs
                    .map((doc) => ({ id: doc.id, ...doc.data() }))
                    .filter(s => s.available !== false);
                setServices(loadedServices);
            } catch (error) {
                console.error("Lỗi tải dữ liệu dịch vụ:", error);
            } finally {
                setLoading(false);
                setTimeout(() => setIsPageLoaded(true), 600); // Tắt màn hình loading ảo sau khi tải xong
            }
        };

        fetchServices();
    }, []);

    // 2. Logic Lọc và Tìm kiếm
    const filteredServices = useMemo(() => {
        let result = [...services];

        if (currentCategory !== "All") {
            result = result.filter((s) => {
                let sCat = 'other';
                if (['utensils', 'cocktail', 'cake'].includes(s.icon)) sCat = 'dining';
                if (['spa', 'swimmer', 'dumbbell'].includes(s.icon)) sCat = 'wellness';
                if (['car', 'motorcycle'].includes(s.icon)) sCat = 'transport';
                return (s.category === currentCategory || sCat === currentCategory);
            });
        }

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter((s) =>
                s.name?.toLowerCase().includes(lowerQuery) ||
                s.description?.toLowerCase().includes(lowerQuery) ||
                s.category?.toLowerCase().includes(lowerQuery)
            );
        }

        return result;
    }, [services, currentCategory, searchQuery]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, currentCategory]);

    // 3. Logic Phân trang
    const totalPages = Math.ceil(filteredServices.length / servicesPerPage);
    const paginatedServices = filteredServices.slice(
        (currentPage - 1) * servicesPerPage,
        currentPage * servicesPerPage
    );

    const handlePageChange = (page) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
        if (listRef.current) {
            listRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    // 4. Xử lý "Đặt ngay" (Đã cập nhật để lưu thành mảng danh sách & Notification mới)
    const handleAddToCart = (service) => {
        const existingServices = JSON.parse(sessionStorage.getItem("selectedServices") || "[]");
        const isAlreadyAdded = existingServices.some(s => s.id === service.id);
        
        if (!isAlreadyAdded) {
            existingServices.push(service);
            sessionStorage.setItem("selectedServices", JSON.stringify(existingServices));
            showNotification(
                "Đã thêm thành công", 
                `Dịch vụ "${service.name}" đã được thêm vào danh sách mong muốn. Bạn có thể chọn dịch vụ này khi tiến hành đặt phòng.`,
                "success"
            );
        } else {
            showNotification(
                "Dịch vụ đã tồn tại",
                `Dịch vụ "${service.name}" đã có sẵn trong danh sách yêu thích của bạn.`,
                "warning"
            );
        }
    };

    return (
        <>
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes popInItem { 0% { opacity: 0; transform: scale(0.95) translateY(20px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .animate-item { opacity: 0; animation: popInItem 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .hero-section {
                    background-image: url('https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=2000&auto=format&fit=crop');
                    background-size: cover;
                    background-position: center;
                    background-attachment: fixed;
                    position: relative;
                }
                .hero-overlay {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to bottom, rgba(15, 23, 42, 0.3), rgba(0, 0, 0, 0.6));
                }
                .custom-loader {
                    border: 3px solid #e2e8f0;
                    border-top: 3px solid #2563eb;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                }
            `}} />

            {/* Màn hình Loading Khởi tạo */}
            <div className={`fixed inset-0 bg-white z-[9999] flex items-center justify-center flex-col transition-opacity duration-700 ease-in-out ${isPageLoaded ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                <div className="text-center transition-transform duration-700 scale-100">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <i className="fa-solid fa-spa text-4xl text-blue-600"></i>
                    </div>
                    <h2 className="text-3xl font-playfair font-bold text-slate-900 mb-4">Luna Hotel</h2>
                    <div className="custom-loader mx-auto mb-5"></div>
                    <p className="text-slate-500 font-medium">Đang tải các dịch vụ đẳng cấp...</p>
                </div>
            </div>

            {/* CUSTOM NOTIFICATION MODAL */}
            {notification.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 md:p-8 text-center animate-in zoom-in-95 duration-300">
                        {notification.type === 'success' && (
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
                                <i className="fa-solid fa-check text-4xl text-emerald-500"></i>
                            </div>
                        )}
                        {notification.type === 'warning' && (
                            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
                                <i className="fa-solid fa-exclamation text-4xl text-amber-500"></i>
                            </div>
                        )}
                        
                        <h3 className="text-2xl font-bold text-slate-800 mb-3">{notification.title}</h3>
                        <p className="text-slate-600 mb-8 leading-relaxed">{notification.message}</p>
                        
                        <button 
                            onClick={closeNotification} 
                            className={`w-full py-3.5 rounded-xl font-bold text-white transition-all transform hover:-translate-y-1 ${
                                notification.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/30' :
                                'bg-amber-500 hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-500/30'
                            }`}
                        >
                            Đã hiểu
                        </button>
                    </div>
                </div>
            )}

            <div id="main-content" className={`font-sans text-slate-800 bg-[#f8fafc] min-h-screen transition-opacity duration-1000 ${isPageLoaded ? "opacity-100" : "opacity-0"}`}>
                <Header />

                <main className="user-main pb-24">
                    <div className="hero-section py-24 md:py-36 flex items-center justify-center relative">
                        <div className="hero-overlay"></div>
                        <div className="max-w-4xl mx-auto px-4 text-center relative z-10 w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
                            <span className="inline-block py-1.5 px-4 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30 text-xs font-bold tracking-widest uppercase mb-6 shadow-lg">
                                Luna Hotel & Resort
                            </span>
                            <h2 className="text-4xl md:text-6xl font-playfair font-bold text-white mb-6 drop-shadow-2xl leading-tight">
                                Trải Nghiệm Đẳng Cấp <br />
                                <span className="italic font-light">Thư Giãn Tuyệt Đối</span>
                            </h2>

                            <div className="max-w-2xl mx-auto mt-12 relative group bg-white/20 backdrop-blur-lg p-2 rounded-[1.5rem] border border-white/30 shadow-2xl">
                                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none z-10">
                                    <i className="fa-solid fa-magnifying-glass text-slate-400 text-lg group-hover:text-blue-500 transition-colors"></i>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm dịch vụ theo tên, mô tả..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-14 pr-16 py-4 bg-white/95 rounded-xl border-0 focus:ring-4 focus:ring-white/50 text-slate-800 placeholder-slate-400 font-medium text-base md:text-lg outline-none transition-all shadow-inner"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery("")}
                                        className="absolute inset-y-0 right-6 flex items-center text-slate-400 hover:text-rose-500 transition-colors z-10"
                                    >
                                        <i className="fa-solid fa-circle-xmark text-xl"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 -mt-8 relative z-20" ref={listRef}>
                        
                        {/* Menu Bộ lọc Danh mục */}
                        <div className="flex flex-nowrap md:flex-wrap overflow-x-auto hide-scrollbar justify-start md:justify-center gap-3 md:gap-4 mb-16 pb-2" id="service-categories">
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setCurrentCategory(cat.id)}
                                    className={`px-6 py-3 rounded-full text-[14px] whitespace-nowrap transition-all duration-300 transform ${currentCategory === cat.id
                                            ? "font-bold bg-slate-900 text-white shadow-xl shadow-slate-900/20 scale-105"
                                            : "font-medium bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:shadow-md"
                                        }`}
                                >
                                    {cat.icon} {cat.label}
                                </button>
                            ))}
                        </div>

                        {/* Lưới danh sách Dịch vụ */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
                            {loading ? (
                                <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100">
                                    <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-slate-500 font-medium">Đang tải dữ liệu dịch vụ...</p>
                                </div>
                            ) : paginatedServices.length === 0 ? (
                                <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-24 bg-white rounded-3xl border border-dashed border-slate-300 shadow-sm">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <i className="fa-solid fa-box-open text-3xl text-slate-300"></i>
                                    </div>
                                    <h3 className="text-2xl font-playfair font-bold text-slate-800 mb-2">
                                        Không tìm thấy dịch vụ
                                    </h3>
                                    <p className="text-slate-500">Xin lỗi, không có dịch vụ nào phù hợp với danh mục hoặc từ khóa bạn chọn.</p>
                                    <button onClick={() => { setSearchQuery(""); setCurrentCategory("All"); }} className="mt-6 px-6 py-2.5 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-600 hover:text-white transition-colors">
                                        Xóa bộ lọc
                                    </button>
                                </div>
                            ) : (
                                paginatedServices.map((service, index) => {
                                    let sCat = 'activities';
                                    if (['utensils', 'cocktail', 'cake'].includes(service.icon)) sCat = 'dining';
                                    if (['spa', 'swimmer', 'dumbbell'].includes(service.icon)) sCat = 'wellness';
                                    if (['car', 'motorcycle'].includes(service.icon)) sCat = 'transport';

                                    const displayImage = service.image || DEFAULT_IMAGES[service.category] || DEFAULT_IMAGES[sCat] || DEFAULT_IMAGES.activities;
                                    const priceDisplay = service.price ? formatCurrency(service.price) : "Liên hệ";
                                    const unitStr = service.unit === 'person' ? '/ Người' : service.unit === 'room' ? '/ Phòng' : service.unit === 'hour' ? '/ Giờ' : '/ Ngày';

                                    return (
                                        <div
                                            key={service.id}
                                            className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(37,99,235,0.1)] transition-all duration-500 transform hover:-translate-y-2 flex flex-col group animate-item"
                                            style={{ animationDelay: `${index * 0.1}s` }}
                                        >
                                            <div className="relative h-64 w-full overflow-hidden bg-slate-100 rounded-t-[2rem]">
                                                <img
                                                    src={displayImage}
                                                    alt={service.name || "Dịch vụ"}
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300"></div>
                                                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-slate-800 shadow-sm z-20 flex items-center gap-1.5 border border-white/50 uppercase">
                                                    <i className={`fa-solid fa-${service.icon || 'star'} text-blue-500`}></i>
                                                    {service.category === 'dining' ? 'Ẩm thực' : service.category === 'spa' ? 'Spa' : service.category === 'wellness' ? 'Sức khỏe' : 'Tiện ích'}
                                                </div>
                                            </div>

                                            <div className="p-6 md:p-8 flex-1 flex flex-col relative z-10 bg-white rounded-b-[2rem]">
                                                <h3 className="text-2xl font-playfair font-bold text-slate-800 mb-3 line-clamp-2 group-hover:text-blue-600 transition-colors duration-300 leading-tight">
                                                    {service.name || "Tên dịch vụ"}
                                                </h3>
                                                <p className="text-slate-500 text-[14px] line-clamp-3 mb-6 flex-1 leading-relaxed">
                                                    {service.description || "Trải nghiệm tiện ích cao cấp dành riêng cho quý khách tại Luna Hotel."}
                                                </p>
                                                <div className="pt-5 border-t border-slate-100 border-dashed mt-auto flex items-end justify-between">
                                                    <div>
                                                        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Mức giá</span>
                                                        <span className="text-xl font-bold font-mono text-blue-600 block">{priceDisplay.replace("₫", "")}</span>
                                                        {service.price && <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{unitStr}</span>}
                                                    </div>
                                                    <button
                                                        onClick={() => handleAddToCart(service)}
                                                        className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all flex items-center justify-center shadow-sm group-hover:-translate-y-1"
                                                        title="Ghi nhớ dịch vụ này"
                                                    >
                                                        <i className="fa-solid fa-plus text-lg"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Phân trang */}
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-2 mt-16 flex-wrap animate-item">
                                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}
                                    className="w-12 h-12 flex items-center justify-center rounded-xl font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:text-blue-600">
                                    <i className="fa-solid fa-chevron-left text-sm"></i>
                                </button>
                                {Array.from({ length: totalPages }).map((_, i) => {
                                    const page = i + 1;
                                    if (page < currentPage - 2 || page > currentPage + 2) return null;
                                    return (
                                        <button
                                            key={page}
                                            onClick={() => handlePageChange(page)}
                                            className={`min-w-[48px] h-12 px-3 rounded-xl font-bold flex items-center justify-center transition-all ${currentPage === page
                                                    ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30 scale-110 z-10"
                                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:-translate-y-0.5 hover:text-blue-600 shadow-sm"
                                                }`}
                                        >
                                            {page}
                                        </button>
                                    );
                                })}
                                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}
                                    className="w-12 h-12 flex items-center justify-center rounded-xl font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:text-blue-600">
                                    <i className="fa-solid fa-chevron-right text-sm"></i>
                                </button>
                            </div>
                        )}
                    </div>
                </main>
                <Footer />
            </div>
        </>
    );
}
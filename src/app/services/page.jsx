// src/app/services/page.jsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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

    // State Tìm kiếm & Lọc
    const [searchQuery, setSearchQuery] = useState("");
    const [currentCategory, setCurrentCategory] = useState("All");

    // State Phân trang
    const [currentPage, setCurrentPage] = useState(1);
    const servicesPerPage = 6;
    const listRef = useRef(null);

    // 1. Fetch dữ liệu từ Firestore
    useEffect(() => {
        const fetchServices = async () => {
            try {
                const servicesSnap = await getDocs(collection(db, "services"));
                const loadedServices = servicesSnap.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setServices(loadedServices);
            } catch (error) {
                console.error("Lỗi tải dữ liệu dịch vụ:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchServices();
    }, []);

    // 2. Logic Lọc và Tìm kiếm
    const filteredServices = useMemo(() => {
        let result = [...services];

        // Lọc theo danh mục
        if (currentCategory !== "All") {
            result = result.filter((s) => s.category === currentCategory);
        }

        // Lọc theo từ khóa tìm kiếm
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(
                (s) =>
                    s.name?.toLowerCase().includes(lowerQuery) ||
                    s.description?.toLowerCase().includes(lowerQuery) ||
                    s.category?.toLowerCase().includes(lowerQuery)
            );
        }

        return result;
    }, [services, currentCategory, searchQuery]);

    // Đặt lại trang 1 nếu thay đổi điều kiện lọc
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
        // Cuộn mượt mà lên phần filter
        if (listRef.current) {
            listRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    // 4. Xử lý "Đặt ngay"
    const handleAddToCart = (service) => {
        sessionStorage.setItem("selectedService", JSON.stringify(service));
        alert(`Đã thêm ${service.name} vào danh sách đặt trước!`);
    };

    return (
        <div id="main-content" className="loaded bg-[#f8fafc] text-slate-800 min-h-screen">
            <Header />

            <main className="user-main">
                {/* Banner và Ô tìm kiếm */}
                <div
                    className="hero-section py-24 md:py-36 flex items-center justify-center relative"
                    style={{
                        backgroundImage: "url('https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=2000&auto=format&fit=crop')",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        backgroundAttachment: "fixed",
                    }}
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-900/30 to-black/60"></div>
                    <div className="max-w-4xl mx-auto px-4 text-center relative z-10 w-full">
                        <span className="inline-block py-1 px-3 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30 text-xs font-bold tracking-widest uppercase mb-6">
                            Luna Hotel & Resort
                        </span>
                        <h2 className="text-4xl md:text-6xl font-playfair font-bold text-white mb-6 leading-tight drop-shadow-lg">
                            Trải Nghiệm Đẳng Cấp <br />
                            <span className="italic font-light">Thư Giãn Tuyệt Đối</span>
                        </h2>

                        <div className="max-w-2xl mx-auto mt-10 relative group bg-white/20 backdrop-blur-lg p-2 rounded-2xl border border-white/30 shadow-2xl">
                            <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                                <i className="fa-solid fa-magnifying-glass text-white/80 text-lg"></i>
                            </div>
                            <input
                                type="text"
                                placeholder="Tìm kiếm dịch vụ theo tên, mô tả..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-14 pr-12 py-4 bg-white/90 rounded-xl border-0 focus:ring-4 focus:ring-white/50 text-slate-800 placeholder-slate-400 font-medium text-lg outline-none transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute inset-y-0 right-6 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <i className="fa-solid fa-circle-xmark text-xl"></i>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 md:px-8 py-16" ref={listRef}>
                    {/* Menu Bộ lọc Danh mục */}
                    <div className="flex flex-wrap justify-center gap-3 md:gap-4 mb-14" id="service-categories">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setCurrentCategory(cat.id)}
                                className={`px-6 py-2.5 rounded-full text-[15px] transition-all transform ${currentCategory === cat.id
                                        ? "font-semibold bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-105"
                                        : "font-medium bg-white text-slate-600 border border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                                    }`}
                            >
                                {cat.icon} {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Lưới danh sách Dịch vụ */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
                        {loading ? (
                            <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-20">
                                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-slate-500 font-medium">Đang tải dữ liệu dịch vụ...</p>
                            </div>
                        ) : paginatedServices.length === 0 ? (
                            <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-20">
                                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <i className="fa-solid fa-box-open text-4xl text-slate-400"></i>
                                </div>
                                <h3 className="text-2xl font-playfair font-bold text-slate-800 mb-2">
                                    Không tìm thấy dịch vụ
                                </h3>
                                <p className="text-slate-500">Vui lòng thử từ khóa hoặc danh mục khác.</p>
                            </div>
                        ) : (
                            paginatedServices.map((service, index) => {
                                const displayImage = service.image || DEFAULT_IMAGES[service.category] || DEFAULT_IMAGES["activities"];
                                const priceDisplay = service.price ? formatCurrency(service.price) : "Liên hệ";

                                return (
                                    <div
                                        key={service.id}
                                        className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 flex flex-col group animate-in fade-in slide-in-from-bottom-4"
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        <div className="relative h-60 w-full overflow-hidden">
                                            <img
                                                src={displayImage}
                                                alt={service.name || "Dịch vụ"}
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full">
                                                <span className="text-sm font-bold text-blue-600">{priceDisplay}</span>
                                            </div>
                                        </div>

                                        <div className="p-6 flex-1 flex flex-col">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                                    {service.category || "Dịch vụ"}
                                                </span>
                                            </div>
                                            <h3 className="text-xl font-playfair font-bold text-slate-800 mb-3 line-clamp-2">
                                                {service.name || "Tên dịch vụ"}
                                            </h3>
                                            <p className="text-slate-500 text-sm line-clamp-3 mb-6 flex-1">
                                                {service.description || "Chưa có mô tả chi tiết."}
                                            </p>
                                            <button
                                                onClick={() => handleAddToCart(service)}
                                                className="w-full py-3.5 rounded-xl bg-slate-50 text-slate-700 font-semibold border border-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all flex items-center justify-center gap-2"
                                            >
                                                <i className="fa-solid fa-cart-plus"></i> Đặt ngay
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Phân trang */}
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-2 mt-12 flex-wrap">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="w-11 h-11 flex items-center justify-center rounded-xl font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <i className="fa-solid fa-arrow-left text-sm"></i>
                            </button>

                            {Array.from({ length: totalPages }).map((_, i) => {
                                const page = i + 1;
                                // Chỉ hiển thị tối đa 5 trang
                                if (page < currentPage - 2 || page > currentPage + 2) return null;

                                return (
                                    <button
                                        key={page}
                                        onClick={() => handlePageChange(page)}
                                        className={`min-w-[44px] h-11 px-3 rounded-xl font-bold flex items-center justify-center transition-all ${currentPage === page
                                                ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20"
                                                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:-translate-y-0.5"
                                            }`}
                                    >
                                        {page}
                                    </button>
                                );
                            })}

                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="w-11 h-11 flex items-center justify-center rounded-xl font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <i className="fa-solid fa-arrow-right text-sm"></i>
                            </button>
                        </div>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}
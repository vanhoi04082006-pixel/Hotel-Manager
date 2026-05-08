// src/app/admin/layout.jsx
"use client";

import AdminAIChatbot from "@/components/AdminAIChatbot";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, collection, onSnapshot } from "firebase/firestore";
import * as XLSX from "xlsx";
import "./admin.css";

const ADMIN_EMAIL = 'lunanewyear@gmail.com';

const formatCurrency = (amount) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount || 0);

const formatDate = (timestamp) => {
  if (!timestamp) return "";
  try {
    const d = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString("vi-VN");
  } catch (e) { return ""; }
};

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  
  // States Layout & Auth
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Thêm state cho mobile
  const [adminUser, setAdminUser] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  
  // States Database (Dùng cho Global Search)
  const [dbData, setDbData] = useState({ rooms: [], staff: [], customers: [], bookings: [], services: [] });

  // States Global Search
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("all");
  const [searchResults, setSearchResults] = useState([]);
  const searchTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);

  // 1. Đồng hồ thời gian thực & Phím tắt Ctrl+K
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleString('vi-VN')), 1000);
    
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      clearInterval(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Đóng sidebar mobile khi chuyển trang
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // 2. Focus input khi mở Modal Tìm kiếm
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current.focus(), 100);
    } else {
      setSearchQuery("");
      setSearchType("all");
      setSearchResults([]);
    }
  }, [isSearchOpen]);

  // 3. Lấy Dữ liệu Tổng hợp để Tìm kiếm & Kiểm tra quyền Admin
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const role = userDoc.exists() ? userDoc.data().role : null;
        
        if (user.email === ADMIN_EMAIL || role === "admin") {
          setAdminUser({ name: userDoc.exists() ? userDoc.data().name : "Admin", email: user.email });
          setIsAuthorized(true);
        } else {
          alert("Bạn không có quyền truy cập trang này!");
          router.push("/");
        }
      } else {
        router.push("/login");
      }
    });

    const unsubs = [];
    if (isAuthorized) {
      unsubs.push(onSnapshot(collection(db, "bookings"), (snap) => {
        const loaded = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPendingCount(loaded.filter(b => b.status === "pending").length);
        setDbData(prev => ({ ...prev, bookings: loaded }));
      }));
      unsubs.push(onSnapshot(collection(db, "rooms"), (snap) => setDbData(prev => ({ ...prev, rooms: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) }))));
      unsubs.push(onSnapshot(collection(db, "staff"), (snap) => setDbData(prev => ({ ...prev, staff: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) }))));
      unsubs.push(onSnapshot(collection(db, "users"), (snap) => setDbData(prev => ({ ...prev, customers: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(u => u.role !== "admin") }))));
      unsubs.push(onSnapshot(collection(db, "services"), (snap) => setDbData(prev => ({ ...prev, services: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) }))));
    }

    return () => {
      unsubscribeAuth();
      unsubs.forEach(unsub => unsub());
    };
  }, [isAuthorized, router]);

  // 4. Logic Global Search
  const performSearch = (query, type) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    const q = query.toLowerCase();
    let results = [];

    if (type === 'all' || type === 'rooms') {
      const matched = dbData.rooms.filter(room => (room.code || '').toLowerCase().includes(q) || (room.name || '').toLowerCase().includes(q) || (room.type || '').toLowerCase().includes(q)).map(data => ({ type: 'room', data }));
      results = [...results, ...matched];
    }
    if (type === 'all' || type === 'staff') {
      const matched = dbData.staff.filter(staff => (staff.name || '').toLowerCase().includes(q) || (staff.email || '').toLowerCase().includes(q) || (staff.phone || '').toLowerCase().includes(q)).map(data => ({ type: 'staff', data }));
      results = [...results, ...matched];
    }
    if (type === 'all' || type === 'customers') {
      const matched = dbData.customers.filter(user => (user.name || '').toLowerCase().includes(q) || (user.email || '').toLowerCase().includes(q) || (user.phone || '').toLowerCase().includes(q)).map(data => ({ type: 'customer', data }));
      results = [...results, ...matched];
    }
    if (type === 'all' || type === 'bookings') {
      const matched = dbData.bookings.filter(booking => (booking.roomCode || '').toLowerCase().includes(q) || (booking.userName || '').toLowerCase().includes(q) || (booking.userEmail || '').toLowerCase().includes(q) || (booking.id || '').toLowerCase().includes(q)).map(data => ({ type: 'booking', data }));
      results = [...results, ...matched];
    }
    if (type === 'all' || type === 'services') {
      const matched = dbData.services.filter(service => (service.name || '').toLowerCase().includes(q) || (service.category || '').toLowerCase().includes(q)).map(data => ({ type: 'service', data }));
      results = [...results, ...matched];
    }

    setSearchResults(results);
  };

  const handleSearchInput = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => performSearch(val, searchType), 300);
  };

  const handleTypeChange = (newType) => {
    setSearchType(newType);
    performSearch(searchQuery, newType);
  };

  const exportSearchResults = () => {
    if (searchResults.length === 0) return;
    try {
      const exportData = searchResults.map(r => ({
        'Phân Loại': r.type.toUpperCase(),
        'ID Hệ thống': r.data.id || '',
        'Thông tin chính': r.data.name || r.data.userName || r.data.code || '',
        'Mô tả/Email': r.data.email || r.data.description || r.data.roomCode || '',
        'Trạng thái': r.data.status || r.data.active || ''
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "KetQuaTimKiem");
      XLSX.writeFile(wb, `Luna_TimKiem_${new Date().getTime()}.xlsx`);
    } catch (e) { alert('Lỗi xuất Excel: ' + e.message); }
  };

  const handleLogout = async () => {
    if (confirm("Bạn có chắc muốn đăng xuất?")) {
      await signOut(auth);
      localStorage.removeItem("currentUser");
      router.push("/login");
    }
  };

  // Tính toán trạng thái hiển thị nội dung bên trong Menu
  const isExpanded = isSidebarOpen || isMobileMenuOpen;

  const NavItem = ({ href, icon, text, badge }) => {
    const isActive = pathname === href || (href === "/admin" && pathname === "/admin");
    return (
      <Link 
        href={href} 
        prefetch={false} /* THÊM DÒNG NÀY ĐỂ NGĂN NEXT.JS SPAM KẾT NỐI */
        title={!isExpanded ? text : ""} 
        className={`w-full flex items-center py-3 rounded-xl transition-all relative ${isExpanded ? "px-4" : "justify-center"} ${isActive ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-700 hover:text-white"}`}
      >
        <i className={`fa-solid ${icon} text-center ${!isExpanded ? "text-[18px]" : "w-6"}`}></i>
        
        {isExpanded && (
          <span className="font-medium ml-2 whitespace-nowrap">{text}</span>
        )}

        {isExpanded && badge > 0 && (
          <span className="absolute right-4 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{badge}</span>
        )}
        
        {!isExpanded && badge > 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-slate-900"></span>
        )}
      </Link>
    );
  };

  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  const pageTitle = pathname === "/admin" ? "Dashboard" : pathname.split('/').pop().replace('-', ' ');

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* 5. Overlay cho Menu Mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      {/* Sidebar - Fix z-index priority issue with !z-[100] */}
      <aside 
        id="sidebar" 
        className={`
          fixed md:relative top-0 left-0 h-full !z-[100] md:!z-50
          bg-gradient-to-b from-slate-900 to-slate-800 text-slate-300 flex flex-col border-r border-slate-700 flex-shrink-0 transition-transform duration-300 ease-in-out md:transition-all
          ${isMobileMenuOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0"}
          ${(!isSidebarOpen && !isMobileMenuOpen) ? "md:w-[85px] sidebar-collapsed" : "md:w-72"}
        `}
      >
        
        {/* Nút đóng Sidebar trên Mobile */}
        <div className="absolute top-6 right-4 md:hidden z-10">
          <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white p-2">
            <i className="fa-solid fa-xmark text-2xl"></i>
          </button>
        </div>

        {/* Header Logo */}
        <div className={`sidebar-header h-20 flex items-center border-b border-slate-700 bg-slate-900/50 flex-shrink-0 cursor-pointer hover:bg-slate-800/50 transition-colors overflow-hidden relative ${isExpanded ? "px-6" : "justify-center"}`} onClick={() => window.open('/', '_blank')} title={!isExpanded ? "Xem website" : ""}>
          <div className={`bg-blue-600 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0 transition-all ${isExpanded ? "w-10 h-10 mr-3" : "w-12 h-12"}`}>
            <i className={`fa-solid fa-hotel text-white ${!isExpanded ? "text-[22px]" : ""}`}></i>
          </div>
          <div className={`sidebar-logo-text overflow-hidden whitespace-nowrap transition-all duration-300 ${isExpanded ? "opacity-100 w-auto pr-8 md:pr-0" : "opacity-0 w-0"}`}>
            <h1 className="text-xl font-playfair font-bold text-white truncate">LUNA ADMIN</h1>
            <p className="text-xs text-slate-400 truncate">Xem website <i className="fa-solid fa-external-link-alt ml-1"></i></p>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className={`flex-1 overflow-y-auto py-6 custom-scroll overflow-x-hidden ${isExpanded ? "px-4" : "px-3"}`}>
          <p className={`text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 whitespace-nowrap transition-all ${isExpanded ? "px-4 text-left" : "text-center"}`}>
            {isExpanded ? "Tổng quan" : "---"}
          </p>
          <nav className="space-y-1 mb-6">
            <NavItem href="/admin" icon="fa-chart-pie" text="Dashboard" />
            <NavItem href="/admin/bookings" icon="fa-calendar-check" text="Đặt phòng" badge={pendingCount} />
          </nav>

          <p className={`text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 whitespace-nowrap transition-all ${isExpanded ? "px-4 text-left" : "text-center"}`}>
            {isExpanded ? "Quản lý" : "---"}
          </p>
          <nav className="space-y-1 mb-6">
            <NavItem href="/admin/rooms" icon="fa-door-open" text="Phòng" />
            <NavItem href="/admin/services" icon="fa-concierge-bell" text="Dịch vụ" />
            <NavItem href="/admin/customers" icon="fa-users" text="Khách hàng" />
            <NavItem href="/admin/promotions" icon="fa-tags" text="Khuyến mãi" />
            <NavItem href="/admin/staff" icon="fa-user-tie" text="Nhân viên" />
            <NavItem href="/admin/reviews" icon="fa-star" text="Đánh giá" />
            <NavItem href="/admin/gallery" icon="fa-images" text="Thư viện ảnh" />
            <NavItem href="/admin/invoices" icon="fa-file-invoice" text="Hóa đơn" />
            <NavItem href="/admin/reports" icon="fa-chart-simple" text="Báo cáo" />
          </nav>

          <p className={`text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 whitespace-nowrap transition-all ${isExpanded ? "px-4 text-left" : "text-center"}`}>
            {isExpanded ? "Hệ thống" : "---"}
          </p>
          <nav className="space-y-1 mb-4">
            <NavItem href="/admin/settings" icon="fa-gear" text="Cài đặt" />
            <NavItem href="/admin/backup" icon="fa-database" text="Sao lưu" />
            <NavItem href="/admin/logs" icon="fa-clock-rotate-left" text="Nhật ký" />
          </nav>
        </div>

        {/* Footer User Info */}
        <div className={`admin-footer border-t border-slate-700 bg-slate-900/50 flex-shrink-0 flex items-center overflow-hidden transition-all duration-300 ${isExpanded ? "p-4" : "p-4 justify-center"}`}>
          <div className={`rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0 transition-all cursor-pointer ${isExpanded ? "w-10 h-10" : "w-11 h-11 text-lg"}`} title={!isExpanded ? "Đăng xuất" : ""} onClick={!isExpanded ? handleLogout : undefined}>
            {adminUser?.name?.charAt(0).toUpperCase() || "A"}
          </div>
          
          <div className={`admin-info-text ml-3 flex-1 overflow-hidden transition-all duration-300 ${isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 hidden"}`}>
            <p className="text-sm font-bold text-white truncate">{adminUser?.name}</p>
            <p className="text-xs text-slate-500 truncate">{adminUser?.email}</p>
          </div>

          {isExpanded && (
            <button onClick={handleLogout} className="logout-btn text-slate-400 hover:text-red-400 transition-colors p-2 hover:bg-slate-700 rounded-lg flex-shrink-0 ml-2" title="Đăng xuất">
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative w-full">
        <header className="h-20 bg-white shadow-sm border-b border-slate-200 flex items-center justify-between px-4 md:px-8 flex-shrink-0 transition-all z-20 w-full">
          <div className="flex items-center gap-3 md:gap-4">
            {/* Desktop Toggle Button */}
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hidden md:flex w-10 h-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors" title="Thu gọn / Phóng to Menu">
              <i className="fa-solid fa-bars-staggered text-xl"></i>
            </button>
            
            {/* Mobile Toggle Button */}
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden flex w-10 h-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors">
              <i className="fa-solid fa-bars text-xl"></i>
            </button>
            
            <h2 className="text-xl md:text-2xl font-playfair font-bold text-slate-900 capitalize block truncate max-w-[150px] sm:max-w-[200px] md:max-w-none">
              {pageTitle}
            </h2>
          </div>
          
          {/* Thanh tìm kiếm toàn cục Header - Ẩn trên mobile siêu nhỏ, hiện trên tablet trở lên */}
          <div className="flex-1 max-w-md mx-2 md:mx-8 hidden sm:block">
            <div className="relative group">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-3.5 text-slate-400 group-hover:text-blue-500 transition-colors"></i>
              <input 
                type="text" 
                placeholder="Tìm kiếm nhanh (Ctrl+K)" 
                className="w-full pl-11 pr-12 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer hover:border-blue-300"
                onClick={() => setIsSearchOpen(true)}
                readOnly
              />
              <div className="absolute right-3 top-2.5 text-xs bg-slate-100 px-2 py-1 rounded-md text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors pointer-events-none hidden md:block">
                Ctrl+K
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            {/* Nút search chỉ hiện trên điện thoại thay cho thanh input dài */}
            <button onClick={() => setIsSearchOpen(true)} className="sm:hidden w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors">
              <i className="fa-solid fa-magnifying-glass text-lg"></i>
            </button>

            <div className="hidden md:flex items-center space-x-2 bg-slate-100 px-4 py-2 rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-sm text-slate-600 font-medium">Online</span>
            </div>
            <div className="hidden lg:block h-8 w-px bg-slate-200"></div>
            <span className="hidden lg:block text-sm text-slate-500 font-medium whitespace-nowrap">{currentTime}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 relative z-10 custom-scroll w-full">
          {children}
        </main>
      </div>

      {/* Global Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-start justify-center pt-4 sm:pt-20 p-4">
          <div className="absolute inset-0" onClick={() => setIsSearchOpen(false)}></div>
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col relative z-10 animate-in slide-in-from-bottom-4">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl sm:text-2xl font-playfair font-bold text-slate-900">Tìm kiếm hệ thống</h3>
                <button onClick={() => setIsSearchOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>

              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-4 top-4 text-slate-400"></i>
                <input 
                  type="text" 
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={handleSearchInput}
                  className="w-full pl-11 pr-12 py-3 sm:py-4 text-base sm:text-lg border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all bg-slate-50 focus:bg-white" 
                  placeholder="Tìm phòng, nhân viên, khách hàng..." 
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1">
                    <i className="fa-solid fa-circle-xmark text-xl"></i>
                  </button>
                )}
              </div>

              <div className="flex flex-nowrap overflow-x-auto hide-scrollbar gap-2 mt-4 pb-2">
                {[
                  { id: "all", label: "Tất cả", icon: "" },
                  { id: "rooms", label: "Phòng", icon: "fa-door-open" },
                  { id: "staff", label: "Nhân viên", icon: "fa-user-tie" },
                  { id: "customers", label: "Khách hàng", icon: "fa-users" },
                  { id: "bookings", label: "Đặt phòng", icon: "fa-calendar-check" },
                  { id: "services", label: "Dịch vụ", icon: "fa-concierge-bell" }
                ].map(tab => (
                  <button key={tab.id} onClick={() => handleTypeChange(tab.id)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${searchType === tab.id ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-900"}`}>
                    {tab.icon && <i className={`fa-solid ${tab.icon} mr-1.5`}></i>} {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Body: Results */}
            <div className="overflow-y-auto flex-1 p-4 sm:p-6 bg-slate-50 custom-scroll">
              {(!searchQuery || searchQuery.length < 2) ? (
                <div className="text-center py-12 text-slate-500">
                  <i className="fa-solid fa-magnifying-glass text-5xl mb-4 opacity-30"></i>
                  <p className="text-lg">Nhập ít nhất 2 ký tự để tìm kiếm</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <i className="fa-regular fa-face-frown text-5xl mb-4 opacity-30"></i>
                  <p className="text-lg text-slate-700 font-medium">Không tìm thấy kết quả phù hợp</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {searchResults.map((result, index) => {
                    const prevType = index > 0 ? searchResults[index - 1].type : null;
                    const showHeader = result.type !== prevType;
                    const typeNames = { room: '🏨 PHÒNG NGHỈ', staff: '👤 NHÂN SỰ', customer: '👥 KHÁCH HÀNG', booking: '📅 ĐƠN ĐẶT PHÒNG', service: '⚙️ DỊCH VỤ THÊM' };

                    return (
                      <div key={`${result.type}-${index}`}>
                        {showHeader && (
                          <div className={`mb-3 mt-${index > 0 ? '6' : '0'}`}>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider">{typeNames[result.type]}</h4>
                          </div>
                        )}
                        
                        {/* Render Card Room */}
                        {result.type === 'room' && (
                          <div onClick={() => { router.push('/admin/rooms'); setIsSearchOpen(false); }} className="bg-white rounded-xl p-3 sm:p-4 mb-3 hover:shadow-md cursor-pointer border border-slate-200 hover:border-blue-300 transition-all animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center">
                              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-100 rounded-lg overflow-hidden mr-3 sm:mr-4 flex-shrink-0">
                                <img src={result.data.image || "https://images.unsplash.com/photo-1611892440504-42a792e24d32"} className="w-full h-full object-cover" alt="room" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-bold text-slate-800 text-sm sm:text-base truncate">Phòng {result.data.code}</h5>
                                  <span className="text-[10px] sm:text-xs bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">{result.data.type}</span>
                                </div>
                                <p className="text-xs sm:text-sm text-slate-500 mt-1 truncate">{result.data.name}</p>
                              </div>
                              <div className="text-right ml-2 flex-shrink-0">
                                <p className="font-bold text-blue-600 text-sm sm:text-base">{formatCurrency(result.data.price)}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Render Card Customer */}
                        {result.type === 'customer' && (
                          <div onClick={() => { router.push('/admin/customers'); setIsSearchOpen(false); }} className="bg-white rounded-xl p-3 sm:p-4 mb-3 hover:shadow-md cursor-pointer border border-slate-200 hover:border-blue-300 transition-all animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-full flex items-center justify-center font-bold text-purple-600 mr-3 sm:mr-4 text-base sm:text-lg flex-shrink-0">
                                {(result.data.name || result.data.email || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-bold text-slate-800 text-sm sm:text-base truncate">{result.data.name || 'Không tên'}</h5>
                                </div>
                                <p className="text-xs sm:text-sm text-slate-500 mt-1 truncate">{result.data.email}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Render Card Staff */}
                        {result.type === 'staff' && (
                          <div onClick={() => { router.push('/admin/staff'); setIsSearchOpen(false); }} className="bg-white rounded-xl p-3 sm:p-4 mb-3 hover:shadow-md cursor-pointer border border-slate-200 hover:border-blue-300 transition-all animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 rounded-full flex items-center justify-center font-bold text-indigo-600 mr-3 sm:mr-4 text-base sm:text-lg flex-shrink-0">
                                {(result.data.name || 'S').charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h5 className="font-bold text-slate-800 text-sm sm:text-base truncate">{result.data.name}</h5>
                                <p className="text-xs sm:text-sm text-slate-500 mt-1 truncate">{result.data.position}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Render Card Booking */}
                        {result.type === 'booking' && (
                          <div onClick={() => { router.push('/admin/bookings'); setIsSearchOpen(false); }} className="bg-white rounded-xl p-3 sm:p-4 mb-3 hover:shadow-md cursor-pointer border border-slate-200 hover:border-blue-300 transition-all animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 mr-3 sm:mr-4 text-lg sm:text-xl flex-shrink-0">
                                <i className="fa-solid fa-calendar-check"></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-bold text-slate-800 text-sm sm:text-base truncate">{result.data.userName || result.data.userEmail}</h5>
                                </div>
                                <p className="text-[10px] sm:text-xs text-slate-500 mt-1 truncate">{formatDate(result.data.checkIn)} <i className="fa-solid fa-arrow-right mx-1"></i> {formatDate(result.data.checkOut)}</p>
                              </div>
                              <div className="text-right ml-2 flex-shrink-0">
                                <p className="font-bold text-blue-600 text-sm sm:text-base">{formatCurrency(result.data.totalPrice)}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Render Card Service */}
                        {result.type === 'service' && (
                          <div onClick={() => { router.push('/admin/services'); setIsSearchOpen(false); }} className="bg-white rounded-xl p-3 sm:p-4 mb-3 hover:shadow-md cursor-pointer border border-slate-200 hover:border-blue-300 transition-all animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 mr-3 sm:mr-4 text-lg sm:text-xl flex-shrink-0">
                                <i className={`fa-solid fa-${result.data.icon || 'star'}`}></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h5 className="font-bold text-slate-800 text-sm sm:text-base truncate">{result.data.name}</h5>
                                <p className="text-xs sm:text-sm text-slate-500 mt-1">{formatCurrency(result.data.price)} / {result.data.unit}</p>
                              </div>
                            </div>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center">
              <div className="text-xs sm:text-sm text-slate-500 font-medium">
                {searchResults.length} kết quả
              </div>
              <button 
                onClick={exportSearchResults} 
                disabled={searchResults.length === 0}
                className="bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 border border-transparent text-xs sm:text-sm py-2 px-3 sm:px-4 rounded-xl font-bold transition-all disabled:opacity-50 disabled:hover:bg-slate-100 flex items-center"
              >
                <i className="fa-regular fa-file-excel mr-2"></i><span className="hidden sm:inline">Xuất Excel</span><span className="sm:hidden">Xuất</span>
              </button>
            </div>

          </div>
        </div>
      )}
      <AdminAIChatbot />
    </div>
  );
}
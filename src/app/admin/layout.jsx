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

  // 2. Focus input khi mở Modal Tìm kiếm
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current.focus(), 100);
    } else {
      // Reset khi đóng
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

    // Lắng nghe dữ liệu
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

  // Component NavItem hỗ trợ thu gọn mượt mà
  const NavItem = ({ href, icon, text, badge }) => {
    const isActive = pathname === href || (href === "/admin" && pathname === "/admin");
    return (
      <Link href={href} title={!isSidebarOpen ? text : ""} className={`w-full flex items-center py-3 rounded-xl transition-all relative ${isSidebarOpen ? "px-4" : "justify-center"} ${isActive ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-700 hover:text-white"}`}>
        <i className={`fa-solid ${icon} text-center ${!isSidebarOpen ? "text-[18px]" : "w-6"}`}></i>
        
        {/* Render text chỉ khi sidebar mở */}
        {isSidebarOpen && (
          <span className="font-medium ml-2 whitespace-nowrap">{text}</span>
        )}

        {/* Render Badge số khi mở */}
        {isSidebarOpen && badge > 0 && (
          <span className="absolute right-4 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{badge}</span>
        )}
        
        {/* Render dấu chấm đỏ nhỏ xíu khi đóng (nếu có thông báo) */}
        {!isSidebarOpen && badge > 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-slate-900"></span>
        )}
      </Link>
    );
  };

  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  const pageTitle = pathname === "/admin" ? "Dashboard" : pathname.split('/').pop().replace('-', ' ');

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside id="sidebar" className={`${isSidebarOpen ? "w-72" : "w-[85px] sidebar-collapsed"} bg-gradient-to-b from-slate-900 to-slate-800 text-slate-300 flex flex-col border-r border-slate-700 flex-shrink-0 transition-all duration-300 ease-in-out z-50`}>
        
        {/* Header Logo */}
        <div className={`sidebar-header h-20 flex items-center border-b border-slate-700 bg-slate-900/50 flex-shrink-0 cursor-pointer hover:bg-slate-800/50 transition-colors overflow-hidden ${isSidebarOpen ? "px-6" : "justify-center"}`} onClick={() => window.open('/', '_blank')} title={!isSidebarOpen ? "Xem website" : ""}>
          <div className={`bg-blue-600 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0 transition-all ${isSidebarOpen ? "w-10 h-10 mr-3" : "w-12 h-12"}`}>
            <i className={`fa-solid fa-hotel text-white ${!isSidebarOpen ? "text-[22px]" : ""}`}></i>
          </div>
          <div className={`sidebar-logo-text overflow-hidden whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0"}`}>
            <h1 className="text-xl font-playfair font-bold text-white truncate">LUNA ADMIN</h1>
            <p className="text-xs text-slate-400 truncate">Xem website <i className="fa-solid fa-external-link-alt ml-1"></i></p>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className={`flex-1 overflow-y-auto py-6 custom-scroll overflow-x-hidden ${isSidebarOpen ? "px-4" : "px-3"}`}>
          
          <p className={`text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 whitespace-nowrap transition-all ${isSidebarOpen ? "px-4 text-left" : "text-center"}`}>
            {isSidebarOpen ? "Tổng quan" : "---"}
          </p>
          <nav className="space-y-1 mb-6">
            <NavItem href="/admin" icon="fa-chart-pie" text="Dashboard" />
            <NavItem href="/admin/bookings" icon="fa-calendar-check" text="Đặt phòng" badge={pendingCount} />
          </nav>

          <p className={`text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 whitespace-nowrap transition-all ${isSidebarOpen ? "px-4 text-left" : "text-center"}`}>
            {isSidebarOpen ? "Quản lý" : "---"}
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

          <p className={`text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 whitespace-nowrap transition-all ${isSidebarOpen ? "px-4 text-left" : "text-center"}`}>
            {isSidebarOpen ? "Hệ thống" : "---"}
          </p>
          <nav className="space-y-1 mb-4">
            <NavItem href="/admin/settings" icon="fa-gear" text="Cài đặt" />
            <NavItem href="/admin/backup" icon="fa-database" text="Sao lưu" />
            <NavItem href="/admin/logs" icon="fa-clock-rotate-left" text="Nhật ký" />
          </nav>
        </div>

        {/* Footer User Info */}
        <div className={`admin-footer border-t border-slate-700 bg-slate-900/50 flex-shrink-0 flex items-center overflow-hidden transition-all duration-300 ${isSidebarOpen ? "p-4" : "p-4 justify-center"}`}>
          <div className={`rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0 transition-all cursor-pointer ${isSidebarOpen ? "w-10 h-10" : "w-11 h-11 text-lg"}`} title={!isSidebarOpen ? "Đăng xuất" : ""} onClick={!isSidebarOpen ? handleLogout : undefined}>
            {adminUser?.name?.charAt(0).toUpperCase() || "A"}
          </div>
          
          <div className={`admin-info-text ml-3 flex-1 overflow-hidden transition-all duration-300 ${isSidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0 hidden"}`}>
            <p className="text-sm font-bold text-white truncate">{adminUser?.name}</p>
            <p className="text-xs text-slate-500 truncate">{adminUser?.email}</p>
          </div>

          {isSidebarOpen && (
            <button onClick={handleLogout} className="logout-btn text-slate-400 hover:text-red-400 transition-colors p-2 hover:bg-slate-700 rounded-lg flex-shrink-0 ml-2" title="Đăng xuất">
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 bg-white shadow-sm border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0 transition-all z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors" title="Thu gọn / Phóng to Menu">
              <i className="fa-solid fa-bars-staggered text-xl"></i>
            </button>
            <h2 className="text-2xl font-playfair font-bold text-slate-900 capitalize hidden sm:block">
              {pageTitle}
            </h2>
          </div>
          
          {/* Thanh tìm kiếm toàn cục Header */}
          <div className="flex-1 max-w-md mx-4 md:mx-8">
            <div className="relative group">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-3.5 text-slate-400 group-hover:text-blue-500 transition-colors"></i>
              <input 
                type="text" 
                placeholder="Tìm kiếm nhanh (Ctrl+K)" 
                className="w-full pl-11 pr-12 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer hover:border-blue-300"
                onClick={() => setIsSearchOpen(true)}
                readOnly
              />
              <div className="absolute right-3 top-2.5 text-xs bg-slate-100 px-2 py-1 rounded-md text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors pointer-events-none">
                Ctrl+K
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 bg-slate-100 px-4 py-2 rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-sm text-slate-600 font-medium">Online</span>
            </div>
            <div className="hidden lg:block h-8 w-px bg-slate-200"></div>
            <span className="hidden lg:block text-sm text-slate-500 font-medium whitespace-nowrap">{currentTime}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 relative z-10 custom-scroll">
          {children}
        </main>
      </div>

      {/* Global Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-start justify-center pt-10 sm:pt-20 p-4">
          <div className="absolute inset-0" onClick={() => setIsSearchOpen(false)}></div>
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col relative z-10 animate-in slide-in-from-bottom-4">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-playfair font-bold text-slate-900">Tìm kiếm toàn hệ thống</h3>
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
                  className="w-full pl-11 pr-12 py-4 text-lg border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all bg-slate-50 focus:bg-white" 
                  placeholder="Tìm kiếm phòng, nhân viên, khách hàng, đặt phòng..." 
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1">
                    <i className="fa-solid fa-circle-xmark text-xl"></i>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {[
                  { id: "all", label: "Tất cả", icon: "" },
                  { id: "rooms", label: "Phòng", icon: "fa-door-open" },
                  { id: "staff", label: "Nhân viên", icon: "fa-user-tie" },
                  { id: "customers", label: "Khách hàng", icon: "fa-users" },
                  { id: "bookings", label: "Đặt phòng", icon: "fa-calendar-check" },
                  { id: "services", label: "Dịch vụ", icon: "fa-concierge-bell" }
                ].map(tab => (
                  <button key={tab.id} onClick={() => handleTypeChange(tab.id)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${searchType === tab.id ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-900"}`}>
                    {tab.icon && <i className={`fa-solid ${tab.icon} mr-1.5`}></i>} {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Body: Results */}
            <div className="overflow-y-auto flex-1 p-6 bg-slate-50 custom-scroll">
              {(!searchQuery || searchQuery.length < 2) ? (
                <div className="text-center py-12 text-slate-500">
                  <i className="fa-solid fa-magnifying-glass text-5xl mb-4 opacity-30"></i>
                  <p className="text-lg">Nhập ít nhất 2 ký tự để bắt đầu tìm kiếm</p>
                  <p className="text-sm mt-2">Tìm kiếm theo mã phòng, tên nhân viên, email, số điện thoại...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <i className="fa-regular fa-face-frown text-5xl mb-4 opacity-30"></i>
                  <p className="text-lg text-slate-700 font-medium">Không tìm thấy kết quả phù hợp</p>
                  <p className="text-sm mt-1">Vui lòng thử lại với từ khóa khác</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {searchResults.map((result, index) => {
                    // Logic xác định header (phân tách nhóm)
                    const prevType = index > 0 ? searchResults[index - 1].type : null;
                    const showHeader = result.type !== prevType;
                    const typeNames = { room: '🏨 PHÒNG NGHỈ', staff: '👤 NHÂN SỰ', customer: '👥 KHÁCH HÀNG', booking: '📅 ĐƠN ĐẶT PHÒNG', service: '⚙️ DỊCH VỤ THÊM' };

                    return (
                      <div key={`${result.type}-${index}`}>
                        {showHeader && (
                          <div className={`mb-3 mt-${index > 0 ? '6' : '0'}`}>
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{typeNames[result.type]}</h4>
                          </div>
                        )}
                        
                        {/* Render Card Room */}
                        {result.type === 'room' && (
                          <div onClick={() => { router.push('/admin/rooms'); setIsSearchOpen(false); }} className="bg-white rounded-xl p-4 mb-3 hover:shadow-md cursor-pointer border border-slate-200 hover:border-blue-300 transition-all animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center">
                              <div className="w-14 h-14 bg-slate-100 rounded-lg overflow-hidden mr-4">
                                <img src={result.data.image || "https://images.unsplash.com/photo-1611892440504-42a792e24d32"} className="w-full h-full object-cover" alt="room" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-bold text-slate-800">Phòng {result.data.code}</h5>
                                  <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">{result.data.type}</span>
                                </div>
                                <p className="text-sm text-slate-500 mt-1 truncate">{result.data.name}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-blue-600">{formatCurrency(result.data.price)}</p>
                                <p className="text-xs text-slate-400">{result.data.status === 'available' ? 'Còn trống' : 'Đã đặt'}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Render Card Customer */}
                        {result.type === 'customer' && (
                          <div onClick={() => { router.push('/admin/customers'); setIsSearchOpen(false); }} className="bg-white rounded-xl p-4 mb-3 hover:shadow-md cursor-pointer border border-slate-200 hover:border-blue-300 transition-all animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center">
                              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center font-bold text-purple-600 mr-4 text-lg">
                                {(result.data.name || result.data.email || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-bold text-slate-800">{result.data.name || 'Không tên'}</h5>
                                  <span className={`text-xs ${result.data.role === 'vip' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'} px-2 py-0.5 rounded-full`}>{result.data.role === 'vip' ? 'VIP' : 'Thường'}</span>
                                </div>
                                <p className="text-sm text-slate-500 mt-1">{result.data.email} • {result.data.phone || 'Chưa có SĐT'}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Render Card Staff */}
                        {result.type === 'staff' && (
                          <div onClick={() => { router.push('/admin/staff'); setIsSearchOpen(false); }} className="bg-white rounded-xl p-4 mb-3 hover:shadow-md cursor-pointer border border-slate-200 hover:border-blue-300 transition-all animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center">
                              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center font-bold text-indigo-600 mr-4 text-lg">
                                {(result.data.name || 'S').charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <h5 className="font-bold text-slate-800">{result.data.name}</h5>
                                <p className="text-sm text-slate-500 mt-1">{result.data.position} • {result.data.department}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Render Card Booking */}
                        {result.type === 'booking' && (
                          <div onClick={() => { router.push('/admin/bookings'); setIsSearchOpen(false); }} className="bg-white rounded-xl p-4 mb-3 hover:shadow-md cursor-pointer border border-slate-200 hover:border-blue-300 transition-all animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center">
                              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 mr-4 text-xl">
                                <i className="fa-solid fa-calendar-check"></i>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-bold text-slate-800">{result.data.userName || result.data.userEmail}</h5>
                                  <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full font-mono">P.{result.data.roomCode}</span>
                                </div>
                                <p className="text-sm text-slate-500 mt-1">{formatDate(result.data.checkIn)} <i className="fa-solid fa-arrow-right text-[10px] mx-1"></i> {formatDate(result.data.checkOut)}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-blue-600">{formatCurrency(result.data.totalPrice)}</p>
                                <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{result.data.status}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Render Card Service */}
                        {result.type === 'service' && (
                          <div onClick={() => { router.push('/admin/services'); setIsSearchOpen(false); }} className="bg-white rounded-xl p-4 mb-3 hover:shadow-md cursor-pointer border border-slate-200 hover:border-blue-300 transition-all animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center">
                              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 mr-4 text-xl">
                                <i className={`fa-solid fa-${result.data.icon || 'star'}`}></i>
                              </div>
                              <div className="flex-1">
                                <h5 className="font-bold text-slate-800">{result.data.name}</h5>
                                <p className="text-sm text-slate-500 mt-1">{formatCurrency(result.data.price)} / {result.data.unit}</p>
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
              <div className="text-sm text-slate-500 font-medium">
                {searchResults.length} kết quả
              </div>
              <button 
                onClick={exportSearchResults} 
                disabled={searchResults.length === 0}
                className="bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 border border-transparent text-sm py-2 px-4 rounded-xl font-bold transition-all disabled:opacity-50 disabled:hover:bg-slate-100 flex items-center"
              >
                <i className="fa-regular fa-file-excel mr-2"></i>Xuất Excel
              </button>
            </div>

          </div>
        </div>
      )}
      <AdminAIChatbot />
    </div>
  );
}
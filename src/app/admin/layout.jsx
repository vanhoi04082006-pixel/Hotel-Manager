// src/app/admin/layout.jsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, collection, onSnapshot } from "firebase/firestore";
import "./admin.css";

const ADMIN_EMAIL = 'lunanewyear@gmail.com';

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  // States cho Top Header
  const [currentTime, setCurrentTime] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Đồng hồ thời gian thực & Phím tắt Ctrl+K
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

  // Kiểm tra quyền Admin
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const role = userDoc.exists() ? userDoc.data().role : null;
        
        if (user.email === ADMIN_EMAIL || role === "admin") {
          setAdminUser({
            name: userDoc.exists() ? userDoc.data().name : "Admin",
            email: user.email,
          });
          setIsAuthorized(true);
        } else {
          alert("Bạn không có quyền truy cập trang này!");
          router.push("/");
        }
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  // Đếm Booking Pending
  useEffect(() => {
    if (!isAuthorized) return;
    const unsubscribeBookings = onSnapshot(collection(db, "bookings"), (snap) => {
      const pending = snap.docs.filter(doc => doc.data().status === "pending").length;
      setPendingCount(pending);
    });
    return () => unsubscribeBookings();
  }, [isAuthorized]);

  const handleLogout = async () => {
    if (confirm("Bạn có chắc muốn đăng xuất?")) {
      await signOut(auth);
      localStorage.removeItem("currentUser");
      router.push("/login");
    }
  };

  const NavItem = ({ href, icon, text, badge }) => {
    const isActive = pathname === href || (href === "/admin" && pathname === "/admin");
    return (
      <Link href={href} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all relative ${isActive ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-700 hover:text-white"}`}>
        <i className={`fa-solid ${icon} w-6 text-center`}></i>
        <span className="font-medium ml-2 whitespace-nowrap">{text}</span>
        {badge > 0 && (
          <span className="absolute right-4 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{badge}</span>
        )}
      </Link>
    );
  };

  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  const pageTitle = pathname === "/admin" ? "Dashboard" : pathname.split('/').pop().replace('-', ' ');

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside id="sidebar" className={`${isSidebarOpen ? "w-72" : "w-[85px] sidebar-collapsed"} bg-gradient-to-b from-slate-900 to-slate-800 text-slate-300 flex flex-col border-r border-slate-700 flex-shrink-0 transition-all duration-300 z-50`}>
        <div className="sidebar-header h-20 flex items-center px-6 border-b border-slate-700 bg-slate-900/50 flex-shrink-0 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => window.open('/', '_blank')}>
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mr-3 shadow-lg flex-shrink-0">
            <i className="fa-solid fa-hotel text-white"></i>
          </div>
          <div className="sidebar-logo-text overflow-hidden">
            <h1 className="text-xl font-playfair font-bold text-white truncate">LUNA ADMIN</h1>
            <p className="text-xs text-slate-400 truncate">Xem website <i className="fa-solid fa-external-link-alt ml-1"></i></p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 custom-scroll">
          <p className="section-title text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-4"><span>Tổng quan</span></p>
          <nav className="space-y-1 mb-6">
            <NavItem href="/admin" icon="fa-chart-pie" text="Dashboard" />
            <NavItem href="/admin/bookings" icon="fa-calendar-check" text="Đặt phòng" badge={pendingCount} />
          </nav>

          <p className="section-title text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-4"><span>Quản lý</span></p>
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

          <p className="section-title text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-4"><span>Hệ thống</span></p>
          <nav className="space-y-1">
            <NavItem href="/admin/settings" icon="fa-gear" text="Cài đặt" />
            <NavItem href="/admin/backup" icon="fa-database" text="Sao lưu" />
            <NavItem href="/admin/logs" icon="fa-clock-rotate-left" text="Nhật ký" />
          </nav>
        </div>

        <div className="admin-footer p-4 border-t border-slate-700 bg-slate-900/50 flex-shrink-0 flex items-center">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0">
            {adminUser?.name?.charAt(0).toUpperCase() || "A"}
          </div>
          <div className="admin-info-text ml-3 flex-1 overflow-hidden">
            <p className="text-sm font-bold text-white truncate">{adminUser?.name}</p>
            <p className="text-xs text-slate-500 truncate">{adminUser?.email}</p>
          </div>
          <button onClick={handleLogout} className="logout-btn text-slate-400 hover:text-red-400 transition-colors p-2 hover:bg-slate-700 rounded-lg" title="Đăng xuất">
            <i className="fa-solid fa-right-from-bracket"></i>
          </button>
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
          
          {/* Thanh tìm kiếm toàn cục */}
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
              <div className="absolute right-3 top-2.5 text-xs bg-slate-100 px-2 py-1 rounded-md text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-start justify-center pt-20 p-4">
          <div className="absolute inset-0" onClick={() => setIsSearchOpen(false)}></div>
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col relative z-10 animate-in slide-in-from-bottom-4">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-playfair font-bold text-slate-900">Tìm kiếm toàn hệ thống</h3>
                <button onClick={() => setIsSearchOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-4 top-4 text-slate-400"></i>
                <input type="text" autoFocus className="w-full pl-11 pr-12 py-4 text-lg border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all bg-slate-50 focus:bg-white" placeholder="Tìm kiếm phòng, nhân viên, khách hàng, đặt phòng..." />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-6 bg-slate-50">
              <div className="text-center py-12 text-slate-500">
                <i className="fa-solid fa-magnifying-glass text-5xl mb-4 opacity-30"></i>
                <p className="text-lg">Nhập từ khóa để bắt đầu tìm kiếm</p>
                <p className="text-sm mt-2">Tìm kiếm theo mã phòng, tên nhân viên, email, số điện thoại...</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
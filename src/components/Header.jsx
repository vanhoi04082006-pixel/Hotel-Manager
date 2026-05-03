// src/components/Header.jsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase'; // Thêm db vào đây
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore'; // Import thêm hàm gọi Firestore

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [avatarSrc, setAvatarSrc] = useState(null);

    // Lắng nghe trạng thái đăng nhập từ Firebase
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const savedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                
                // Lấy ảnh từ Auth hoặc LocalStorage trước
                let photo = user.photoURL || savedUser.avatar || localStorage.getItem('userAvatar');

                setCurrentUser({
                    uid: user.uid,
                    email: user.email,
                    name: savedUser.name || user.displayName || user.email.split('@')[0]
                });

                // NẾU CHƯA CÓ ẢNH: Trực tiếp chọc vào DB (Firestore) để lấy ảnh mới nhất
                if (!photo) {
                    try {
                        const userDocRef = doc(db, "users", user.uid);
                        const userDocSnap = await getDoc(userDocRef);
                        
                        if (userDocSnap.exists() && userDocSnap.data().avatar) {
                            photo = userDocSnap.data().avatar;
                            
                            // Lưu ngược lại vào LocalStorage để lần sau load cho nhanh
                            localStorage.setItem('currentUser', JSON.stringify({
                                ...savedUser,
                                avatar: photo
                            }));
                        }
                    } catch (error) {
                        console.error("Lỗi lấy avatar từ Header:", error);
                    }
                }

                setAvatarSrc(photo || null);
            } else {
                setCurrentUser(null);
                setAvatarSrc(null);
            }
        });
        return () => unsubscribe();
    }, []);

    // Hàm xử lý Đăng xuất
    const handleLogout = async () => {
        if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
            try {
                await signOut(auth);
                localStorage.removeItem('currentUser');
                localStorage.removeItem('userAvatar');
                setCurrentUser(null);
                setAvatarSrc(null);
                setIsMobileMenuOpen(false);
                router.push('/');
            } catch (error) {
                alert("Lỗi đăng xuất: " + error.message);
            }
        }
    };

    const handleLinkClick = () => setIsMobileMenuOpen(false);

    const getMenuClass = (path) => {
        const isActive = pathname === path || pathname?.startsWith(path + '/');
        const isHomeActive = path === '/' && pathname === '/';
        const finalActive = path === '/' ? isHomeActive : isActive;

        return `text-[15px] whitespace-nowrap transition-colors ${finalActive
            ? 'font-semibold text-blue-600 relative after:content-[""] after:absolute after:-bottom-2 after:left-0 after:w-full after:h-0.5 after:bg-blue-600 after:rounded-full'
            : 'text-slate-500 font-medium hover:text-blue-600'
        }`;
    };

    const getMobileMenuClass = (path) => {
        const isActive = pathname === path || pathname?.startsWith(path + '/');
        const isHomeActive = path === '/' && pathname === '/';
        const finalActive = path === '/' ? isHomeActive : isActive;

        return `block w-full text-left px-4 py-3 rounded-xl font-medium transition-colors ${finalActive
            ? 'bg-blue-50 text-blue-600 font-semibold'
            : 'hover:bg-slate-50 text-slate-600'
        }`;
    };

    return (
        <>
            <header className="h-20 bg-white/80 backdrop-blur-lg border-b border-slate-100 flex items-center justify-between px-4 md:px-8 lg:px-12 sticky top-0 z-50 shadow-sm transition-all relative">
                {/* Logo */}
                <Link href="/" className="flex items-center cursor-pointer group flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mr-3 shadow-md shadow-blue-600/20 group-hover:scale-105 transition-transform">
                        <i className="fa-solid fa-hotel text-white text-lg"></i>
                    </div>
                    <div><h1 className="text-xl md:text-2xl font-playfair font-bold text-slate-900">LUNA</h1></div>
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden lg:flex items-center space-x-5 xl:space-x-8 flex-1 justify-center">
                    <Link href="/" className={getMenuClass('/')}>Trang chủ</Link>
                    <Link href="/rooms" className={getMenuClass('/rooms')}>Phòng & Suite</Link>
                    <Link href="/services" className={getMenuClass('/services')}>Dịch vụ</Link>
                    <Link href="/booking-lookup" className={getMenuClass('/booking-lookup')}>
                        <i className="fa-solid fa-magnifying-glass mr-2 text-sm"></i>Tra cứu
                    </Link>
                    {currentUser && (
                        <Link href="/my-bookings" className={getMenuClass('/my-bookings')}>Đặt phòng của tôi</Link>
                    )}
                </nav>

                {/* User Actions (Desktop) */}
                <div className="hidden lg:flex items-center justify-end space-x-5 flex-shrink-0">
                    {currentUser ? (
                        <div className="flex items-center space-x-5">
                            {/* Avatar Link */}
                            <Link href="/profile" className="flex items-center space-x-3 hover:opacity-80 transition-opacity bg-slate-50 border border-slate-100 pl-2 pr-4 py-1.5 rounded-full">
                                <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold overflow-hidden shadow-inner">
                                    {avatarSrc ? (
                                        <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <span>{currentUser.name.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>
                                <span className="text-[14px] font-bold text-slate-700 max-w-[120px] truncate">
                                    {currentUser.name}
                                </span>
                            </Link>
                            <button onClick={handleLogout} className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Đăng xuất">
                                <i className="fa-solid fa-power-off"></i>
                            </button>
                        </div>
                    ) : (
                        <Link href="/login" className="bg-slate-900 text-white px-6 py-2.5 rounded-full text-[15px] font-semibold hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-600/30 transition-all duration-300">
                            Đăng nhập
                        </Link>
                    )}
                </div>

                {/* Mobile Menu Button */}
                <button className="lg:hidden p-2 text-slate-600 hover:text-blue-600 transition-colors ml-auto" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                    <i className={`fa-solid ${isMobileMenuOpen ? 'fa-xmark' : 'fa-bars'} text-2xl`}></i>
                </button>
            </header>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="lg:hidden bg-white border-b border-slate-100 p-4 shadow-lg absolute w-full z-40 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="space-y-1">
                        <Link href="/" className={getMobileMenuClass('/')} onClick={handleLinkClick}>Trang chủ</Link>
                        <Link href="/rooms" className={getMobileMenuClass('/rooms')} onClick={handleLinkClick}>Phòng & Suite</Link>
                        <Link href="/services" className={getMobileMenuClass('/services')} onClick={handleLinkClick}>Dịch vụ</Link>
                        <Link href="/booking-lookup" className={getMobileMenuClass('/booking-lookup')} onClick={handleLinkClick}><i className="fa-solid fa-magnifying-glass mr-2"></i>Tra cứu</Link>

                        {currentUser && (
                            <>
                                <div className="h-px bg-slate-100 my-2"></div>
                                <Link href="/my-bookings" className={getMobileMenuClass('/my-bookings')} onClick={handleLinkClick}><i className="fa-solid fa-bed mr-2"></i> Đặt phòng của tôi</Link>
                                <Link href="/profile" className={getMobileMenuClass('/profile')} onClick={handleLinkClick}><i className="fa-solid fa-user-circle mr-2"></i> Tài khoản & Ưu đãi</Link>
                                <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors flex items-center">
                                    <i className="fa-solid fa-power-off mr-2"></i>Đăng xuất
                                </button>
                            </>
                        )}
                        {!currentUser && (
                            <div className="pt-2">
                                <Link href="/login" className="block w-full text-center px-4 py-3 bg-slate-900 text-white hover:bg-blue-600 rounded-xl font-medium transition-colors" onClick={handleLinkClick}>
                                    Đăng nhập
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
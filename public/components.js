// public/components.js

// Truyền vào 'activePage' để biết thẻ nào đang được chọn (ví dụ: 'home', 'rooms', 'offers'...)
export function loadHeader(activePage = '') {
    const headerHTML = `
        <header class="h-20 bg-white/80 backdrop-blur-lg border-b border-slate-100 flex items-center justify-between px-4 md:px-8 lg:px-12 sticky top-0 z-50 shadow-sm transition-all relative">
            <div class="flex items-center cursor-pointer group" onclick="window.location.href='/index.html'">
                <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mr-3 shadow-md shadow-blue-600/20 group-hover:scale-105 transition-transform">
                    <i class="fa-solid fa-hotel text-white text-lg"></i>
                </div>
                <div>
                    <h1 class="text-xl md:text-2xl font-playfair font-bold text-slate-900">LUNA</h1>
                </div>
            </div>

            <nav class="hidden md:flex items-center space-x-8 lg:space-x-10">
                <a href="/index.html" class="text-[15px] ${activePage === 'home' ? 'font-semibold text-blue-600 relative after:content-[\'\'] after:absolute after:-bottom-2 after:left-0 after:w-full after:h-0.5 after:bg-blue-600 after:rounded-full' : 'text-slate-500 font-medium hover:text-blue-600 transition-colors'}">Trang chủ</a>
                <a href="/pages/rooms.html" class="text-[15px] ${activePage === 'rooms' ? 'font-semibold text-blue-600 relative after:content-[\'\'] after:absolute after:-bottom-2 after:left-0 after:w-full after:h-0.5 after:bg-blue-600 after:rounded-full' : 'text-slate-500 font-medium hover:text-blue-600 transition-colors'}">Phòng & Suite</a>
                <a href="/pages/services.html" class="text-[15px] ${activePage === 'services' ? 'font-semibold text-blue-600 relative after:content-[\'\'] after:absolute after:-bottom-2 after:left-0 after:w-full after:h-0.5 after:bg-blue-600 after:rounded-full' : 'text-slate-500 font-medium hover:text-blue-600 transition-colors'}">Dịch vụ</a>
                <a href="/pages/booking-lookup.html" class="text-[15px] ${activePage === 'lookup' ? 'font-semibold text-blue-600 relative after:content-[\'\'] after:absolute after:-bottom-2 after:left-0 after:w-full after:h-0.5 after:bg-blue-600 after:rounded-full' : 'text-slate-500 font-medium hover:text-blue-600 transition-colors'}"><i class="fa-solid fa-magnifying-glass mr-2 text-sm"></i>Tra cứu</a>
                
                <a id="nav-my-bookings" href="/pages/my-bookings.html" class="text-[15px] ${activePage === 'my-bookings' ? 'font-semibold text-blue-600 relative after:content-[\'\'] after:absolute after:-bottom-2 after:left-0 after:w-full after:h-0.5 after:bg-blue-600 after:rounded-full' : 'text-slate-500 font-medium hover:text-blue-600 transition-colors'} hidden">Đặt phòng</a>
                <a id="nav-profile" href="/pages/profile.html" class="text-[15px] ${activePage === 'profile' ? 'font-semibold text-blue-600 relative after:content-[\'\'] after:absolute after:-bottom-2 after:left-0 after:w-full after:h-0.5 after:bg-blue-600 after:rounded-full' : 'text-slate-500 font-medium hover:text-blue-600 transition-colors'} hidden">Hồ sơ</a>
                <a id="nav-loyalty" href="/pages/loyalty.html" class="text-[15px] ${activePage === 'loyalty' ? 'font-semibold text-blue-600 relative after:content-[\'\'] after:absolute after:-bottom-2 after:left-0 after:w-full after:h-0.5 after:bg-blue-600 after:rounded-full' : 'text-slate-500 font-medium hover:text-blue-600 transition-colors'} hidden">Thành viên</a>
                <a id="nav-offers" href="/pages/offers.html" class="text-[15px] ${activePage === 'offers' ? 'font-semibold text-blue-600 relative after:content-[\'\'] after:absolute after:-bottom-2 after:left-0 after:w-full after:h-0.5 after:bg-blue-600 after:rounded-full' : 'text-slate-500 font-medium hover:text-blue-600 transition-colors'} hidden">Ưu đãi</a>
            </nav>

            <button class="md:hidden p-2 text-slate-600" onclick="toggleMobileMenu()"><i class="fa-solid fa-bars text-2xl"></i></button>

            <div class="hidden md:flex items-center space-x-5">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold">
                        <span id="user-avatar">K</span>
                    </div>
                    <span class="text-[15px] font-medium text-slate-700" id="user-name-display">Khách</span>
                </div>
                <a href="/login.html" id="loginButton" class="bg-slate-900 text-white px-6 py-2.5 rounded-full text-[15px] font-semibold hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-600/30 transition-all duration-300">Đăng nhập</a>
                <button onclick="handleLogout()" id="logoutButton" class="text-slate-500 hover:text-red-600 text-[15px] font-medium transition-colors hidden"><i class="fa-solid fa-right-from-bracket mr-2"></i>Đăng xuất</button>
            </div>
        </header>

        <div id="mobile-menu" class="hidden md:hidden bg-white border-b border-slate-100 p-4 shadow-lg absolute w-full z-40">
            <div class="space-y-1">
                <a href="/index.html" class="block w-full text-left px-4 py-3 ${activePage === 'home' ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-50 text-slate-600'} rounded-xl font-medium">Trang chủ</a>
                <a href="/pages/rooms.html" class="block w-full text-left px-4 py-3 ${activePage === 'rooms' ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-50 text-slate-600'} rounded-xl font-medium">Phòng & Suite</a>
                <a href="/pages/services.html" class="block w-full text-left px-4 py-3 ${activePage === 'services' ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-50 text-slate-600'} rounded-xl font-medium">Dịch vụ</a>
                <a href="/pages/booking-lookup.html" class="block w-full text-left px-4 py-3 ${activePage === 'lookup' ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-50 text-slate-600'} rounded-xl font-medium"><i class="fa-solid fa-magnifying-glass mr-2"></i>Tra cứu</a>
                <a id="mobile-my-bookings" href="/pages/my-bookings.html" class="block w-full text-left px-4 py-3 ${activePage === 'my-bookings' ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-50 text-slate-600'} rounded-xl font-medium hidden">Đặt phòng của tôi</a>
                <a id="mobile-profile" href="/pages/profile.html" class="block w-full text-left px-4 py-3 ${activePage === 'profile' ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-50 text-slate-600'} rounded-xl font-medium hidden">Hồ sơ</a>
                <a id="mobile-loyalty" href="/pages/loyalty.html" class="block w-full text-left px-4 py-3 ${activePage === 'loyalty' ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-50 text-slate-600'} rounded-xl font-medium hidden">Thẻ thành viên</a>
                <a id="mobile-offers" href="/pages/offers.html" class="block w-full text-left px-4 py-3 ${activePage === 'offers' ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-50 text-slate-600'} rounded-xl font-medium hidden">Ưu đãi</a>
                <div class="border-t border-slate-100 my-2 pt-2">
                    <button onclick="handleLogout()" id="mobileLogoutBtn" class="hidden w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl font-medium"><i class="fa-solid fa-right-from-bracket mr-2"></i>Đăng xuất</button>
                </div>
            </div>
        </div>
    `;
    const container = document.getElementById('app-header');
    if (container) container.innerHTML = headerHTML;
}

export function loadFooter() {
    const footerHTML = `
        <footer class="bg-slate-900 border-t border-slate-800 py-16 relative z-10">
            <div class="max-w-7xl mx-auto px-4 md:px-8">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-12">
                    <div class="col-span-1 md:col-span-1">
                        <div class="flex items-center mb-6">
                            <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-blue-600/20">
                                <i class="fa-solid fa-hotel text-white text-lg"></i>
                            </div>
                            <h3 class="text-2xl font-playfair font-bold text-white">LUNA</h3>
                        </div>
                        <p class="text-slate-400 text-[15px] leading-relaxed mb-6">Trải nghiệm đẳng cấp thế giới, nơi mỗi khoảnh khắc đều được trân trọng và tỏa sáng.</p>
                        <div class="flex space-x-3">
                            <a href="#" class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all"><i class="fa-brands fa-facebook-f"></i></a>
                            <a href="#" class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all"><i class="fa-brands fa-instagram"></i></a>
                            <a href="#" class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all"><i class="fa-brands fa-twitter"></i></a>
                        </div>
                    </div>
                    <div>
                        <h4 class="text-white font-bold text-[15px] uppercase tracking-wider mb-6">Liên hệ</h4>
                        <ul class="space-y-4 text-[15px] text-slate-400">
                            <li class="flex items-start"><i class="fa-solid fa-location-dot mt-1 text-blue-500 mr-3 w-4"></i> 123 Nguyễn Huệ, Q.1,<br>TP. Hồ Chí Minh</li>
                            <li class="flex items-center"><i class="fa-solid fa-phone text-blue-500 mr-3 w-4"></i> +84 28 1234 5678</li>
                            <li class="flex items-center"><i class="fa-solid fa-envelope text-blue-500 mr-3 w-4"></i> hello@lunahotel.com</li>
                        </ul>
                    </div>
                    <div>
                        <h4 class="text-white font-bold text-[15px] uppercase tracking-wider mb-6">Khám phá</h4>
                        <ul class="space-y-3 text-[15px] text-slate-400">
                            <li><a href="#" class="hover:text-blue-400 transition-colors">Về chúng tôi</a></li>
                            <li><a href="#" class="hover:text-blue-400 transition-colors">Nhà hàng & Bar</a></li>
                            <li><a href="#" class="hover:text-blue-400 transition-colors">Spa & Thư giãn</a></li>
                            <li><a href="#" class="hover:text-blue-400 transition-colors">Đánh giá khách hàng</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 class="text-white font-bold text-[15px] uppercase tracking-wider mb-6">Bản tin</h4>
                        <p class="text-slate-400 text-[15px] mb-4">Đăng ký để nhận ưu đãi đặc quyền lên tới 30%.</p>
                        <div class="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 focus-within:border-blue-500/50 transition-colors">
                            <input type="email" placeholder="Email của bạn" class="bg-transparent text-white placeholder-slate-500 px-4 py-2 w-full text-[15px] focus:outline-none">
                            <button class="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all font-medium whitespace-nowrap">Gửi</button>
                        </div>
                    </div>
                </div>
                <div class="border-t border-slate-800 mt-16 pt-8 text-center text-sm text-slate-500 font-medium">
                    <p>&copy; 2026 LUNA HOTEL. ALL RIGHTS RESERVED.</p>
                </div>
            </div>
        </footer>
    `;
    const container = document.getElementById('app-footer');
    if (container) container.innerHTML = footerHTML;
}
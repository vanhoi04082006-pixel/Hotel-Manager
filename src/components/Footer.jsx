// src/components/Footer.jsx
export default function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800 py-16 relative z-10">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          
          {/* Cột Logo & Giới thiệu */}
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-blue-600/20">
                <i className="fa-solid fa-hotel text-white text-lg"></i>
              </div>
              <h3 className="text-2xl font-playfair font-bold text-white">LUNA</h3>
            </div>
            <p className="text-slate-400 text-[15px] leading-relaxed mb-6">
              Trải nghiệm đẳng cấp thế giới, nơi mỗi khoảnh khắc đều được trân trọng và tỏa sáng.
            </p>
            <div className="flex space-x-3">
              <a href="#" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all">
                <i className="fa-brands fa-facebook-f"></i>
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all">
                <i className="fa-brands fa-instagram"></i>
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all">
                <i className="fa-brands fa-twitter"></i>
              </a>
            </div>
          </div>

          {/* Cột Liên hệ */}
          <div>
            <h4 className="text-white font-bold text-[15px] uppercase tracking-wider mb-6">Liên hệ</h4>
            <ul className="space-y-4 text-[15px] text-slate-400">
              <li className="flex items-start">
                <i className="fa-solid fa-location-dot mt-1 text-blue-500 mr-3 w-4"></i> 
                123 Nguyễn Huệ, Q.1,<br />TP. Hồ Chí Minh
              </li>
              <li className="flex items-center">
                <i className="fa-solid fa-phone text-blue-500 mr-3 w-4"></i> +84 28 1234 5678
              </li>
              <li className="flex items-center">
                <i className="fa-solid fa-envelope text-blue-500 mr-3 w-4"></i> hello@lunahotel.com
              </li>
            </ul>
          </div>

          {/* Cột Khám phá */}
          <div>
            <h4 className="text-white font-bold text-[15px] uppercase tracking-wider mb-6">Khám phá</h4>
            <ul className="space-y-3 text-[15px] text-slate-400">
              <li><a href="#" className="hover:text-blue-400 transition-colors">Về chúng tôi</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Nhà hàng & Bar</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Spa & Thư giãn</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Đánh giá khách hàng</a></li>
            </ul>
          </div>

          {/* Cột Bản tin */}
          <div>
            <h4 className="text-white font-bold text-[15px] uppercase tracking-wider mb-6">Bản tin</h4>
            <p className="text-slate-400 text-[15px] mb-4">Đăng ký để nhận ưu đãi đặc quyền lên tới 30%.</p>
            <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 focus-within:border-blue-500/50 transition-colors">
              <input 
                type="email" 
                placeholder="Email của bạn" 
                className="bg-transparent text-white placeholder-slate-500 px-4 py-2 w-full text-[15px] focus:outline-none" 
              />
              <button className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all font-medium whitespace-nowrap">
                Gửi
              </button>
            </div>
          </div>

        </div>

        {/* Footer Bottom */}
        <div className="border-t border-slate-800 mt-16 pt-8 text-center text-sm text-slate-500 font-medium">
          <p>&copy; 2026 LUNA HOTEL. ALL RIGHTS RESERVED.</p>
        </div>
        
      </div>
    </footer>
  );
}
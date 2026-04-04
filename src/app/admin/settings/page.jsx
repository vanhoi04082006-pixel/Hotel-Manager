// src/app/admin/settings/page.jsx
"use client";

import { useState, useEffect } from "react";

export default function AdminSettings() {
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState({
        hotelName: "Luna Hotel & Resort",
        hotelStars: "5",
        contactEmail: "info@lunahotel.com",
        contactPhone: "+84 28 1234 5678",
        hotelAddress: "123 Nguyễn Huệ, Quận 1, TP.HCM",
        defaultCheckIn: "14:00",
        defaultCheckOut: "12:00",
        serviceFee: "10",
        vatRate: "8",
        currency: "VND",
        paymentCash: true,
        paymentBank: true,
        paymentCredit: true,
        paymentWallet: false,
        notifyEmail: true,
        adminEmail: "admin@lunahotel.com",
    });

    useEffect(() => {
        const savedSettings = JSON.parse(localStorage.getItem("hotelSettings") || "{}");
        if (Object.keys(savedSettings).length > 0) {
            setSettings((prev) => ({ ...prev, ...savedSettings }));
        }
        setTimeout(() => setLoading(false), 400); // Fake delay for smooth animation
    }, []);

    const handleInputChange = (e) => {
        const { id, value, type, checked } = e.target;
        setSettings((prev) => ({
            ...prev,
            [id]: type === "checkbox" ? checked : value,
        }));
    };

    const handleSave = (e) => {
        e.preventDefault();
        setIsSaving(true);
        setTimeout(() => {
            localStorage.setItem("hotelSettings", JSON.stringify(settings));
            alert("Đã lưu cài đặt hệ thống thành công!");
            setIsSaving(false);
        }, 800);
    };

    const handleReset = () => {
        if (confirm("Khôi phục toàn bộ cài đặt về mặc định ban đầu?")) {
            localStorage.removeItem("hotelSettings");
            window.location.reload();
        }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;

    const ToggleSwitch = ({ id, checked, label, icon, color }) => (
        <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors group">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-${color}-50 text-${color}-600 flex items-center justify-center text-lg shadow-sm group-hover:scale-110 transition-transform`}><i className={`fa-solid ${icon}`}></i></div>
                <span className="font-bold text-slate-700 text-[13px]">{label}</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id={id} checked={checked} onChange={handleInputChange} className="sr-only peer" />
                <div className="w-12 h-7 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white shadow-inner"></div>
            </label>
        </div>
    );

    return (
        <div className="fade-in max-w-[1600px] mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Header */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 md:p-8 border border-slate-200/60 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-playfair font-bold text-slate-800 flex items-center gap-3">
                        <i className="fa-solid fa-gears text-indigo-600"></i> Cấu hình Hệ thống
                    </h2>
                    <p className="text-sm text-slate-500 mt-2">Tùy chỉnh thông tin thương hiệu, thanh toán và quy tắc vận hành của khách sạn.</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button type="button" onClick={handleReset} className="flex-1 md:flex-none px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 hover:text-rose-600 transition-all shadow-sm">
                        <i className="fa-solid fa-rotate-left mr-2"></i>Reset
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="flex-1 md:flex-none px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all disabled:opacity-70 flex items-center justify-center">
                        {isSaving ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Đang lưu...</> : <><i className="fa-solid fa-floppy-disk mr-2"></i>Lưu Cấu Hình</>}
                    </button>
                </div>
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* Cột trái: Thông tin Cơ bản (Trải rộng 2 cột trên PC) */}
                <div className="xl:col-span-2 space-y-8">

                    {/* Card 1: Thông tin thương hiệu */}
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500"></div>
                        <h4 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center"><i className="fa-solid fa-hotel"></i></div>Định danh Thương hiệu</h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">Tên Khách sạn / Resort</label>
                                <div className="relative">
                                    <i className="fa-solid fa-signature absolute left-4 top-3.5 text-slate-400"></i>
                                    <input type="text" id="hotelName" value={settings.hotelName} onChange={handleInputChange} className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-bold text-slate-800 outline-none" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">Tiêu chuẩn (Số sao)</label>
                                <div className="relative">
                                    <i className="fa-solid fa-star absolute left-4 top-3.5 text-amber-400"></i>
                                    <select id="hotelStars" value={settings.hotelStars} onChange={handleInputChange} className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-100 focus:border-amber-400 transition-all font-bold text-slate-800 outline-none cursor-pointer appearance-none">
                                        <option value="5">⭐⭐⭐⭐⭐ (5 Sao Cao cấp)</option>
                                        <option value="4">⭐⭐⭐⭐ (4 Sao Tiêu chuẩn)</option>
                                        <option value="3">⭐⭐⭐ (3 Sao Cơ bản)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">Email CSKH</label>
                                <div className="relative">
                                    <i className="fa-solid fa-envelope absolute left-4 top-3.5 text-slate-400"></i>
                                    <input type="email" id="contactEmail" value={settings.contactEmail} onChange={handleInputChange} className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-medium text-slate-800 outline-none" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">Hotline Đặt phòng</label>
                                <div className="relative">
                                    <i className="fa-solid fa-phone absolute left-4 top-3.5 text-slate-400"></i>
                                    <input type="tel" id="contactPhone" value={settings.contactPhone} onChange={handleInputChange} className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-medium text-slate-800 outline-none" />
                                </div>
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">Địa chỉ Trụ sở</label>
                                <div className="relative">
                                    <i className="fa-solid fa-map-location-dot absolute left-4 top-3.5 text-slate-400"></i>
                                    <input type="text" id="hotelAddress" value={settings.hotelAddress} onChange={handleInputChange} className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-medium text-slate-800 outline-none" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Cài đặt Thanh toán */}
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                        <h4 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center"><i className="fa-solid fa-credit-card"></i></div>Cổng & Phương thức Thanh toán</h4>

                        <div className="mb-8">
                            <label className="text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">Đơn vị tiền tệ chính</label>
                            <div className="flex gap-4">
                                <label className={`flex-1 relative p-4 rounded-2xl border-2 cursor-pointer transition-all ${settings.currency === 'VND' ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-100 hover:border-slate-300'}`}>
                                    <input type="radio" id="currency" value="VND" checked={settings.currency === 'VND'} onChange={handleInputChange} className="hidden" />
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${settings.currency === 'VND' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>₫</div>
                                            <span className="font-bold text-slate-800">Việt Nam Đồng (VND)</span>
                                        </div>
                                        {settings.currency === 'VND' && <i className="fa-solid fa-circle-check text-emerald-500 text-xl"></i>}
                                    </div>
                                </label>
                                <label className={`flex-1 relative p-4 rounded-2xl border-2 cursor-pointer transition-all ${settings.currency === 'USD' ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-100 hover:border-slate-300'}`}>
                                    <input type="radio" id="currency" value="USD" checked={settings.currency === 'USD'} onChange={handleInputChange} className="hidden" />
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${settings.currency === 'USD' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>$</div>
                                            <span className="font-bold text-slate-800">Đô la Mỹ (USD)</span>
                                        </div>
                                        {settings.currency === 'USD' && <i className="fa-solid fa-circle-check text-emerald-500 text-xl"></i>}
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[13px] font-bold text-slate-500 uppercase tracking-widest block">Kênh chấp nhận thanh toán</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <ToggleSwitch id="paymentCash" checked={settings.paymentCash} label="Tiền mặt tại Quầy" icon="fa-money-bill-wave" color="emerald" />
                                <ToggleSwitch id="paymentBank" checked={settings.paymentBank} label="Chuyển khoản Ngân hàng" icon="fa-building-columns" color="blue" />
                                <ToggleSwitch id="paymentCredit" checked={settings.paymentCredit} label="Thẻ tín dụng (Visa/Master)" icon="fa-cc-visa" color="purple" />
                                <ToggleSwitch id="paymentWallet" checked={settings.paymentWallet} label="Ví điện tử (Momo, ZaloPay)" icon="fa-wallet" color="pink" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Cột phải: Vận hành & Hệ thống */}
                <div className="space-y-8">

                    {/* Card 3: Quy tắc Đặt phòng */}
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                        <h4 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center"><i className="fa-solid fa-clock"></i></div>Quy định Vận hành</h4>

                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="flex-1 space-y-2">
                                    <label className="text-[12px] font-bold text-slate-500 uppercase tracking-widest">Giờ Check-in</label>
                                    <div className="relative">
                                        <input type="time" id="defaultCheckIn" value={settings.defaultCheckIn} onChange={handleInputChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-100 focus:border-amber-400 transition-all font-bold text-slate-800 outline-none text-center" />
                                    </div>
                                </div>
                                <div className="flex items-center pt-6 text-slate-300"><i className="fa-solid fa-arrow-right-long"></i></div>
                                <div className="flex-1 space-y-2">
                                    <label className="text-[12px] font-bold text-slate-500 uppercase tracking-widest">Giờ Check-out</label>
                                    <div className="relative">
                                        <input type="time" id="defaultCheckOut" value={settings.defaultCheckOut} onChange={handleInputChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-100 focus:border-amber-400 transition-all font-bold text-slate-800 outline-none text-center" />
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-700 text-sm">Phí Dịch Vụ Cố Định</span>
                                    <div className="relative w-24">
                                        <input type="number" id="serviceFee" value={settings.serviceFee} onChange={handleInputChange} className="w-full p-2 pr-8 bg-white border border-amber-200 rounded-lg text-right font-bold text-amber-600 outline-none" />
                                        <span className="absolute right-3 top-2.5 text-xs font-bold text-amber-500">%</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-700 text-sm">Thuế GTGT (VAT)</span>
                                    <div className="relative w-24">
                                        <input type="number" id="vatRate" value={settings.vatRate} onChange={handleInputChange} className="w-full p-2 pr-8 bg-white border border-amber-200 rounded-lg text-right font-bold text-amber-600 outline-none" />
                                        <span className="absolute right-3 top-2.5 text-xs font-bold text-amber-500">%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Card 4: Thông báo */}
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                        <h4 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center"><i className="fa-solid fa-bell"></i></div>Notification Hub</h4>

                        <div className="space-y-5">
                            <ToggleSwitch id="notifyEmail" checked={settings.notifyEmail} label="Báo đơn hàng mới qua Email" icon="fa-envelope-open-text" color="purple" />

                            <div className={`transition-all duration-500 overflow-hidden ${settings.notifyEmail ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
                                <label className="text-[12px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Email nhận thông báo hệ thống</label>
                                <div className="relative">
                                    <i className="fa-solid fa-at absolute left-4 top-3.5 text-purple-400"></i>
                                    <input type="email" id="adminEmail" value={settings.adminEmail} onChange={handleInputChange} className="w-full pl-11 pr-4 py-3 bg-purple-50/30 border border-purple-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all font-bold text-purple-900 outline-none" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Card 5: Danger Zone */}
                    <div className="bg-rose-50/50 rounded-[2rem] p-8 border border-rose-100">
                        <h4 className="text-lg font-bold text-rose-700 mb-2 flex items-center gap-2"><i className="fa-solid fa-triangle-exclamation"></i> Khu vực Nguy hiểm</h4>
                        <p className="text-xs text-rose-600/80 mb-5 leading-relaxed">Khôi phục cài đặt sẽ xóa mọi tùy chỉnh hiện tại và đưa hệ thống về trạng thái mặc định ban đầu.</p>
                        <button type="button" onClick={handleReset} className="w-full py-3 bg-white text-rose-600 border border-rose-200 rounded-xl font-bold hover:bg-rose-600 hover:text-white transition-all shadow-sm">
                            Khôi phục Mặc định
                        </button>
                    </div>

                </div>
            </form>
        </div>
    );
}
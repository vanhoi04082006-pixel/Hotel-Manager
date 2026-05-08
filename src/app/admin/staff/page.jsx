// src/app/admin/staff/page.jsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, Timestamp } from "firebase/firestore";

const formatCurrency = (amount) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount || 0);

const initialFormState = {
    id: "",
    name: "",
    email: "",
    phone: "",
    position: "receptionist",
    department: "frontdesk",
    startDate: "",
    salary: "",
    notes: "",
    status: "active",
};

const POSITION_LABELS = {
    manager: "Quản lý",
    receptionist: "Lễ tân",
    housekeeping: "Buồng phòng",
    chef: "Đầu bếp",
    security: "Bảo vệ"
};

const DEPARTMENT_LABELS = {
    frontdesk: "Lễ tân",
    housekeeping: "Buồng phòng",
    kitchen: "Bếp",
    security: "An ninh",
    management: "Quản lý"
};

export default function AdminStaff() {
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);

    // States Tìm kiếm & Lọc
    const [searchQuery, setSearchQuery] = useState("");
    const [deptFilter, setDeptFilter] = useState("all");

    // States Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [isSaving, setIsSaving] = useState(false);

    // 1. Lấy dữ liệu Real-time
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "staff"), (snap) => {
            const loadedStaff = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            setStaffList(loadedStaff);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. Lọc và Tìm kiếm nhân viên
    const filteredStaff = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return staffList.filter((s) => {
            const matchSearch =
                (s.name || "").toLowerCase().includes(query) ||
                (s.email || "").toLowerCase().includes(query) ||
                (s.phone || "").toLowerCase().includes(query);
            const matchDept = deptFilter === "all" || s.department === deptFilter;
            return matchSearch && matchDept;
        }).sort((a, b) => {
            // Ưu tiên hiển thị Quản lý lên đầu, sau đó theo trạng thái
            if (a.position === 'manager' && b.position !== 'manager') return -1;
            if (a.position !== 'manager' && b.position === 'manager') return 1;
            if (a.status === 'active' && b.status !== 'active') return -1;
            if (a.status !== 'active' && b.status === 'active') return 1;
            return 0;
        });
    }, [staffList, searchQuery, deptFilter]);

    // 3. Xử lý Form Modal
    const openModal = (staff = null) => {
        if (staff) {
            setFormData({
                id: staff.id,
                name: staff.name || "",
                email: staff.email || "",
                phone: staff.phone || "",
                position: staff.position || "receptionist",
                department: staff.department || "frontdesk",
                startDate: staff.startDate || "",
                salary: staff.salary || "",
                notes: staff.notes || "",
                status: staff.status || "active",
            });
        } else {
            setFormData(initialFormState);
        }
        setIsModalOpen(true);
    };

    const handleSaveStaff = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const staffData = {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            position: formData.position,
            department: formData.department,
            startDate: formData.startDate,
            salary: parseInt(formData.salary) || 0,
            notes: formData.notes,
            status: formData.status,
            updatedAt: Timestamp.now(),
        };

        try {
            if (formData.id) {
                await updateDoc(doc(db, "staff", formData.id), staffData);
                alert("Cập nhật nhân viên thành công!");
            } else {
                await addDoc(collection(db, "staff"), {
                    ...staffData,
                    status: "active",
                    createdAt: Timestamp.now(),
                });
                alert("Thêm nhân viên mới thành công!");
            }
            setIsModalOpen(false);
        } catch (error) {
            alert("Lỗi lưu nhân viên: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteStaff = async (id, name) => {
        if (confirm(`Bạn có chắc chắn muốn xóa nhân viên "${name}" khỏi hệ thống?`)) {
            try {
                await deleteDoc(doc(db, "staff", id));
            } catch (error) {
                alert("Lỗi xóa nhân viên: " + error.message);
            }
        }
    };

    const toggleStaffStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === "active" ? "inactive" : "active";
        const actionName = newStatus === "active" ? "Khôi phục trạng thái làm việc" : "Đánh dấu đã nghỉ việc";

        if (confirm(`Bạn muốn ${actionName} cho nhân viên này?`)) {
            try {
                await updateDoc(doc(db, "staff", id), { status: newStatus, updatedAt: Timestamp.now() });
            } catch (error) {
                alert("Lỗi cập nhật trạng thái: " + error.message);
            }
        }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    const formInputClass = "w-full p-2.5 md:p-3 text-sm md:text-base bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all";

    return (
        <div className="fade-in pb-12 max-w-[1600px] mx-auto w-full">

            {/* Header & Thanh Công Cụ */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl md:rounded-3xl p-4 md:p-5 border border-slate-200 shadow-sm mb-6 md:mb-8 flex flex-col xl:flex-row gap-4 md:gap-5 items-start xl:items-center justify-between transition-all w-full">
                <div className="w-full xl:w-auto flex justify-between items-center">
                    <div>
                        <h3 className="text-xl md:text-2xl font-playfair font-bold text-slate-800 flex items-center flex-wrap gap-2">
                            Đội ngũ nhân sự
                            <span className="bg-blue-100 text-blue-600 text-xs md:text-sm font-sans px-2.5 md:px-3 py-0.5 md:py-1 rounded-full font-bold shadow-sm whitespace-nowrap mt-1 md:mt-0">
                                {filteredStaff.length} / {staffList.length}
                            </span>
                        </h3>
                        <p className="text-xs md:text-sm text-slate-500 mt-1">Quản lý hồ sơ, phòng ban và chức vụ của nhân viên</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full xl:w-auto">
                    <div className="relative w-full sm:w-56 md:w-64 flex-shrink-0">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-3.5 md:top-3 text-slate-400"></i>
                        <input
                            type="text"
                            placeholder="Tìm tên, email, sđt..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-2 md:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                        />
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto hide-scrollbar">
                        <button onClick={() => setDeptFilter("all")} className={`flex-1 sm:flex-none px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 ${deptFilter === "all" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Tất cả</button>
                        <button onClick={() => setDeptFilter("frontdesk")} className={`flex-1 sm:flex-none px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 ${deptFilter === "frontdesk" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-blue-600"}`}>Lễ tân</button>
                        <button onClick={() => setDeptFilter("housekeeping")} className={`flex-1 sm:flex-none px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 ${deptFilter === "housekeeping" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-emerald-600"}`}>Buồng phòng</button>
                        <button onClick={() => setDeptFilter("management")} className={`flex-1 sm:flex-none px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 ${deptFilter === "management" ? "bg-white text-purple-600 shadow-sm" : "text-slate-500 hover:text-purple-600"}`}>Quản lý</button>
                    </div>

                    <button onClick={() => openModal()} className="w-full sm:w-auto justify-center bg-slate-900 text-white rounded-xl px-4 md:px-5 py-2.5 shadow-lg hover:bg-blue-600 flex-shrink-0 whitespace-nowrap transition-all flex items-center text-sm md:text-base font-bold">
                        <i className="fa-solid fa-user-plus mr-2"></i>Thêm nhân sự
                    </button>
                </div>
            </div>

            {/* Lưới Thẻ Nhân viên */}
            {filteredStaff.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {filteredStaff.map((s, index) => {
                        const isActive = s.status === "active";
                        const positionLabel = POSITION_LABELS[s.position] || s.position;
                        const departmentLabel = DEPARTMENT_LABELS[s.department] || s.department;

                        return (
                            <div key={s.id} className={`bg-white rounded-2xl md:rounded-[2rem] border border-slate-200 overflow-hidden flex flex-col h-full relative group transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${!isActive ? "opacity-75 grayscale-[30%]" : ""}`} style={{ animationDelay: `${(index % 10) * 0.05}s` }}>

                                {/* Viền màu trạng thái trên cùng */}
                                <div className={`absolute top-0 right-0 left-0 h-1.5 z-10 ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></div>

                                <div className="p-4 md:p-6 flex-1 flex flex-col">
                                    {/* Avatar & Tên */}
                                    <div className="flex items-start justify-between mb-4 md:mb-5 mt-1 md:mt-2">
                                        <div className="flex items-center min-w-0">
                                            <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex-shrink-0 ${isActive ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-100 text-slate-400 border border-slate-200'} flex items-center justify-center font-bold text-lg md:text-xl shadow-sm`}>
                                                {(s.name || "S").charAt(0).toUpperCase()}
                                            </div>
                                            <div className="ml-3 md:ml-4 min-w-0 flex-1">
                                                <h4 className="font-bold text-slate-800 text-[14px] md:text-[15px] leading-tight line-clamp-1" title={s.name}>{s.name}</h4>
                                                <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 md:mt-1 truncate">{departmentLabel}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Khối thông tin chi tiết */}
                                    <div className="bg-slate-50 rounded-xl p-3 md:p-4 border border-slate-100/80 mb-4 md:mb-5 flex-1 relative overflow-hidden">
                                        {/* Icon nền mờ */}
                                        <i className={`fa-solid ${s.department === 'management' ? 'fa-user-tie' : s.department === 'security' ? 'fa-shield-halved' : s.department === 'kitchen' ? 'fa-utensils' : 'fa-id-badge'} absolute -right-2 -bottom-2 text-4xl md:text-5xl text-slate-200/50 rotate-[-15deg] pointer-events-none`}></i>

                                        <div className="text-xs md:text-sm font-bold text-blue-600 mb-2 md:mb-3 pb-1.5 md:pb-2 border-b border-slate-200/60 truncate">
                                            {positionLabel}
                                        </div>
                                        <div className="space-y-2 md:space-y-2.5 text-[12px] md:text-[13px] text-slate-600 relative z-10">
                                            <div className="flex items-center"><i className="fa-regular fa-envelope w-4 md:w-5 text-center text-slate-400 mr-1.5 md:mr-2"></i><span className="truncate" title={s.email}>{s.email}</span></div>
                                            <div className="flex items-center"><i className="fa-solid fa-phone w-4 md:w-5 text-center text-slate-400 mr-1.5 md:mr-2 text-[10px] md:text-[11px]"></i><span className="truncate">{s.phone}</span></div>
                                            <div className="flex items-center"><i className="fa-solid fa-money-bill-wave w-4 md:w-5 text-center text-slate-400 mr-1.5 md:mr-2 text-[10px] md:text-[11px]"></i><span className="font-mono font-bold text-slate-700 truncate">{formatCurrency(s.salary)}</span></div>
                                        </div>
                                    </div>

                                    {/* Trạng thái & Thao tác */}
                                    <div className="flex justify-between items-center mt-auto border-t border-slate-100 pt-3 md:pt-4">
                                        <button onClick={() => toggleStaffStatus(s.id, s.status)} className={`px-2 py-1 md:px-2.5 md:py-1.5 rounded-lg text-[9px] md:text-[10px] font-bold border transition-colors ${isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200' : 'bg-red-50 text-red-600 border-red-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'} whitespace-nowrap`} title="Nhấn để đổi trạng thái">
                                            {isActive ? 'ĐANG LÀM VIỆC' : 'ĐÃ NGHỈ VIỆC'}
                                        </button>

                                        <div className="flex space-x-1 md:space-x-1.5 flex-shrink-0">
                                            <button onClick={() => openModal(s)} className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" title="Chỉnh sửa">
                                                <i className="fa-solid fa-pen-to-square text-[11px] md:text-[13px]"></i>
                                            </button>
                                            <button onClick={() => handleDeleteStaff(s.id, s.name)} className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" title="Xóa nhân viên">
                                                <i className="fa-solid fa-trash text-[11px] md:text-[13px]"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white rounded-2xl md:rounded-[3rem] border border-dashed border-slate-300 p-10 md:p-24 text-center shadow-sm mt-4 md:mt-8">
                    <div className="w-16 h-16 md:w-24 md:h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 text-slate-300 border border-slate-100">
                        <i className="fa-solid fa-users-slash text-3xl md:text-4xl"></i>
                    </div>
                    <h3 className="text-xl md:text-2xl font-playfair font-bold text-slate-800 mb-2 md:mb-3">Không tìm thấy nhân sự!</h3>
                    <p className="text-slate-500 text-xs md:text-[15px] mb-6 md:mb-8 max-w-md mx-auto">Hệ thống không tìm thấy nhân viên nào khớp với bộ lọc hoặc từ khóa tìm kiếm của bạn.</p>
                    <button onClick={() => { setDeptFilter("all"); setSearchQuery(""); }} className="bg-blue-600 text-white px-6 md:px-8 py-2.5 md:py-3 rounded-xl shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:-translate-y-0.5 transition-all font-bold text-sm md:text-base">
                        Xóa bộ lọc & Tải lại
                    </button>
                </div>
            )}

            {/* Modal Thêm/Sửa Nhân viên */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3 md:p-4">
                    <div className="bg-white rounded-2xl md:rounded-[2rem] w-full max-w-lg shadow-2xl animate-in zoom-in duration-300 border border-slate-100 max-h-[90vh] flex flex-col my-auto">
                        <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
                            <h3 className="text-lg md:text-2xl font-playfair font-bold text-slate-900 truncate pr-4">{formData.id ? "Cập nhật nhân viên" : "Thêm nhân sự mới"}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-full w-8 h-8 md:w-10 md:h-10 flex items-center justify-center transition-all flex-shrink-0"><i className="fa-solid fa-xmark text-lg md:text-xl"></i></button>
                        </div>
                        
                        <div className="p-4 md:p-6 overflow-y-auto custom-scroll flex-1">
                            <form id="staffForm" onSubmit={handleSaveStaff} className="space-y-4 md:space-y-5">
                                <div>
                                    <label className="block text-[12px] md:text-[13px] font-semibold text-slate-600 mb-1.5 md:mb-2">Họ và tên <span className="text-red-500">*</span></label>
                                    <input type="text" required className={formInputClass} placeholder="Trần Văn B" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>

                                <div>
                                    <label className="block text-[12px] md:text-[13px] font-semibold text-slate-600 mb-1.5 md:mb-2">Email <span className="text-red-500">*</span></label>
                                    <input type="email" required className={formInputClass} placeholder="staff@lunahotel.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                </div>

                                <div>
                                    <label className="block text-[12px] md:text-[13px] font-semibold text-slate-600 mb-1.5 md:mb-2">Số điện thoại <span className="text-red-500">*</span></label>
                                    <input type="tel" required className={formInputClass} placeholder="090 123 4567" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[12px] md:text-[13px] font-semibold text-slate-600 mb-1.5 md:mb-2">Chức vụ</label>
                                        <select className={`${formInputClass} font-medium text-slate-700 cursor-pointer`} value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })}>
                                            <option value="manager">Quản lý</option>
                                            <option value="receptionist">Lễ tân</option>
                                            <option value="housekeeping">Buồng phòng</option>
                                            <option value="chef">Đầu bếp</option>
                                            <option value="security">Bảo vệ</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[12px] md:text-[13px] font-semibold text-slate-600 mb-1.5 md:mb-2">Phòng ban</label>
                                        <select className={`${formInputClass} font-medium text-slate-700 cursor-pointer`} value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })}>
                                            <option value="frontdesk">Lễ tân</option>
                                            <option value="housekeeping">Buồng phòng</option>
                                            <option value="kitchen">Bếp</option>
                                            <option value="security">An ninh</option>
                                            <option value="management">Quản lý chung</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[12px] md:text-[13px] font-semibold text-slate-600 mb-1.5 md:mb-2">Ngày bắt đầu</label>
                                        <input type="date" className={formInputClass} value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-[12px] md:text-[13px] font-semibold text-slate-600 mb-1.5 md:mb-2">Lương cơ bản (VNĐ)</label>
                                        <input type="number" className={formInputClass} placeholder="8000000" value={formData.salary} onChange={e => setFormData({ ...formData, salary: e.target.value })} />
                                    </div>
                                </div>

                                {formData.id && (
                                    <div className="pt-2">
                                        <label className="flex items-center space-x-2 md:space-x-3 p-2.5 md:p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                                            <input type="checkbox" className="w-4 h-4 md:w-5 md:h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0" checked={formData.status === "active"} onChange={e => setFormData({ ...formData, status: e.target.checked ? "active" : "inactive" })} />
                                            <span className="text-xs md:text-sm font-semibold text-slate-700">Trạng thái: Đang làm việc</span>
                                        </label>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[12px] md:text-[13px] font-semibold text-slate-600 mb-1.5 md:mb-2">Ghi chú</label>
                                    <textarea rows="2" className={formInputClass} placeholder="Ghi chú về nhân viên..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}></textarea>
                                </div>
                            </form>
                        </div>
                        
                        <div className="p-4 md:p-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-end gap-3 flex-shrink-0">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors text-sm md:text-base">Hủy</button>
                            <button type="submit" form="staffForm" disabled={isSaving} className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 flex items-center justify-center text-sm md:text-base">
                                {isSaving ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Đang lưu...</> : "Lưu nhân viên"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
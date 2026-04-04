// src/app/admin/rooms/page.jsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, Timestamp } from "firebase/firestore";

const formatCurrency = (amount) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

const initialFormState = {
    id: "",
    code: "",
    name: "",
    type: "Standard",
    price: "",
    area: "",
    capacity: 2,
    image: "",
    status: "available",
    amenities: [],
};

const AMENITIES_LIST = [
    { id: "wifi", label: "WiFi miễn phí" },
    { id: "tv", label: "TV phẳng" },
    { id: "ac", label: "Điều hòa" },
    { id: "minibar", label: "Minibar" },
    { id: "bathtub", label: "Bồn tắm" },
    { id: "seaView", label: "View biển" },
    { id: "breakfast", label: "Bữa sáng" },
    { id: "pool", label: "Hồ bơi riêng" }
];

export default function AdminRooms() {
    const [rooms, setRooms] = useState([]);
    const [activeBookings, setActiveBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    // States cho Lọc & Tìm kiếm
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // States cho Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [isSaving, setIsSaving] = useState(false);

    // 1. Lấy dữ liệu phòng & booking Real-time
    useEffect(() => {
        const unsubscribeRooms = onSnapshot(collection(db, "rooms"), (snap) => {
            const loadedRooms = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRooms(loadedRooms);
            setLoading(false);
        });

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

        const unsubscribeBookings = onSnapshot(collection(db, "bookings"), (snap) => {
            const loadedBookings = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const activeToday = loadedBookings.filter(b => b.status !== "cancelled" && b.checkIn <= todayStr && todayStr < b.checkOut);
            setActiveBookings(activeToday);
        });

        return () => {
            unsubscribeRooms();
            unsubscribeBookings();
        };
    }, []);

    // 2. Lọc và Nhóm phòng theo Tầng
    const { filteredRooms, groupedRooms, sortedFloors } = useMemo(() => {
        const query = searchQuery.toLowerCase();
        const occupiedRoomIds = activeBookings.map(b => b.roomId);

        // Xử lý status thực tế
        const roomsWithRealStatus = rooms.map(room => {
            const isActuallyOccupied = room.status !== 'maintenance' && (room.status === 'occupied' || occupiedRoomIds.includes(room.id));
            const displayStatus = room.status === 'maintenance' ? 'maintenance' : (isActuallyOccupied ? 'occupied' : 'available');
            return { ...room, displayStatus };
        });

        // Lọc
        const filtered = roomsWithRealStatus.filter(room => {
            const matchSearch = (room.code || "").toLowerCase().includes(query) ||
                (room.name || "").toLowerCase().includes(query) ||
                (room.type || "").toLowerCase().includes(query);
            const matchStatus = statusFilter === "all" || room.displayStatus === statusFilter;
            return matchSearch && matchStatus;
        }).sort((a, b) => {
            const numA = parseInt((a.code || "").replace(/\D/g, "")) || 0;
            const numB = parseInt((b.code || "").replace(/\D/g, "")) || 0;
            return numA - numB;
        });

        // Nhóm theo tầng
        const grouped = {};
        filtered.forEach(room => {
            let floorStr = "Khác";
            if (room.code) {
                const matches = room.code.match(/\d+/);
                if (matches) floorStr = matches[0].length >= 3 ? matches[0].charAt(0) : matches[0];
            }
            const floorName = `Tầng ${floorStr}`;
            if (!grouped[floorName]) grouped[floorName] = [];
            grouped[floorName].push(room);
        });

        // Sắp xếp các tầng
        const sorted = Object.keys(grouped).sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, "")) || 999;
            const numB = parseInt(b.replace(/\D/g, "")) || 999;
            return numA - numB;
        });

        return { filteredRooms: filtered, groupedRooms: grouped, sortedFloors: sorted };
    }, [rooms, activeBookings, searchQuery, statusFilter]);

    // 3. Xử lý Trạng thái Nhanh
    const quickUpdateRoomStatus = async (roomId, newStatus, currentStatus) => {
        if (newStatus === currentStatus) return;
        try {
            await updateDoc(doc(db, "rooms", roomId), {
                status: newStatus,
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            alert("Lỗi cập nhật trạng thái: " + error.message);
        }
    };

    // 4. Xử lý Form Modal
    const openModal = (room = null) => {
        if (room) {
            setFormData({
                id: room.id,
                code: room.code || "",
                name: room.name || "",
                type: room.type || "Standard",
                price: room.price || "",
                area: room.area || "",
                capacity: room.capacity || 2,
                image: room.image || "",
                status: room.status || "available",
                amenities: room.amenities || [],
            });
        } else {
            setFormData(initialFormState);
        }
        setIsModalOpen(true);
    };

    const handleAmenityChange = (amenityId) => {
        setFormData(prev => {
            const isChecked = prev.amenities.includes(amenityId);
            if (isChecked) {
                return { ...prev, amenities: prev.amenities.filter(id => id !== amenityId) };
            } else {
                return { ...prev, amenities: [...prev.amenities, amenityId] };
            }
        });
    };

    const handleSaveRoom = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const roomData = {
            code: formData.code,
            name: formData.name,
            type: formData.type,
            price: parseInt(formData.price),
            area: parseInt(formData.area) || 30,
            capacity: parseInt(formData.capacity) || 2,
            image: formData.image || "https://images.unsplash.com/photo-1611892440504-42a792e24d32",
            status: formData.status,
            amenities: formData.amenities,
            updatedAt: Timestamp.now()
        };

        try {
            if (formData.id) {
                await updateDoc(doc(db, "rooms", formData.id), roomData);
                alert("Cập nhật phòng thành công!");
            } else {
                await addDoc(collection(db, "rooms"), {
                    ...roomData,
                    createdAt: Timestamp.now(),
                    floor: parseInt(formData.code.match(/\d+/)?.[0]?.charAt(0)) || 1,
                    bedType: "1 giường King",
                    description: roomData.name,
                    bookingsCount: 0,
                });
                alert("Thêm phòng mới thành công!");
            }
            setIsModalOpen(false);
        } catch (error) {
            alert("Lỗi lưu phòng: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteRoom = async (id, code) => {
        if (confirm(`Bạn có chắc muốn xóa phòng ${code}?`)) {
            try {
                await deleteDoc(doc(db, "rooms", id));
            } catch (error) {
                alert("Lỗi xóa phòng: " + error.message);
            }
        }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    const formInputClass = "w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all";

    return (
        <div className="fade-in pb-12 max-w-[1600px] mx-auto relative">

            {/* Header Controls */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 border border-slate-200 shadow-sm mb-8 flex flex-col xl:flex-row gap-5 items-start xl:items-center justify-between transition-all w-full">
                <div>
                    <h3 className="text-2xl font-playfair font-bold text-slate-800 flex items-center">
                        Quản lý Phòng nghỉ
                        <span className="ml-3 bg-blue-100 text-blue-600 text-sm font-sans px-3 py-1 rounded-full font-bold shadow-sm">
                            {filteredRooms.length} / {rooms.length}
                        </span>
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Điều khiển trạng thái và thông tin các phòng trong hệ thống</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                    <div className="relative w-full sm:w-64 flex-shrink-0">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-3.5 text-slate-400"></i>
                        <input type="text" placeholder="Tìm tên, mã, loại..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto hide-scrollbar">
                        <button onClick={() => setStatusFilter("all")} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${statusFilter === "all" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Tất cả</button>
                        <button onClick={() => setStatusFilter("available")} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${statusFilter === "available" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-emerald-600"}`}><i className="fa-solid fa-check-circle mr-1"></i>Trống</button>
                        <button onClick={() => setStatusFilter("occupied")} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${statusFilter === "occupied" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-blue-600"}`}><i className="fa-solid fa-bed mr-1"></i>Đang ở</button>
                        <button onClick={() => setStatusFilter("maintenance")} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${statusFilter === "maintenance" ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-amber-600"}`}><i className="fa-solid fa-wrench mr-1"></i>Bảo trì</button>
                    </div>

                    <button onClick={() => openModal()} className="bg-blue-600 text-white rounded-xl px-5 py-2.5 shadow-lg shadow-blue-500/30 hover:bg-blue-700 flex-shrink-0 whitespace-nowrap transition-all">
                        <i className="fa-solid fa-plus mr-2"></i>Thêm phòng
                    </button>
                </div>
            </div>

            {/* Room List */}
            <div>
                {filteredRooms.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-20 text-center shadow-sm mt-8">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                            <i className="fa-solid fa-door-open text-4xl"></i>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Không tìm thấy phòng nào!</h3>
                        <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">Chưa có phòng nào khớp với từ khóa tìm kiếm hoặc bộ lọc hiện tại của bạn.</p>
                        <button onClick={() => { setStatusFilter("all"); setSearchQuery(""); }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-xl font-bold">
                            Xóa bộ lọc & Tải lại
                        </button>
                    </div>
                ) : (
                    sortedFloors.map(floor => (
                        <div key={floor} className="mb-10">
                            <div className="flex items-center mb-6">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center font-bold mr-4 shadow-md">
                                    <i className="fa-solid fa-layer-group"></i>
                                </div>
                                <h4 className="text-2xl font-playfair font-bold text-slate-800">{floor}</h4>
                                <div className="h-px bg-slate-200 flex-1 ml-4"></div>
                                <span className="ml-4 text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">{groupedRooms[floor].length} phòng</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {groupedRooms[floor].map((room, index) => {
                                    let st = { bg: "bg-emerald-500", text: "text-emerald-600", ping: "bg-emerald-400", label: "CÒN TRỐNG" };
                                    if (room.displayStatus === "occupied") st = { bg: "bg-blue-500", text: "text-blue-600", ping: "bg-blue-400", label: "ĐANG Ở" };
                                    if (room.displayStatus === "maintenance") st = { bg: "bg-amber-500", text: "text-amber-600", ping: "bg-amber-400", label: "BẢO TRÌ" };

                                    return (
                                        <div key={room.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white rounded-3xl border border-slate-200 relative group overflow-hidden hover:shadow-xl transition-all" style={{ animationDelay: `${(index % 10) * 50}ms` }}>
                                            <div className="h-48 relative overflow-hidden bg-slate-100">
                                                <img src={room.image || 'https://images.unsplash.com/photo-1611892440504-42a792e24d32'} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={room.name} />
                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-900/40 to-transparent"></div>

                                                <div className="absolute top-3 left-3 flex items-center bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm">
                                                    <span className="relative flex h-2 w-2 mr-1.5">
                                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${st.ping} opacity-75`}></span>
                                                        <span className={`relative inline-flex rounded-full h-2 w-2 ${st.bg}`}></span>
                                                    </span>
                                                    <span className={`text-[9px] font-bold ${st.text} tracking-wider`}>{st.label}</span>
                                                </div>

                                                <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
                                                    <span className="text-[10px] font-bold text-white tracking-wider">{room.type}</span>
                                                </div>

                                                <div className="absolute bottom-3 left-3 right-3">
                                                    <p className="text-white/70 text-[10px] font-bold mb-0.5 uppercase tracking-widest">Phòng</p>
                                                    <div className="flex items-end justify-between gap-2">
                                                        <h3 className="text-2xl font-playfair font-bold text-white leading-none truncate">{room.code}</h3>
                                                        <div className="text-right flex-shrink-0 bg-black/40 px-2 py-1 rounded-lg backdrop-blur-sm border border-white/10">
                                                            <p className="text-sm font-bold text-white font-mono leading-none">
                                                                {formatCurrency(room.price).replace(/\s?₫/g, "")}<span className="text-[9px] text-white/70 ml-0.5">đ</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Thao tác Đổi trạng thái nhanh (Overlay khi Hover) */}
                                                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                                                    <p className="text-white text-[10px] font-bold tracking-widest mb-1">ĐỔI TRẠNG THÁI</p>
                                                    <div className="flex gap-3">
                                                        <button onClick={() => quickUpdateRoomStatus(room.id, "available", room.status)} className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110" title="Trống"><i className="fa-solid fa-check"></i></button>
                                                        <button onClick={() => quickUpdateRoomStatus(room.id, "occupied", room.status)} className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-400 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110" title="Đang ở"><i className="fa-solid fa-bed"></i></button>
                                                        <button onClick={() => quickUpdateRoomStatus(room.id, "maintenance", room.status)} className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110" title="Bảo trì"><i className="fa-solid fa-wrench"></i></button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 relative z-0">
                                                <p className="text-slate-800 font-semibold text-sm mb-3 line-clamp-1" title={room.name}>{room.name}</p>

                                                <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500 mb-4">
                                                    <span className="bg-slate-50 border border-slate-100 px-2 py-1 rounded-md flex items-center"><i className="fa-solid fa-user-group w-3 text-blue-400 mr-1.5"></i> {room.capacity} KH</span>
                                                    <span className="bg-slate-50 border border-slate-100 px-2 py-1 rounded-md flex items-center"><i className="fa-solid fa-maximize w-3 text-emerald-400 mr-1.5"></i> {room.area}m²</span>
                                                    <span className="bg-slate-50 border border-slate-100 px-2 py-1 rounded-md flex items-center"><i className="fa-solid fa-bed w-3 text-purple-400 mr-1.5"></i> {room.bedType || "King"}</span>
                                                </div>

                                                <div className="flex justify-between items-center pt-3 border-t border-slate-100 border-dashed">
                                                    <div className="flex items-center text-slate-400 text-[11px] font-medium">
                                                        <i className="fa-solid fa-chart-line mr-1"></i> Đã đặt: <span className="text-slate-700 font-bold ml-1">{room.bookingsCount || 0}</span>
                                                    </div>
                                                    <div className="flex space-x-1">
                                                        <button onClick={() => openModal(room)} className="w-7 h-7 flex items-center justify-center text-blue-500 hover:bg-blue-50 rounded transition-all" title="Sửa"><i className="fa-solid fa-pen-to-square text-xs"></i></button>
                                                        <button onClick={() => handleDeleteRoom(room.id, room.code)} className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded transition-all" title="Xóa"><i className="fa-solid fa-trash text-xs"></i></button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal Thêm/Sửa Phòng */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in duration-300">
                        <div className="p-6 md:p-8">
                            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                                <h3 className="text-2xl font-playfair font-bold text-slate-900">{formData.id ? "Cập nhật phòng" : "Thêm phòng mới"}</h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center transition-all"><i className="fa-solid fa-xmark text-xl"></i></button>
                            </div>

                            <form onSubmit={handleSaveRoom} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[13px] font-semibold text-slate-600 mb-2">Mã phòng <span className="text-red-500">*</span></label>
                                        <input type="text" required className={formInputClass} placeholder="VD: P101" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-semibold text-slate-600 mb-2">Loại phòng <span className="text-red-500">*</span></label>
                                        <select required className={formInputClass} value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                            <option value="Standard">Standard - Tiêu chuẩn</option>
                                            <option value="Superior">Superior - Cao cấp</option>
                                            <option value="Deluxe">Deluxe - Hạng sang</option>
                                            <option value="Suite">Suite - Tổng thống</option>
                                            <option value="Family">Family - Gia đình</option>
                                            <option value="Executive">Executive - Hạng doanh nhân</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[13px] font-semibold text-slate-600 mb-2">Tên phòng / Mô tả <span className="text-red-500">*</span></label>
                                    <input type="text" required className={formInputClass} placeholder="Phòng view biển, ban công rộng" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[13px] font-semibold text-slate-600 mb-2">Giá/đêm (VNĐ) <span className="text-red-500">*</span></label>
                                        <input type="number" required className={formInputClass} placeholder="1500000" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-semibold text-slate-600 mb-2">Diện tích (m²)</label>
                                        <input type="number" className={formInputClass} placeholder="45" value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-semibold text-slate-600 mb-2">Số người</label>
                                        <input type="number" className={formInputClass} placeholder="2" value={formData.capacity} onChange={e => setFormData({ ...formData, capacity: e.target.value })} />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[13px] font-semibold text-slate-600 mb-2">Tiện nghi</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {AMENITIES_LIST.map(amenity => (
                                            <label key={amenity.id} className="flex items-center space-x-2 p-2 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                                                <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    checked={formData.amenities.includes(amenity.id)}
                                                    onChange={() => handleAmenityChange(amenity.id)} />
                                                <span className="text-sm text-slate-700">{amenity.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[13px] font-semibold text-slate-600 mb-2">Hình ảnh (URL)</label>
                                    <input type="url" className={formInputClass} placeholder="https://example.com/image.jpg" value={formData.image} onChange={e => setFormData({ ...formData, image: e.target.value })} />
                                    <p className="text-xs text-slate-400 mt-1">Để trống để dùng ảnh mặc định</p>
                                </div>

                                <div>
                                    <label className="block text-[13px] font-semibold text-slate-600 mb-2">Trạng thái</label>
                                    <select className={formInputClass} value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                        <option value="available">Sẵn sàng</option>
                                        <option value="occupied">Đã đặt</option>
                                        <option value="maintenance">Bảo trì</option>
                                    </select>
                                </div>

                                <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200 mt-6">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">Hủy</button>
                                    <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50">
                                        {isSaving ? "Đang lưu..." : "Lưu phòng"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
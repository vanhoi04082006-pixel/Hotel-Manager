// src/app/admin/invoices/page.jsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import * as XLSX from "xlsx";

const formatCurrency = (amount) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount || 0);

const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
        const d = dateString?.toDate ? dateString.toDate() : new Date(dateString);
        return d.toLocaleDateString("vi-VN");
    } catch (e) { return ""; }
};

const formatFullDate = (dateString) => {
    if (!dateString) return "";
    try {
        const d = dateString?.toDate ? dateString.toDate() : new Date(dateString);
        return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
};

export default function AdminInvoices() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);

    // States Lọc & Tìm kiếm
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState("all");

    // States Phân trang
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(10);

    // States Modal Chi tiết
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const printRef = useRef(null);

    // 1. Lấy dữ liệu Real-time
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "invoices"), (snap) => {
            const loadedInvoices = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            loadedInvoices.sort((a, b) => {
                const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
                const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
                return timeB - timeA;
            });
            setInvoices(loadedInvoices);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. Logic Lọc và Thống kê
    const { filteredInvoices, paginatedInvoices, stats, totalPages } = useMemo(() => {
        const query = searchQuery.toLowerCase();
        const now = new Date();

        const filtered = invoices.filter((inv) => {
            // Tìm kiếm
            const matchSearch =
                (inv.customerName || "").toLowerCase().includes(query) ||
                (inv.customerEmail || "").toLowerCase().includes(query) ||
                (inv.roomCode || "").toLowerCase().includes(query) ||
                (inv.id || "").toLowerCase().includes(query) ||
                (inv.bookingId || "").toLowerCase().includes(query);

            // Trạng thái
            const matchStatus = statusFilter === "all" || inv.status === statusFilter;

            // Thời gian
            let matchDate = true;
            if (dateFilter === "thisMonth" && inv.createdAt) {
                const invDate = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
                matchDate = invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
            }

            return matchSearch && matchStatus && matchDate;
        });

        const statsObj = {
            total: filtered.length,
            revenue: filtered.filter(i => i.status === "paid").reduce((s, i) => s + (i.total || 0), 0),
            cancelled: filtered.filter(i => i.status === "cancelled").length
        };

        const totalPagesCount = Math.ceil(filtered.length / limit);
        const start = page * limit;
        const paginated = filtered.slice(start, start + limit);

        return { filteredInvoices: filtered, paginatedInvoices: paginated, stats: statsObj, totalPages: totalPagesCount };
    }, [invoices, searchQuery, statusFilter, dateFilter, page, limit]);

    // Đặt lại trang về 0 khi bộ lọc thay đổi
    useEffect(() => {
        setPage(0);
    }, [searchQuery, statusFilter, dateFilter, limit]);

    // 3. Các hàm Thao tác
    const handleDeleteInvoice = async (id, code) => {
        if (confirm(`Hành động này sẽ XÓA VĨNH VIỄN hóa đơn "${code}" khỏi dữ liệu kế toán. Bạn có chắc chắn?`)) {
            try {
                await deleteDoc(doc(db, "invoices", id));
            } catch (error) {
                alert("Lỗi: " + error.message);
            }
        }
    };

    const handlePrint = () => {
        const printContent = printRef.current.innerHTML;
        const printWindow = window.open('', '', 'width=800,height=900');
        printWindow.document.write(`
      <html>
        <head>
          <title>In Hóa Đơn - Luna Hotel</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; padding: 20px; }
            .receipt { max-width: 400px; margin: 0 auto; }
            .text-center { text-align: center; }
            .border-b { border-bottom: 1px dashed #000; margin: 15px 0; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; border-bottom: 1px solid #000; padding: 5px 0; }
            td { padding: 5px 0; }
            .total { font-size: 18px; font-weight: bold; margin-top: 10px; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="receipt">${printContent}</div>
        </body>
      </html>
    `);
        printWindow.document.close();
    };

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredInvoices.map(i => ({
            "Mã HĐ": i.id.slice(-8).toUpperCase(),
            "Mã Booking": (i.bookingId || "").slice(-8).toUpperCase(),
            "Khách hàng": i.customerName,
            "SĐT": i.customerPhone || "N/A",
            "Phòng": i.roomCode,
            "Ngày lập": formatDate(i.createdAt),
            "Tiền phòng": i.roomTotal || 0,
            "Tiền Dịch vụ": i.serviceTotal || 0,
            "Giảm giá": i.discount || 0,
            "Tổng thu": i.total || 0,
            "Trạng thái": i.status === 'paid' ? 'Đã thu tiền' : 'Đã hủy'
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Invoices");
        XLSX.writeFile(wb, `Luna_Invoices_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="fade-in max-w-[1600px] mx-auto pb-12 relative z-0">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-playfair font-bold text-slate-800 flex items-center gap-3">
                        Hóa đơn & Biên lai
                        <span className="bg-emerald-50 text-emerald-600 text-xs py-1.5 px-3 rounded-xl font-bold border border-emerald-100 shadow-sm">
                            <i className="fa-solid fa-file-invoice-dollar mr-2"></i> Kế toán
                        </span>
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Lưu trữ và thống kê toàn bộ chứng từ thanh toán của hệ thống.</p>
                </div>
                <button onClick={exportToExcel} className="bg-white text-slate-700 border border-slate-200 rounded-xl px-5 py-2.5 flex items-center gap-2 hover:bg-emerald-50 hover:text-emerald-600 transition-all font-bold text-sm shadow-sm">
                    <i className="fa-solid fa-file-excel"></i> Xuất Bảng Kê
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center text-xl shadow-inner"><i className="fa-solid fa-receipt"></i></div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Hóa đơn khả dụng</p>
                        <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
                    </div>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-xl shadow-inner"><i className="fa-solid fa-vault"></i></div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Doanh thu thu về</p>
                        <p className="text-2xl font-bold text-emerald-600 font-mono">{formatCurrency(stats.revenue).replace("₫", "")}</p>
                    </div>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center text-xl shadow-inner"><i className="fa-solid fa-ban"></i></div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Đã hủy</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-bold text-slate-800">{stats.cancelled}</p>
                            <span className="text-sm text-slate-400 font-medium">chứng từ</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="bg-white/80 backdrop-blur-xl p-3 rounded-3xl border border-slate-200/60 shadow-sm mb-8 flex flex-col xl:flex-row justify-between gap-4 transition-all">
                <div className="flex overflow-x-auto gap-2 items-center px-2 hide-scrollbar">
                    <button onClick={() => setStatusFilter("all")} className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all border whitespace-nowrap ${statusFilter === "all" ? "bg-slate-900 text-white shadow-lg" : "text-slate-600 hover:bg-slate-50 border-transparent"}`}>Tất cả trạng thái</button>
                    <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
                    <button onClick={() => setStatusFilter("paid")} className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all border whitespace-nowrap flex items-center ${statusFilter === "paid" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 border-emerald-500" : "text-emerald-600 hover:bg-emerald-50 border-transparent"}`}><i className="fa-solid fa-check mr-2"></i>Đã thu tiền</button>
                    <button onClick={() => setStatusFilter("cancelled")} className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all border whitespace-nowrap flex items-center ${statusFilter === "cancelled" ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30 border-rose-500" : "text-rose-600 hover:bg-rose-50 border-transparent"}`}><i className="fa-solid fa-xmark mr-2"></i>Đã hủy</button>

                    <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
                    <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2.5 font-bold outline-none cursor-pointer">
                        <option value="all">Mọi thời gian</option>
                        <option value="thisMonth">Chỉ Tháng này</option>
                    </select>
                </div>

                <div className="relative w-full xl:w-[350px] shrink-0">
                    <i className="fa-solid fa-magnifying-glass absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input
                        type="text"
                        placeholder="Tìm mã hóa đơn, tên khách..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-sm font-medium"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead className="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-5 font-bold">Mã chứng từ</th>
                                <th className="px-6 py-5 font-bold">Khách hàng</th>
                                <th className="px-6 py-5 font-bold">Thông tin phòng</th>
                                <th className="px-6 py-5 font-bold">Ngày lập</th>
                                <th className="px-6 py-5 font-bold text-right">Tổng thu</th>
                                <th className="px-6 py-5 font-bold text-center">Trạng thái</th>
                                <th className="px-6 py-5"></th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100 bg-white">
                            {paginatedInvoices.length > 0 ? (
                                paginatedInvoices.map((inv, index) => {
                                    const isPaid = inv.status === "paid";

                                    return (
                                        <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${index * 50}ms` }}>
                                            <td className="px-6 py-4">
                                                <div className="font-mono font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 w-fit flex items-center shadow-sm">
                                                    <i className="fa-solid fa-file-invoice mr-2 text-slate-400"></i>#{inv.id.slice(-8).toUpperCase()}
                                                </div>
                                                {inv.bookingId && (
                                                    <div className="text-[10px] text-slate-400 mt-1.5 font-medium flex items-center">
                                                        <i className="fa-solid fa-link mr-1"></i>BK: {inv.bookingId.slice(-8).toUpperCase()}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800 text-[15px] mb-1">{inv.customerName || "Khách vãng lai"}</div>
                                                <div className="text-[12px] text-slate-500 flex items-center"><i className="fa-regular fa-envelope w-4"></i> {inv.customerEmail || "N/A"}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-md">P.{inv.roomCode}</span>
                                                    <span className="text-[12px] font-medium text-slate-500">{inv.nights} đêm</span>
                                                </div>
                                                {inv.services?.length > 0 && (
                                                    <div className="text-[10px] text-slate-400 truncate max-w-[150px]" title={inv.services.map(s => s.name).join(", ")}>
                                                        + {inv.services.length} Dịch vụ
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 font-medium">{formatDate(inv.createdAt)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="font-mono font-bold text-slate-800 text-[16px]">{formatCurrency(inv.total)}</div>
                                                {inv.discount > 0 && (
                                                    <div className="text-[10px] font-bold text-rose-500 mt-0.5">Đã giảm {formatCurrency(inv.discount)}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border ${isPaid ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                                                    {isPaid ? <><i className="fa-solid fa-check mr-1.5"></i>Đã thu tiền</> : <><i className="fa-solid fa-xmark mr-1.5"></i>Đã hủy</>}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setSelectedInvoice(inv)} className="w-9 h-9 flex items-center justify-center text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-xl transition-all shadow-sm border border-transparent bg-white" title="Xem chi tiết & In">
                                                        <i className="fa-solid fa-print text-[13px]"></i>
                                                    </button>
                                                    <button onClick={() => handleDeleteInvoice(inv.id, inv.id.slice(-8).toUpperCase())} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-red-100" title="Xóa bỏ">
                                                        <i className="fa-solid fa-trash text-[13px]"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="7" className="px-6 py-24 text-center bg-slate-50/30">
                                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 shadow-inner">
                                            <i className="fa-solid fa-file-invoice text-3xl"></i>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-700 mb-2">Không tìm thấy chứng từ</h3>
                                        <p className="text-slate-500 font-medium text-sm">Chưa có hóa đơn nào khớp với bộ lọc hoặc từ khóa hiện tại của bạn.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {paginatedInvoices.length > 0 && totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-8 p-4 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm gap-4">
                    <div className="flex items-center gap-3">
                        <p className="text-sm text-slate-500 font-medium">Hiển thị</p>
                        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-1.5 font-bold outline-none cursor-pointer">
                            <option value="10">10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                        <button onClick={() => setPage(page - 1)} disabled={page === 0} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm">
                            <i className="fa-solid fa-chevron-left text-xs"></i>
                        </button>
                        {Array.from({ length: totalPages }).map((_, i) => {
                            if (totalPages > 7 && i !== 0 && i !== totalPages - 1 && Math.abs(i - page) > 1) {
                                if (i === 1 || i === totalPages - 2) return <span key={i} className="px-1 text-slate-400">...</span>;
                                return null;
                            }
                            return (
                                <button key={i} onClick={() => setPage(i)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-all shadow-sm ${page === i ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600"}`}>{i + 1}</button>
                            );
                        })}
                        <button onClick={() => setPage(page + 1)} disabled={page === totalPages - 1} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm">
                            <i className="fa-solid fa-chevron-right text-xs"></i>
                        </button>
                    </div>
                </div>
            )}

            {/* Modal In Hóa Đơn */}
            {selectedInvoice && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-300">

                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-3xl">
                            <h3 className="font-bold text-slate-700"><i className="fa-solid fa-print mr-2 text-blue-500"></i>Xem trước Bản in</h3>
                            <div className="flex gap-2">
                                <button onClick={handlePrint} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                                    In Hóa Đơn
                                </button>
                                <button onClick={() => setSelectedInvoice(null)} className="w-10 h-10 flex items-center justify-center bg-white text-slate-500 hover:text-slate-800 rounded-xl shadow-sm border border-slate-200 transition-colors">
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        </div>

                        <div className="p-8 overflow-y-auto custom-scroll bg-slate-100 flex-1">
                            {/* Đây là phần DOM sẽ được bóc tách bằng InnerHTML để ném vào máy In */}
                            <div ref={printRef} className="receipt-box bg-white p-8 rounded-sm shadow-md border border-slate-200" style={{ maxWidth: '400px', margin: '0 auto', fontFamily: 'monospace', color: '#111' }}>
                                <div className="text-center border-b pb-4 mb-4" style={{ borderBottom: '1px dashed #ccc', paddingBottom: '15px', marginBottom: '15px', textAlign: 'center' }}>
                                    <h1 className="font-bold" style={{ fontSize: '26px', letterSpacing: '1px', margin: '0 0 5px 0' }}>LUNA HOTEL</h1>
                                    <p style={{ fontSize: '11px', color: '#555', margin: '2px 0' }}>123 Nguyễn Huệ, Quận 1, TP.HCM</p>
                                    <p style={{ fontSize: '11px', color: '#555', margin: '2px 0' }}>Hotline: 1900 1234 - MST: 0101234567</p>
                                </div>

                                <div className="text-center mb-6" style={{ textAlign: 'center', marginBottom: '20px' }}>
                                    <h2 className="font-bold uppercase tracking-widest" style={{ fontSize: '18px', margin: '0 0 5px 0' }}>Phiếu Thanh Toán</h2>
                                    <p style={{ fontSize: '12px', margin: '2px 0' }}>Mã: #{selectedInvoice.id.slice(-8).toUpperCase()}</p>
                                    <p style={{ fontSize: '12px', margin: '2px 0' }}>Ngày lập: {formatFullDate(selectedInvoice.createdAt)}</p>
                                </div>

                                <div className="mb-6 space-y-1" style={{ fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>
                                    <p style={{ margin: '3px 0' }}><span style={{ fontWeight: 'bold' }}>Khách hàng:</span> {selectedInvoice.customerName}</p>
                                    <p style={{ margin: '3px 0' }}><span style={{ fontWeight: 'bold' }}>Mã Booking:</span> {selectedInvoice.bookingId?.slice(-8).toUpperCase() || 'N/A'}</p>
                                    <p style={{ margin: '3px 0' }}><span style={{ fontWeight: 'bold' }}>Phòng:</span> {selectedInvoice.roomCode} ({selectedInvoice.nights} đêm)</p>
                                </div>

                                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', marginBottom: '20px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left', borderBottom: '1px dashed #333', paddingBottom: '5px', paddingTop: '5px' }}>Dịch vụ</th>
                                            <th style={{ textAlign: 'right', borderBottom: '1px dashed #333', paddingBottom: '5px', paddingTop: '5px' }}>Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td style={{ padding: '8px 0', borderBottom: '1px dotted #ccc' }}>Tiền phòng ({selectedInvoice.nights}x)</td>
                                            <td style={{ textAlign: 'right', padding: '8px 0', borderBottom: '1px dotted #ccc' }}>{formatCurrency(selectedInvoice.roomTotal)}</td>
                                        </tr>

                                        {selectedInvoice.services?.length > 0 && selectedInvoice.services.map((s, idx) => (
                                            <tr key={idx}>
                                                <td style={{ padding: '8px 0', borderBottom: '1px dotted #ccc', paddingLeft: '10px' }}>- {s.name}</td>
                                                <td style={{ textAlign: 'right', padding: '8px 0', borderBottom: '1px dotted #ccc' }}>{formatCurrency(s.price)}</td>
                                            </tr>
                                        ))}

                                        {selectedInvoice.discount > 0 && (
                                            <tr>
                                                <td style={{ padding: '8px 0', borderBottom: '1px dotted #ccc' }}>Khuyến mãi / Giảm giá</td>
                                                <td style={{ textAlign: 'right', padding: '8px 0', borderBottom: '1px dotted #ccc' }}>-{formatCurrency(selectedInvoice.discount)}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>

                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px dashed #333', paddingTop: '15px', marginTop: '10px', fontSize: '16px', fontWeight: 'bold' }}>
                                    <span>TỔNG CỘNG:</span>
                                    <span>{formatCurrency(selectedInvoice.total)}</span>
                                </div>

                                <div style={{ textAlign: 'center', marginTop: '40px', fontSize: '11px', color: '#666', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                                    <p style={{ margin: '2px 0' }}>Giá đã bao gồm 10% VAT và 5% phí phục vụ.</p>
                                    <p style={{ fontStyle: 'italic', marginTop: '6px' }}>Cảm ơn quý khách và hẹn gặp lại!</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
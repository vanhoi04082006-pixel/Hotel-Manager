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
            const matchSearch =
                (inv.customerName || "").toLowerCase().includes(query) ||
                (inv.customerEmail || "").toLowerCase().includes(query) ||
                (inv.roomCode || "").toLowerCase().includes(query) ||
                (inv.id || "").toLowerCase().includes(query);

            const matchStatus = statusFilter === "all" || inv.status === statusFilter;

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
            refunded: filtered.filter(i => i.status === "refunded").length
        };

        const totalPagesCount = Math.ceil(filtered.length / limit);
        const start = page * limit;
        const paginated = filtered.slice(start, start + limit);

        return { filteredInvoices: filtered, paginatedInvoices: paginated, stats: statsObj, totalPages: totalPagesCount };
    }, [invoices, searchQuery, statusFilter, dateFilter, page, limit]);

    useEffect(() => { setPage(0); }, [searchQuery, statusFilter, dateFilter, limit]);

    // 3. Các hàm Thao tác
    const handleDeleteInvoice = async (id) => {
        if (confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn hóa đơn này khỏi sổ sách?`)) {
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
            "Khách hàng": i.customerName,
            "Phòng": i.roomCode,
            "Ngày lập": formatDate(i.createdAt),
            "Tổng thu": i.total,
            "Trạng thái": i.status === 'paid' ? 'Đã thu' : 'Hoàn tiền'
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Invoices");
        XLSX.writeFile(wb, "Luna_Invoices.xlsx");
    };

    if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="fade-in max-w-[1600px] mx-auto pb-12 relative">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-playfair font-bold text-slate-800 flex items-center gap-3">
                        Hóa đơn & Biên lai
                        <span className="bg-emerald-50 text-emerald-600 text-xs py-1.5 px-3 rounded-xl font-bold border border-emerald-100 shadow-sm">
                            <i className="fa-solid fa-file-invoice-dollar mr-2"></i> Kế toán
                        </span>
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Quản lý và lưu trữ toàn bộ lịch sử thanh toán của khách hàng.</p>
                </div>
                <button onClick={exportToExcel} className="bg-white text-slate-700 border border-slate-200 rounded-xl px-5 py-2.5 flex items-center gap-2 hover:bg-emerald-50 hover:text-emerald-600 transition-all font-bold text-sm shadow-sm">
                    <i className="fa-solid fa-file-excel"></i> Xuất Excel
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center text-xl shadow-inner"><i className="fa-solid fa-receipt"></i></div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Số lượng HĐ</p>
                        <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
                    </div>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-xl shadow-inner"><i className="fa-solid fa-vault"></i></div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Doanh thu thu về</p>
                        <p className="text-2xl font-bold text-emerald-600 font-mono">{formatCurrency(stats.revenue)}</p>
                    </div>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center text-xl shadow-inner"><i className="fa-solid fa-money-bill-transfer"></i></div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Đã hoàn tiền</p>
                        <p className="text-3xl font-bold text-slate-800">{stats.refunded}</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white/80 backdrop-blur-xl p-3 rounded-3xl border border-slate-200/60 shadow-sm mb-8 flex flex-col xl:flex-row justify-between gap-4">
                <div className="flex overflow-x-auto gap-2 items-center px-2 hide-scrollbar">
                    <button onClick={() => setStatusFilter("all")} className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${statusFilter === "all" ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"}`}>Tất cả</button>
                    <button onClick={() => setStatusFilter("paid")} className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${statusFilter === "paid" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" : "text-emerald-600 hover:bg-emerald-50"}`}>Đã thu tiền</button>
                    <button onClick={() => setStatusFilter("refunded")} className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${statusFilter === "refunded" ? "bg-rose-500 text-white shadow-lg shadow-rose-200" : "text-rose-600 hover:bg-rose-50"}`}>Đã hoàn tiền</button>
                    <div className="w-px h-6 bg-slate-200 mx-2"></div>
                    <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2.5 font-bold outline-none">
                        <option value="all">Mọi thời gian</option>
                        <option value="thisMonth">Tháng này</option>
                    </select>
                </div>
                <div className="relative w-full xl:w-[400px]">
                    <i className="fa-solid fa-magnifying-glass absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input type="text" placeholder="Tìm tên khách, mã HĐ, mã phòng..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all text-sm font-medium" />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-5 font-bold">Mã chứng từ</th>
                                <th className="px-6 py-5 font-bold">Khách hàng</th>
                                <th className="px-6 py-5 font-bold">Phòng</th>
                                <th className="px-6 py-5 font-bold">Ngày lập</th>
                                <th className="px-6 py-5 font-bold text-right">Tổng thu</th>
                                <th className="px-6 py-5 font-bold text-center">Trạng thái</th>
                                <th className="px-6 py-5"></th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100 bg-white">
                            {paginatedInvoices.map((inv) => (
                                <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-mono font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 w-fit">
                                            #{inv.id.slice(-8).toUpperCase()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{inv.customerName}</div>
                                        <div className="text-xs text-slate-500">{inv.customerEmail}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">P.{inv.roomCode}</span>
                                        <span className="ml-2 text-slate-500 text-xs">{inv.nights} đêm</span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 font-medium">{formatDate(inv.createdAt)}</td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">{formatCurrency(inv.total)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                            {inv.status === 'paid' ? 'Đã thu tiền' : 'Đã hoàn tiền'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setSelectedInvoice(inv)} className="w-9 h-9 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-100">
                                                <i className="fa-solid fa-print"></i>
                                            </button>
                                            <button onClick={() => handleDeleteInvoice(inv.id)} className="w-9 h-9 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all border border-slate-200">
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-8 p-4 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm gap-4">
                    <div className="flex items-center gap-3">
                        <p className="text-sm text-slate-500 font-medium">Hiển thị</p>
                        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-1.5 font-bold outline-none cursor-pointer">
                            <option value="10">10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage(page - 1)} disabled={page === 0} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all"><i className="fa-solid fa-chevron-left"></i></button>
                        {Array.from({ length: totalPages }).map((_, i) => (
                            <button key={i} onClick={() => setPage(i)} className={`w-9 h-9 rounded-xl font-bold transition-all ${page === i ? "bg-slate-900 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{i + 1}</button>
                        ))}
                        <button onClick={() => setPage(page + 1)} disabled={page === totalPages - 1} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all"><i className="fa-solid fa-chevron-right"></i></button>
                    </div>
                </div>
            )}

            {/* Modal & Print Preview */}
            {selectedInvoice && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in duration-300">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-3xl">
                            <h3 className="font-bold text-slate-700">Bản in Hóa đơn</h3>
                            <div className="flex gap-2">
                                <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 flex items-center gap-2"><i className="fa-solid fa-print"></i> In ngay</button>
                                <button onClick={() => setSelectedInvoice(null)} className="w-9 h-9 flex items-center justify-center bg-white text-slate-500 rounded-xl border"><i className="fa-solid fa-xmark"></i></button>
                            </div>
                        </div>

                        <div className="p-8 overflow-y-auto bg-slate-100 flex-1">
                            <div ref={printRef} className="bg-white p-8 border shadow-sm mx-auto" style={{ maxWidth: '380px', color: '#000', fontSize: '12px' }}>
                                <div className="text-center mb-6">
                                    <h1 style={{ margin: '0', fontSize: '20px' }}>LUNA HOTEL</h1>
                                    <p style={{ margin: '2px 0' }}>123 Đường Biển, Nha Trang</p>
                                    <div className="border-b" style={{ margin: '10px 0' }}></div>
                                    <h2 style={{ margin: '10px 0', fontSize: '16px' }}>HÓA ĐƠN THANH TOÁN</h2>
                                    <p>Mã: #{selectedInvoice.id.slice(-8).toUpperCase()}</p>
                                </div>

                                <div style={{ marginBottom: '15px' }}>
                                    <p><b>Khách hàng:</b> {selectedInvoice.customerName}</p>
                                    <p><b>Ngày lập:</b> {formatFullDate(selectedInvoice.createdAt)}</p>
                                    <p><b>Phòng:</b> {selectedInvoice.roomCode} ({selectedInvoice.nights} đêm)</p>
                                </div>

                                <table style={{ width: '100%', marginBottom: '15px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #000' }}>
                                            <th style={{ padding: '5px 0' }}>Dịch vụ</th>
                                            <th style={{ textAlign: 'right' }}>Tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td style={{ padding: '5px 0' }}>Tiền phòng</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(selectedInvoice.roomTotal)}</td>
                                        </tr>
                                        {selectedInvoice.services?.map((s, i) => (
                                            <tr key={i}>
                                                <td style={{ padding: '5px 0', paddingLeft: '10px' }}>- {s.name}</td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(s.price)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div className="border-b" style={{ borderTop: '2px solid #000', paddingTop: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold' }}>
                                        <span>TỔNG CỘNG:</span>
                                        <span>{formatCurrency(selectedInvoice.total)}</span>
                                    </div>
                                </div>

                                <div className="text-center" style={{ marginTop: '30px', fontStyle: 'italic' }}>
                                    <p>Cảm ơn và hẹn gặp lại quý khách!</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
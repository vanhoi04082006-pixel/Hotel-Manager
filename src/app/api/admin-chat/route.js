// src/app/api/admin-chat/route.js

import OpenAI from "openai";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, getDoc, Timestamp } from "firebase/firestore";

const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Luna Hotel AI Agent"
    }
});

// ==========================================
// HÀM PHỤ TRỢ: TÌM ID THẬT TỪ MÃ NGẮN CỦA SẾP
// ==========================================
async function resolveBookingId(shortOrFullId) {
    // Xóa dấu # nếu Sếp có gõ nhầm vào
    const cleanStr = shortOrFullId.replace('#', '').trim().toLowerCase();
    const bookingsSnap = await getDocs(collection(db, "bookings"));
    
    // Tìm Booking có ID khớp hoàn toàn HOẶC chứa chuỗi mã ngắn ở cuối
    const target = bookingsSnap.docs.find(d => 
        d.id.toLowerCase() === cleanStr || 
        d.id.toLowerCase().endsWith(cleanStr)
    );
    
    if (!target) throw new Error(`Không tìm thấy đơn đặt phòng nào chứa mã '${shortOrFullId}'. Sếp kiểm tra lại mã nhé!`);
    return target; // Trả về snapshot
}

// ==========================================
// THƯ VIỆN TOOLS: QUẢN TRỊ BOOKINGS TOÀN NĂNG
// ==========================================

// 1. Thống kê Dashboard & Tổng quan
async function getDashboardData() {
    try {
        const now = new Date();
        const vnTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
        const todayStr = `${vnTime.getFullYear()}-${String(vnTime.getMonth() + 1).padStart(2, "0")}-${String(vnTime.getDate()).padStart(2, "0")}`;

        const bookingsSnap = await getDocs(collection(db, "bookings"));
        const roomsSnap = await getDocs(collection(db, "rooms"));

        const loadedBookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const rooms = roomsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const arrivalsToday = loadedBookings.filter(b => b.checkIn === todayStr).length;
        const checkOutsToday = loadedBookings.filter(b => b.checkOut === todayStr).length;

        const confirmedBookings = loadedBookings.filter(b => b.status === "completed" || b.status === "confirmed" || b.paymentStatus === "paid");
        const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (Number(b.finalPaidAmount) || Number(b.totalPrice) || 0), 0);

        const activeBookings = loadedBookings.filter(b => b.status !== "cancelled" && b.checkIn <= todayStr && todayStr < b.checkOut);
        const occupiedRoomIds = activeBookings.map(b => b.roomId);
        
        const maintenanceRooms = rooms.filter(r => r.status === "maintenance").length;
        let occupiedCount = rooms.filter(r => r.status !== 'maintenance' && (r.status === 'occupied' || occupiedRoomIds.includes(r.id))).length;

        return JSON.stringify({
            date: todayStr,
            arrivalsToday, checkOutsToday, totalRevenue,
            maintenanceRooms, occupancyRate: `${((occupiedCount / (rooms.length || 1)) * 100).toFixed(1)}%`
        });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

// 2. Tìm kiếm & Lọc Đặt phòng đa năng
async function searchBookings({ query = "", status = "all" }) {
    try {
        const bookingsSnap = await getDocs(collection(db, "bookings"));
        let results = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (status !== "all") {
            results = results.filter(b => b.status === status);
        }

        if (query) {
            const q = query.replace('#', '').toLowerCase();
            results = results.filter(b => 
                (b.userName || "").toLowerCase().includes(q) || 
                (b.roomCode || "").toLowerCase().includes(q) ||
                b.id.toLowerCase().includes(q)
            );
        }

        const compactResults = results.map(b => ({
            maDonNgan: b.id.slice(-8).toUpperCase(),
            tenKhach: b.userName || b.userEmail, 
            phong: b.roomCode,
            checkIn: b.checkIn, 
            checkOut: b.checkOut, 
            trangThai: b.status, 
            thanhToan: b.paymentStatus, 
            tongTien: b.totalPrice
        }));

        return JSON.stringify(compactResults.length > 0 ? compactResults : { message: "Không tìm thấy booking nào khớp." });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

// 3. Thay đổi trạng thái Booking (ĐÃ FIX: Dùng resolveBookingId)
async function updateBookingStatus({ bookingId, newStatus }) {
    try {
        const targetDoc = await resolveBookingId(bookingId);
        const realId = targetDoc.id;
        const b = targetDoc.data();
        const rId = b.roomId;

        await updateDoc(doc(db, "bookings", realId), { status: newStatus, updatedAt: Timestamp.now() });
        
        if (rId) {
            if (newStatus === "confirmed") await updateDoc(doc(db, "rooms", rId), { status: "occupied" });
            if (newStatus === "completed" || newStatus === "cancelled") await updateDoc(doc(db, "rooms", rId), { status: "available" });
        }
        
        await addDoc(collection(db, "logs"), { message: `AI đã đổi trạng thái booking ${realId.slice(-8).toUpperCase()} -> ${newStatus}`, type: "success", user: "Luna AI", timestamp: Timestamp.now() });
        return JSON.stringify({ success: true, message: `Đã cập nhật booking ${realId.slice(-8).toUpperCase()} thành ${newStatus}` });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

// 4. Xóa bản ghi Booking (ĐÃ FIX: Dùng resolveBookingId)
async function deleteBookingRecord({ bookingId }) {
    try {
        const targetDoc = await resolveBookingId(bookingId);
        const realId = targetDoc.id;

        await deleteDoc(doc(db, "bookings", realId));
        await addDoc(collection(db, "logs"), { message: `AI đã xóa vĩnh viễn booking ${realId.slice(-8).toUpperCase()}`, type: "error", user: "Luna AI", timestamp: Timestamp.now() });
        return JSON.stringify({ success: true, message: `Đã xóa thành công booking mang mã ${realId.slice(-8).toUpperCase()}.` });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

// 5. Đánh dấu đã thanh toán và Tạo hóa đơn (ĐÃ FIX: Dùng resolveBookingId)
async function markPaidAndInvoice({ bookingId }) {
    try {
        const targetDoc = await resolveBookingId(bookingId);
        const realId = targetDoc.id;
        const b = targetDoc.data();

        await updateDoc(doc(db, "bookings", realId), { paymentStatus: "paid", updatedAt: Timestamp.now() });

        const invoiceData = {
            bookingId: realId,
            customerName: b.userName || b.userEmail,
            roomCode: b.roomCode, checkIn: b.checkIn, checkOut: b.checkOut, nights: b.nights,
            total: b.finalPaidAmount || b.totalPrice, status: "paid", createdAt: Timestamp.now(),
        };
        await addDoc(collection(db, "invoices"), invoiceData);
        await addDoc(collection(db, "logs"), { message: `AI đã thu tiền và tạo hóa đơn cho booking ${realId.slice(-8).toUpperCase()}`, type: "success", user: "Luna AI", timestamp: Timestamp.now() });

        return JSON.stringify({ success: true, message: `Đã thu tiền và xuất hóa đơn thành công cho mã đơn ${realId.slice(-8).toUpperCase()}.` });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

// 6. Xuất dữ liệu ra file
async function exportBookingsToCSV({ status = "all" }) {
    try {
        const snap = await getDocs(collection(db, "bookings"));
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (status !== "all") results = results.filter(b => b.status === status);

        let csvContent = "Mã Đặt Phòng,Khách Hàng,Phòng,Ngày Check-in,Ngày Check-out,Trạng Thái,Thanh Toán,Tổng Tiền\n";
        results.forEach(b => {
            const ten = (b.userName || b.userEmail || "Khách").replace(/,/g, " ");
            csvContent += `${b.id.slice(-8).toUpperCase()},${ten},${b.roomCode},${b.checkIn},${b.checkOut},${b.status},${b.paymentStatus},${b.totalPrice}\n`;
        });

        const base64CSV = Buffer.from("\uFEFF" + csvContent, 'utf8').toString('base64'); 
        const downloadLink = `<a href="data:text/csv;base64,${base64CSV}" download="Luna_Bookings_Export.csv" style="display: inline-block; padding: 10px 20px; background: #10b981; color: white; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 10px;"><i class="fa-solid fa-download"></i> Tải xuống Danh sách (${results.length} đơn)</a>`;
        
        return JSON.stringify({ success: true, htmlLink: downloadLink });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

// ==========================================
// CẤU HÌNH TOOLS CHO OPENAI
// ==========================================
const tools = [
    { type: "function", function: { name: "getDashboardData", description: "Lấy tổng quan: doanh thu, số đơn." } },
    {
        type: "function",
        function: {
            name: "searchBookings",
            description: "Tìm kiếm danh sách đặt phòng.",
            parameters: {
                type: "object",
                properties: { 
                    query: { type: "string", description: "Tên khách, mã phòng hoặc ID" },
                    status: { type: "string", enum: ["all", "pending", "confirmed", "completed", "cancelled"] }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "updateBookingStatus",
            description: "Xác nhận (confirmed), Check-out (completed) hoặc Hủy (cancelled) đơn.",
            parameters: {
                type: "object",
                properties: {
                    bookingId: { type: "string", description: "Mã đơn (Mã dài Firebase HOẶC 8 ký tự cuối)" },
                    newStatus: { type: "string", enum: ["confirmed", "completed", "cancelled"] }
                },
                required: ["bookingId", "newStatus"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "deleteBookingRecord",
            description: "Xóa vĩnh viễn một đơn đặt phòng.",
            parameters: { type: "object", properties: { bookingId: { type: "string" } }, required: ["bookingId"] }
        }
    },
    {
        type: "function",
        function: {
            name: "markPaidAndInvoice",
            description: "Đánh dấu thu tiền và tạo hóa đơn (invoice).",
            parameters: { type: "object", properties: { bookingId: { type: "string" } }, required: ["bookingId"] }
        }
    },
    {
        type: "function",
        function: {
            name: "exportBookingsToCSV",
            description: "Tạo link tải file danh sách đặt phòng.",
            parameters: { type: "object", properties: { status: { type: "string", enum: ["all", "pending", "confirmed", "completed", "cancelled"] } } }
        }
    }
];

// ==========================================
// AGENT LOOP
// ==========================================
export async function POST(req) {
    try {
        const body = await req.json();
        const userMessage = body.message;

        const messages = [
            {
                role: "system",
                content: `
Bạn là Luna - Trợ lý quản trị khách sạn toàn năng.
QUY TẮC CỐT LÕI:
1. Gọi người dùng là "Sếp". Xưng là "Luna".
2. BẤT CỨ LÚC NÀO TRÌNH BÀY DANH SÁCH TÌM KIẾM: PHẢI trả về bằng cấu trúc HTML đẹp mắt sử dụng các thẻ <ul>, <li>, <br>, <b>. 
   KHÔNG ĐƯỢC dùng Markdown Table (| --- | --- |) vì UI chat không hỗ trợ sẽ bị lỗi hiển thị dính chữ.
   Ví dụ định dạng đúng:
   <ul style="list-style:none; padding:0; margin:0;">
     <li style="background:#f8fafc; padding:10px; border-radius:8px; margin-bottom:8px; border:1px solid #e2e8f0;">
        <b>Mã đơn:</b> #12345678 <br>
        <b>Khách:</b> Tên Khách <br>
        <b>Phòng:</b> P101 (Check-in: ... - Check-out: ...) <br>
        <b>Trạng thái:</b> ...
     </li>
   </ul>
3. Sếp có thể đưa bạn mã đơn ngắn (ví dụ: #2YE89XUC hoặc 2ye89xuc). Hãy yên tâm truyền đúng chuỗi đó vào Parameter "bookingId" của các Tool, hệ thống sẽ tự động đối chiếu tìm ra mã chuẩn cho bạn thao tác.
4. NẾU BẠN GỌI TOOL exportBookingsToCSV VÀ NHẬN ĐƯỢC HTML LINK, PHẢI IN NGUYÊN HTML ĐÓ RA ĐỂ SẾP BẤM VÀO TẢI.
`
            },
            { role: "user", content: userMessage }
        ];

        for (let step = 0; step < 7; step++) {
            const completion = await client.chat.completions.create({
                model: "openai/gpt-oss-120b:free",
                messages,
                tools,
                tool_choice: "auto"
            });

            const message = completion.choices[0].message;
            messages.push(message);

            if (!message.tool_calls || message.tool_calls.length === 0) {
                return Response.json({
                    reply: message.content || "<b>Luna đã hoàn tất lệnh của Sếp!</b>"
                });
            }

            for (const toolCall of message.tool_calls) {
                const functionName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments || "{}");
                let result = "";

                try {
                    if (functionName === "getDashboardData") result = await getDashboardData();
                    if (functionName === "searchBookings") result = await searchBookings(args);
                    if (functionName === "updateBookingStatus") result = await updateBookingStatus(args);
                    if (functionName === "deleteBookingRecord") result = await deleteBookingRecord(args);
                    if (functionName === "markPaidAndInvoice") result = await markPaidAndInvoice(args);
                    if (functionName === "exportBookingsToCSV") result = await exportBookingsToCSV(args);
                } catch (e) {
                    result = JSON.stringify({ error: e.message });
                }

                messages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
            }
        }

        return Response.json({ reply: "<b>Luna suy nghĩ quá lâu. Xin Sếp thử lại nhé!</b>" });

    } catch (error) {
        console.error("Lỗi AI API:", error);
        return Response.json({ reply: `<b>Luna gặp sự cố kết nối API. Xin Sếp kiểm tra lại!</b>` });
    }
}
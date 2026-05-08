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
// HÀM PHỤ TRỢ: TÌM ID THẬT CỦA CÁC BẢNG
// ==========================================
async function resolveBookingId(shortOrFullId) {
    const cleanStr = shortOrFullId.replace('#', '').trim().toLowerCase();
    const snap = await getDocs(collection(db, "bookings"));
    const target = snap.docs.find(d => d.id.toLowerCase() === cleanStr || d.id.toLowerCase().endsWith(cleanStr));
    if (!target) throw new Error(`Không tìm thấy đơn đặt phòng nào chứa mã '${shortOrFullId}'.`);
    return target;
}

async function resolveRoomId(roomCode) {
    const cleanStr = roomCode.trim().toLowerCase();
    const snap = await getDocs(collection(db, "rooms"));
    const target = snap.docs.find(d => (d.data().code || "").toLowerCase() === cleanStr);
    if (!target) throw new Error(`Không tìm thấy phòng nào có mã '${roomCode}'.`);
    return target;
}

async function resolveServiceId(identifier) {
    const cleanStr = identifier.replace('#', '').trim().toLowerCase();
    const snap = await getDocs(collection(db, "services"));
    const target = snap.docs.find(d => d.id.toLowerCase().includes(cleanStr) || (d.data().name || "").toLowerCase().includes(cleanStr));
    if (!target) throw new Error(`Không tìm thấy dịch vụ nào khớp với '${identifier}'.`);
    return target;
}

async function resolveCustomerId(identifier) {
    const cleanStr = identifier.replace('#', '').trim().toLowerCase();
    const snap = await getDocs(collection(db, "users"));
    const target = snap.docs.find(d => 
        d.id.toLowerCase().includes(cleanStr) || 
        (d.data().email || "").toLowerCase() === cleanStr || 
        (d.data().phone || "").toLowerCase().includes(cleanStr) ||
        (d.data().name || "").toLowerCase().includes(cleanStr)
    );
    if (!target) throw new Error(`Không tìm thấy khách hàng nào khớp với '${identifier}'. (Thử tìm bằng Tên, SĐT hoặc Email)`);
    return target;
}

// ==========================================
// THƯ VIỆN TOOLS 1: BOOKINGS & ROOMS & DASHBOARD
// ==========================================
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

        return JSON.stringify({ date: todayStr, arrivalsToday, checkOutsToday, totalRevenue, maintenanceRooms, occupancyRate: `${((occupiedCount / (rooms.length || 1)) * 100).toFixed(1)}%` });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

async function searchBookings({ query = "", status = "all" }) {
    try {
        const snap = await getDocs(collection(db, "bookings"));
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (status !== "all") results = results.filter(b => b.status === status);
        if (query) {
            const q = query.replace('#', '').toLowerCase();
            results = results.filter(b => (b.userName || "").toLowerCase().includes(q) || (b.roomCode || "").toLowerCase().includes(q) || b.id.toLowerCase().includes(q));
        }
        const compactResults = results.map(b => ({
            maDon: b.id.slice(-8).toUpperCase(), tenKhach: b.userName || b.userEmail, phong: b.roomCode,
            checkIn: b.checkIn, checkOut: b.checkOut, trangThai: b.status, thanhToan: b.paymentStatus, tongTien: b.totalPrice
        }));
        return JSON.stringify(compactResults.length > 0 ? compactResults : { message: "Không tìm thấy booking." });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

async function updateBookingStatus({ bookingId, newStatus }) {
    try {
        const targetDoc = await resolveBookingId(bookingId);
        const realId = targetDoc.id;
        const b = targetDoc.data();
        await updateDoc(doc(db, "bookings", realId), { status: newStatus, updatedAt: Timestamp.now() });
        if (b.roomId) {
            if (newStatus === "confirmed") await updateDoc(doc(db, "rooms", b.roomId), { status: "occupied" });
            if (newStatus === "completed" || newStatus === "cancelled") await updateDoc(doc(db, "rooms", b.roomId), { status: "available" });
        }
        await addDoc(collection(db, "logs"), { message: `AI đã đổi trạng thái booking ${realId.slice(-6)} -> ${newStatus}`, type: "success", user: "Luna AI", timestamp: Timestamp.now() });
        return JSON.stringify({ success: true, message: `Cập nhật booking thành ${newStatus}` });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

async function deleteBookingRecord({ bookingId }) {
    try {
        const targetDoc = await resolveBookingId(bookingId);
        await deleteDoc(doc(db, "bookings", targetDoc.id));
        return JSON.stringify({ success: true, message: `Đã xóa booking.` });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

async function markPaidAndInvoice({ bookingId }) {
    try {
        const targetDoc = await resolveBookingId(bookingId);
        const b = targetDoc.data();
        await updateDoc(doc(db, "bookings", targetDoc.id), { paymentStatus: "paid", updatedAt: Timestamp.now() });
        await addDoc(collection(db, "invoices"), { bookingId: targetDoc.id, customerName: b.userName || b.userEmail, roomCode: b.roomCode, checkIn: b.checkIn, checkOut: b.checkOut, nights: b.nights, total: b.finalPaidAmount || b.totalPrice, status: "paid", createdAt: Timestamp.now() });
        return JSON.stringify({ success: true, message: `Đã thu tiền và xuất hóa đơn.` });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

async function searchRooms({ query = "", status = "all" }) {
    try {
        const snap = await getDocs(collection(db, "rooms"));
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (status !== "all") results = results.filter(r => r.status === status);
        if (query) {
            const q = query.toLowerCase();
            results = results.filter(r => (r.code || "").toLowerCase().includes(q) || (r.name || "").toLowerCase().includes(q));
        }
        const compactResults = results.map(r => ({ maPhong: r.code, tenPhong: r.name, loai: r.type, gia: r.price, trangThai: r.status }));
        return JSON.stringify(compactResults.length > 0 ? compactResults : { message: "Không tìm thấy phòng." });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

async function updateRoomStatus({ roomCode, newStatus }) {
    try {
        const targetDoc = await resolveRoomId(roomCode);
        await updateDoc(doc(db, "rooms", targetDoc.id), { status: newStatus, updatedAt: Timestamp.now() });
        return JSON.stringify({ success: true, message: `Đổi trạng thái phòng ${roomCode} thành ${newStatus}.` });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

async function addRoom({ code, name, type, price, capacity = 2 }) {
    try {
        await addDoc(collection(db, "rooms"), { code, name, type, price: parseInt(price), capacity: parseInt(capacity), status: "available", createdAt: Timestamp.now() });
        return JSON.stringify({ success: true, message: `Tạo phòng ${code}.` });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

async function deleteRoomAction({ roomCode }) {
    try {
        const targetDoc = await resolveRoomId(roomCode);
        await deleteDoc(doc(db, "rooms", targetDoc.id));
        return JSON.stringify({ success: true, message: `Xóa phòng ${roomCode}.` });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

// ==========================================
// THƯ VIỆN TOOLS 2: QUẢN TRỊ DỊCH VỤ (SERVICES)
// ==========================================
async function searchServices({ query = "", category = "all" }) {
    try {
        const snap = await getDocs(collection(db, "services"));
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (category !== "all") {
            results = results.filter(s => {
                let sCat = "other";
                if (["utensils", "cocktail", "cake"].includes(s.icon)) sCat = "dining";
                if (["spa", "swimmer", "dumbbell"].includes(s.icon)) sCat = "wellness";
                if (["car", "motorcycle"].includes(s.icon)) sCat = "transport";
                return sCat === category;
            });
        }
        if (query) {
            const q = query.toLowerCase();
            results = results.filter(s => (s.name || "").toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q));
        }
        const compactResults = results.map(s => ({ maDV: s.id.slice(-6).toUpperCase(), tenDV: s.name, gia: s.price, donVi: s.unit, trangThai: s.available !== false ? "Đang phục vụ" : "Đã ngưng" }));
        return JSON.stringify(compactResults.length > 0 ? compactResults : { message: "Không tìm thấy dịch vụ nào khớp." });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

async function addService({ name, description = "", price, unit = "person", icon = "utensils" }) {
    try {
        await addDoc(collection(db, "services"), { name, description, price: parseInt(price), unit, icon, image: "", available: true, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), category: "other" });
        return JSON.stringify({ success: true, message: `Đã thêm dịch vụ: ${name}.` });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

async function updateServiceAvailability({ serviceIdentifier, available }) {
    try {
        const targetDoc = await resolveServiceId(serviceIdentifier);
        await updateDoc(doc(db, "services", targetDoc.id), { available, updatedAt: Timestamp.now() });
        return JSON.stringify({ success: true, message: `Đã ${available ? 'mở lại' : 'tạm ngưng'} dịch vụ ${targetDoc.data().name}` });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

async function updateServiceDetails(args) {
    try {
        const { serviceIdentifier, name, description, price, unit, icon } = args;
        const targetDoc = await resolveServiceId(serviceIdentifier);
        const updateData = { updatedAt: Timestamp.now() };
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (price !== undefined) updateData.price = parseInt(price);
        if (unit !== undefined) updateData.unit = unit;
        if (icon !== undefined) updateData.icon = icon;
        await updateDoc(doc(db, "services", targetDoc.id), updateData);
        return JSON.stringify({ success: true, message: `Cập nhật dịch vụ thành công.` });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

async function deleteServiceAction({ serviceIdentifier }) {
    try {
        const targetDoc = await resolveServiceId(serviceIdentifier);
        await deleteDoc(doc(db, "services", targetDoc.id));
        return JSON.stringify({ success: true, message: `Đã xóa dịch vụ.` });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

// ==========================================
// THƯ VIỆN TOOLS 3 MỚI: QUẢN TRỊ KHÁCH HÀNG (CUSTOMERS)
// ==========================================
async function searchCustomers({ query = "", role = "all" }) {
    try {
        const snap = await getDocs(collection(db, "users"));
        // Lọc admin ra, chỉ lấy user thường/vip/corporate
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role !== "admin");

        if (role !== "all") {
            results = results.filter(u => u.role === role);
        }

        if (query) {
            const q = query.toLowerCase();
            results = results.filter(u => 
                (u.name || "").toLowerCase().includes(q) || 
                (u.email || "").toLowerCase().includes(q) || 
                (u.phone || "").toLowerCase().includes(q)
            );
        }

        const compactResults = results.map(u => ({
            idNgan: u.id.slice(-8).toUpperCase(),
            ten: u.name || "Chưa cập nhật tên",
            email: u.email,
            sdt: u.phone || "Trống",
            hang: u.role === "vip" ? "VIP" : u.role === "corporate" ? "Doanh nghiệp" : "Thường",
            diem: u.loyaltyPoints || 0
        }));
        return JSON.stringify(compactResults.length > 0 ? compactResults : { message: "Không tìm thấy khách hàng nào khớp." });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

async function addCustomer({ name, email, phone = "", address = "", birthday = "", role = "regular", notes = "" }) {
    try {
        await addDoc(collection(db, "users"), {
            name, email, phone, address, birthday, role, notes,
            createdAt: Timestamp.now(), updatedAt: Timestamp.now()
        });
        await addDoc(collection(db, "logs"), { message: `AI đã thêm khách hàng: ${name}`, type: "success", user: "Luna AI", timestamp: Timestamp.now() });
        return JSON.stringify({ success: true, message: `Đã thêm khách hàng: ${name} (${email}).` });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

async function updateCustomerDetails(args) {
    try {
        const { customerIdentifier, name, email, phone, address, birthday, role, notes } = args;
        const targetDoc = await resolveCustomerId(customerIdentifier);
        
        const updateData = { updatedAt: Timestamp.now() };
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (address !== undefined) updateData.address = address;
        if (birthday !== undefined) updateData.birthday = birthday;
        if (role !== undefined) updateData.role = role;
        if (notes !== undefined) updateData.notes = notes;

        await updateDoc(doc(db, "users", targetDoc.id), updateData);
        await addDoc(collection(db, "logs"), { message: `AI đã cập nhật thông tin khách hàng ${targetDoc.data().name || targetDoc.data().email}`, type: "info", user: "Luna AI", timestamp: Timestamp.now() });
        return JSON.stringify({ success: true, message: `Cập nhật thông tin khách hàng thành công.` });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}

async function deleteCustomerAction({ customerIdentifier }) {
    try {
        const targetDoc = await resolveCustomerId(customerIdentifier);
        const name = targetDoc.data().name || targetDoc.data().email;
        await deleteDoc(doc(db, "users", targetDoc.id));
        await addDoc(collection(db, "logs"), { message: `AI đã xóa khách hàng ${name}`, type: "error", user: "Luna AI", timestamp: Timestamp.now() });
        return JSON.stringify({ success: true, message: `Đã xóa vĩnh viễn khách hàng ${name}.` });
    } catch (err) { return JSON.stringify({ error: err.message }); }
}


// ==========================================
// CẤU HÌNH TOOLS CHO OPENAI
// ==========================================
const tools = [
    { type: "function", function: { name: "getDashboardData", description: "Lấy tổng quan hệ thống." } },
    
    // Booking
    { type: "function", function: { name: "searchBookings", description: "Tìm kiếm booking.", parameters: { type: "object", properties: { query: { type: "string" }, status: { type: "string", enum: ["all", "pending", "confirmed", "completed", "cancelled"] } } } } },
    { type: "function", function: { name: "updateBookingStatus", description: "Đổi trạng thái Booking.", parameters: { type: "object", properties: { bookingId: { type: "string" }, newStatus: { type: "string", enum: ["confirmed", "completed", "cancelled"] } }, required: ["bookingId", "newStatus"] } } },
    { type: "function", function: { name: "deleteBookingRecord", description: "Xóa vĩnh viễn đơn đặt phòng.", parameters: { type: "object", properties: { bookingId: { type: "string" } }, required: ["bookingId"] } } },
    { type: "function", function: { name: "markPaidAndInvoice", description: "Đánh dấu thu tiền và tạo hóa đơn.", parameters: { type: "object", properties: { bookingId: { type: "string" } }, required: ["bookingId"] } } },
    
    // Room
    { type: "function", function: { name: "searchRooms", description: "Tìm kiếm danh sách phòng.", parameters: { type: "object", properties: { query: { type: "string" }, status: { type: "string", enum: ["all", "available", "occupied", "maintenance"] } } } } },
    { type: "function", function: { name: "updateRoomStatus", description: "Cập nhật trạng thái của phòng.", parameters: { type: "object", properties: { roomCode: { type: "string" }, newStatus: { type: "string", enum: ["available", "occupied", "maintenance"] } }, required: ["roomCode", "newStatus"] } } },
    { type: "function", function: { name: "addRoom", description: "Thêm phòng mới.", parameters: { type: "object", properties: { code: { type: "string" }, name: { type: "string" }, type: { type: "string" }, price: { type: "number" } }, required: ["code", "name", "type", "price"] } } },
    { type: "function", function: { name: "deleteRoomAction", description: "Xóa phòng.", parameters: { type: "object", properties: { roomCode: { type: "string" } }, required: ["roomCode"] } } },

    // Services
    { type: "function", function: { name: "searchServices", description: "Tìm kiếm Dịch vụ.", parameters: { type: "object", properties: { query: { type: "string" }, category: { type: "string", enum: ["all", "dining", "wellness", "transport"] } } } } },
    { type: "function", function: { name: "addService", description: "Thêm Dịch vụ mới.", parameters: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, price: { type: "number" }, unit: { type: "string", enum: ["person", "room", "hour", "day"] }, icon: { type: "string" } }, required: ["name", "price"] } } },
    { type: "function", function: { name: "updateServiceAvailability", description: "Mở lại hoặc Tạm ngưng dịch vụ.", parameters: { type: "object", properties: { serviceIdentifier: { type: "string" }, available: { type: "boolean" } }, required: ["serviceIdentifier", "available"] } } },
    { type: "function", function: { name: "updateServiceDetails", description: "Sửa thông tin Dịch vụ.", parameters: { type: "object", properties: { serviceIdentifier: { type: "string" }, name: { type: "string" }, description: { type: "string" }, price: { type: "number" }, unit: { type: "string" }, icon: { type: "string" } }, required: ["serviceIdentifier"] } } },
    { type: "function", function: { name: "deleteServiceAction", description: "Xóa Dịch vụ.", parameters: { type: "object", properties: { serviceIdentifier: { type: "string" } }, required: ["serviceIdentifier"] } } },

    // Customers
    {
        type: "function",
        function: {
            name: "searchCustomers",
            description: "Tìm kiếm hoặc lọc danh sách Khách hàng.",
            parameters: {
                type: "object",
                properties: { 
                    query: { type: "string", description: "Tên, SĐT, hoặc Email khách hàng" },
                    role: { type: "string", enum: ["all", "regular", "vip", "corporate"], description: "Hạng thành viên" }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "addCustomer",
            description: "Thêm hồ sơ Khách hàng mới.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    email: { type: "string" },
                    phone: { type: "string" },
                    address: { type: "string" },
                    birthday: { type: "string" },
                    role: { type: "string", enum: ["regular", "vip", "corporate"] },
                    notes: { type: "string" }
                },
                required: ["name", "email"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "updateCustomerDetails",
            description: "Cập nhật/Sửa thông tin hồ sơ Khách hàng (SĐT, nâng hạng VIP...).",
            parameters: {
                type: "object",
                properties: {
                    customerIdentifier: { type: "string", description: "Mã KH, Tên, SĐT hoặc Email" },
                    name: { type: "string" },
                    email: { type: "string" },
                    phone: { type: "string" },
                    address: { type: "string" },
                    birthday: { type: "string" },
                    role: { type: "string", enum: ["regular", "vip", "corporate"] },
                    notes: { type: "string" }
                },
                required: ["customerIdentifier"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "deleteCustomerAction",
            description: "Xóa vĩnh viễn hồ sơ Khách hàng.",
            parameters: { type: "object", properties: { customerIdentifier: { type: "string" } }, required: ["customerIdentifier"] }
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
2. TRÌNH BÀY DANH SÁCH (Booking, Phòng, Dịch vụ, Khách hàng): LUÔN dùng HTML (<ul>, <li>, <b>). Không dùng Markdown Table.
   Ví dụ định dạng cho KHÁCH HÀNG:
   <ul style="list-style:none; padding:0; margin:0;">
     <li style="background:#f8fafc; padding:10px; border-radius:8px; margin-bottom:8px; border:1px solid #e2e8f0;">
        <b>Khách hàng:</b> Nguyễn Văn A (VIP) <br>
        <b>Liên hệ:</b> 0901234567 | email@gmail.com <br>
     </li>
   </ul>
3. VỚI KHÁCH HÀNG (CUSTOMERS): Sếp có thể dùng TÊN, SĐT hoặc EMAIL để yêu cầu Sửa/Xóa. (Ví dụ: "Thăng hạng VIP cho khách hàng Nguyễn Văn A" hoặc "Xóa khách hàng có sđt 090..."). Truyền vào "customerIdentifier".
4. Tự động gọi Tool phù hợp với ngữ cảnh yêu cầu.
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
                    // Bookings
                    if (functionName === "getDashboardData") result = await getDashboardData();
                    if (functionName === "searchBookings") result = await searchBookings(args);
                    if (functionName === "updateBookingStatus") result = await updateBookingStatus(args);
                    if (functionName === "deleteBookingRecord") result = await deleteBookingRecord(args);
                    if (functionName === "markPaidAndInvoice") result = await markPaidAndInvoice(args);
                    
                    // Rooms
                    if (functionName === "searchRooms") result = await searchRooms(args);
                    if (functionName === "updateRoomStatus") result = await updateRoomStatus(args);
                    if (functionName === "addRoom") result = await addRoom(args);
                    if (functionName === "deleteRoomAction") result = await deleteRoomAction(args);

                    // Services
                    if (functionName === "searchServices") result = await searchServices(args);
                    if (functionName === "addService") result = await addService(args);
                    if (functionName === "updateServiceAvailability") result = await updateServiceAvailability(args);
                    if (functionName === "updateServiceDetails") result = await updateServiceDetails(args);
                    if (functionName === "deleteServiceAction") result = await deleteServiceAction(args);

                    // Customers
                    if (functionName === "searchCustomers") result = await searchCustomers(args);
                    if (functionName === "addCustomer") result = await addCustomer(args);
                    if (functionName === "updateCustomerDetails") result = await updateCustomerDetails(args);
                    if (functionName === "deleteCustomerAction") result = await deleteCustomerAction(args);

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
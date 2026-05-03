// src/app/api/chat/route.js
import OpenAI from "openai";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";

const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
});

// CÁC HÀM XỬ LÝ DATABASE CHO AI (Trả về định dạng HTML)
async function checkRoomAvailability() {
    const q = query(collection(db, "rooms"), where("status", "==", "available"));
    const snap = await getDocs(q);
    if (snap.empty) return "Hiện tại không còn phòng nào trống.";
    
    const rooms = snap.docs.map(doc => {
        const data = doc.data();
        return `<li><b>Phòng ${data.type} (Mã: ${data.code})</b> - <b>${data.price.toLocaleString('vi-VN')} VNĐ/đêm</b> <br/><a href="/rooms/${doc.id}" style="color:#2563eb; text-decoration:none; font-weight:600; font-size:12px; background:#eff6ff; padding:4px 10px; border-radius:12px; display:inline-block; margin-top:4px;">Xem chi tiết</a> <a href="/booking?roomId=${doc.id}" style="color:white; text-decoration:none; font-weight:600; font-size:12px; background:#10b981; padding:4px 10px; border-radius:12px; display:inline-block; margin-top:4px; margin-left:4px;">Đặt phòng ngay</a></li>`;
    });
    return "<ul style='margin-left: 20px; list-style-type: disc; margin-top: 8px; margin-bottom: 8px; line-height: 1.8;'>" + rooms.join("") + "</ul>";
}

async function lookupBookingByIdAndEmail(bookingId, email) {
    try {
        const docRef = doc(db, "bookings", bookingId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return `Xin lỗi Quý khách, Luna không tìm thấy đơn đặt phòng có mã <b>${bookingId}</b> trong hệ thống.`;
        
        const data = docSnap.data();
        if (data.userEmail !== email) return `Email <b>${email}</b> không khớp với mã đặt phòng này.`;

        let statusColor = data.status === "completed" ? "color:#10b981" : data.status === "cancelled" ? "color:#ef4444" : "color:#f59e0b";
        
        return `Đã tìm thấy đơn của Quý khách! <br/><br/><b>Phòng:</b> ${data.roomCode} <br/><b>Nhận phòng:</b> ${data.checkIn} <br/><b>Trả phòng:</b> ${data.checkOut} <br/><b>Tổng tiền:</b> ${data.totalPrice.toLocaleString('vi-VN')} VNĐ <br/><b>Trạng thái:</b> <span style="font-weight:bold; ${statusColor}; text-transform:uppercase;">${data.status}</span>`;
    } catch (error) {
        return "Luna đang gặp chút sự cố khi tra cứu mã đơn. Quý khách vui lòng thử lại sau nhé.";
    }
}

async function getMyBookings(userEmail) {
    if (!userEmail) return "Lỗi: Khách chưa đăng nhập. Hãy yêu cầu khách đăng nhập để xem lịch sử.";
    const q = query(collection(db, "bookings"), where("userEmail", "==", userEmail));
    const snap = await getDocs(q);
    if (snap.empty) return "Luna kiểm tra thì thấy Quý khách chưa có đơn đặt phòng nào trên hệ thống ạ.";

    const bookings = snap.docs.map(doc => {
        const d = doc.data();
        let statusText = d.status === "completed" ? "Đã hoàn thành" : d.status === "cancelled" ? "Đã hủy" : "Sắp tới";
        return `<li style="margin-bottom: 6px;"><b>Phòng ${d.roomCode}</b> (Mã đơn: <span style="font-family:monospace; background:#f1f5f9; padding:2px 6px; border-radius:4px;">${doc.id.slice(-6).toUpperCase()}</span>) - <b>Ngày:</b> ${d.checkIn} - <b>Trạng thái:</b> ${statusText}</li>`;
    });
    return "<ul style='margin-left: 20px; list-style-type: disc; margin-top: 8px; margin-bottom: 8px; line-height: 1.6;'>" + bookings.join("") + "</ul>";
}

// KHAI BÁO CÔNG CỤ CHO AI (TOOLS)
const tools = [
    {
        type: "function",
        function: {
            name: "checkRoomAvailability",
            description: "Lấy danh sách các phòng đang trống để báo giá và báo tình trạng cho khách.",
        }
    },
    {
        type: "function",
        function: {
            name: "lookupBookingByIdAndEmail",
            description: "Tra cứu thông tin đặt phòng khi khách cung cấp mã đặt phòng và email.",
            parameters: {
                type: "object",
                properties: {
                    bookingId: { type: "string", description: "Mã ID đặt phòng" },
                    email: { type: "string", description: "Email của khách đặt" }
                },
                required: ["bookingId", "email"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getMyBookings",
            description: "Lấy lịch sử tất cả các đơn đặt phòng của tài khoản đang đăng nhập.",
            parameters: {
                type: "object",
                properties: {},
            }
        }
    }
];

export async function POST(req) {
    try {
        const body = await req.json();
        const userMessage = body.message;
        const userEmail = body.userEmail;

        // TẠO NHÂN CÁCH VÀ QUY TẮC HIỂN THỊ DÀNH CHO AI
        const messages = [
            {
                role: "system",
                content: `
Bạn là Luna, Lễ tân AI của Luna Hotel & Resort.
Phong cách: Chuyên nghiệp, ấm áp, gọi khách là "Quý khách", xưng là "Luna".
Nếu khách đã đăng nhập, tài khoản của họ là: ${userEmail || "Chưa đăng nhập"}.

QUY TẮC ĐỊNH DẠNG VÀ TẠO LINK (RẤT QUAN TRỌNG):
1. BẠN PHẢI SỬ DỤNG HTML ĐỂ TRÌNH BÀY CÂU TRẢ LỜI. Tuyệt đối KHÔNG dùng Markdown (*, -, #).
2. Dùng thẻ <b>...</b> để in đậm các từ khóa quan trọng (Mã đơn, Tên phòng, Ngày tháng).
3. Dùng thẻ <br/> để xuống dòng.
4. Dùng thẻ <ul> và <li> để tạo danh sách nếu cần liệt kê.
5. Khi chào khách đã đăng nhập, hãy gọi tên họ bằng cách lấy phần trước ký tự @ của email.
6. Nếu bạn tự tư vấn phòng ngoài tool, luôn đính kèm link HTML: <a href="/rooms/[ID_PHONG]" style="color: blue; text-decoration: underline;">Xem chi tiết</a>
7. Nếu khách muốn đặt phòng ngay (ngoài tool): <a href="/booking?roomId=[ID_PHONG]" style="color: green; font-weight: bold; text-decoration: underline;">Đặt phòng ngay</a>

Thông tin chung:
- Khách sạn 5 sao view biển. Dịch vụ: Spa, Buffet sáng, Nhà hàng hải sản, Hồ bơi vô cực.
- Nếu khách hỏi những thông tin có thể tra cứu (Tìm đơn, lịch sử, phòng trống), hãy gọi Tools để lấy dữ liệu thực tế.

Trả lời lịch sự và tự nhiên. KHÔNG để lộ việc bạn dùng công cụ.
`
            },
            { role: "user", content: userMessage }
        ];

        // GỌI AI LẦN 1
        const completion = await client.chat.completions.create({
            model: "deepseek/deepseek-chat",
            messages: messages,
            tools: tools,
            tool_choice: "auto"
        });

        const responseMessage = completion.choices[0].message;

        // NẾU AI QUYẾT ĐỊNH DÙNG TOOL
        if (responseMessage.tool_calls) {
            messages.push(responseMessage); // Lưu lịch sử cho AI hiểu ngữ cảnh

            for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                let functionResult = "";

                if (functionName === "checkRoomAvailability") {
                    functionResult = await checkRoomAvailability();
                } else if (functionName === "lookupBookingByIdAndEmail") {
                    functionResult = await lookupBookingByIdAndEmail(args.bookingId, args.email);
                } else if (functionName === "getMyBookings") {
                    functionResult = await getMyBookings(userEmail);
                }

                // Gửi kết quả tool về lại AI
                messages.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: functionResult,
                });
            }

            // GỌI AI LẦN 2 để xử lý kết quả
            const secondResponse = await client.chat.completions.create({
                model: "deepseek/deepseek-chat",
                messages: messages,
            });

            return Response.json({ reply: secondResponse.choices[0].message.content });
        }

        // Nếu Chat thông thường (không dùng Tool)
        return Response.json({ reply: responseMessage.content });

    } catch (error) {
        console.error("Lỗi AI Agent:", error);
        return Response.json({
            reply: "Xin lỗi Quý khách, hệ thống của Luna đang bận. Vui lòng thử lại sau ạ."
        });
    }
}
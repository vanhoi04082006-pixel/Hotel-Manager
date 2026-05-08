// src/app/api/chat/route.js
import OpenAI from "openai";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, query, where } from "firebase/firestore"; // Đã bỏ getDoc vì không dùng trực tiếp ID nữa

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
        return `<li style="margin-bottom: 8px;"><b>Phòng ${data.type} (Mã: ${data.code})</b> - <b>${data.price.toLocaleString('vi-VN')} VNĐ/đêm</b> <br/><a href="/rooms/${doc.id}" style="color:#2563eb; text-decoration:none; font-weight:600; font-size:12px; background:#eff6ff; padding:4px 10px; border-radius:12px; display:inline-block; margin-top:4px;">Xem chi tiết</a> <a href="/booking?roomId=${doc.id}" style="color:white; text-decoration:none; font-weight:600; font-size:12px; background:#10b981; padding:4px 10px; border-radius:12px; display:inline-block; margin-top:4px; margin-left:4px;">Đặt phòng ngay</a></li>`;
    });
    return "<ul style='margin-left: 20px; list-style-type: disc; margin-top: 8px; margin-bottom: 8px; line-height: 1.8;'>" + rooms.join("") + "</ul>";
}

// ĐÃ SỬA LỖI: Tìm theo Email trước, sau đó đối chiếu đuôi ID
async function lookupBookingByIdAndEmail(bookingId, email) {
    try {
        // Làm sạch dữ liệu đầu vào: Xóa khoảng trắng, xóa dấu # và viết hoa
        const cleanId = bookingId.replace("#", "").trim().toUpperCase();
        const cleanEmail = email.trim().toLowerCase();

        // 1. Lấy tất cả đơn của Email này
        const q = query(collection(db, "bookings"), where("userEmail", "==", cleanEmail));
        const snap = await getDocs(q);

        if (snap.empty) return `Xin lỗi Quý khách, Luna không tìm thấy bất kỳ đơn đặt phòng nào dưới email <b>${cleanEmail}</b>.`;

        // 2. Tìm xem có đơn nào có đuôi ID trùng với mã khách nhập không
        let foundBooking = null;
        snap.forEach(doc => {
            if (doc.id.toUpperCase().endsWith(cleanId)) {
                foundBooking = { id: doc.id, ...doc.data() };
            }
        });

        if (!foundBooking) return `Đã tìm thấy email <b>${cleanEmail}</b> trong hệ thống, nhưng không có đơn nào khớp với mã <b>#${cleanId}</b>. Quý khách vui lòng kiểm tra lại mã đơn ạ.`;

        let statusColor = foundBooking.status === "completed" ? "color:#10b981" : foundBooking.status === "cancelled" ? "color:#ef4444" : "color:#f59e0b";
        
        return `Đã tìm thấy đơn của Quý khách! <br/><br/><b>Mã đơn:</b> #${foundBooking.id.slice(-6).toUpperCase()} <br/><b>Phòng:</b> ${foundBooking.roomCode} <br/><b>Nhận phòng:</b> ${foundBooking.checkIn} <br/><b>Trả phòng:</b> ${foundBooking.checkOut} <br/><b>Tổng tiền:</b> ${foundBooking.totalPrice.toLocaleString('vi-VN')} VNĐ <br/><b>Trạng thái:</b> <span style="font-weight:bold; ${statusColor}; text-transform:uppercase;">${foundBooking.status}</span>`;
    } catch (error) {
        return "Luna đang gặp chút sự cố khi tra cứu hệ thống. Quý khách vui lòng thử lại sau nhé.";
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
            parameters: { type: "object", properties: {} } // Thêm properties rỗng để chống lỗi DeepSeek
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
                    bookingId: { type: "string", description: "Mã ID đặt phòng (Ví dụ: YYU4KDJB)" },
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
            parameters: { type: "object", properties: {} } // Thêm properties rỗng
        }
    }
];

export async function POST(req) {
    try {
        const body = await req.json();
        const userMessage = body.message;
        const userEmail = body.userEmail;

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
6. Khi có dữ liệu trả về từ tools, hãy phản hồi lại cho khách tự nhiên nhất có thể.

Thông tin chung:
- Khách sạn 5 sao view biển. Dịch vụ: Spa, Buffet sáng, Nhà hàng hải sản, Hồ bơi vô cực.
- Nếu khách hỏi những thông tin có thể tra cứu (Tìm đơn, lịch sử, phòng trống), hãy gọi Tools để lấy dữ liệu thực tế.
`
            },
            { role: "user", content: userMessage }
        ];

        const completion = await client.chat.completions.create({
            model: "openai/gpt-oss-120b:free",
            messages: messages,
            tools: tools,
            tool_choice: "auto",
        });

        const responseMessage = completion.choices[0].message;
        let toolCalls = responseMessage.tool_calls || [];
        let responseContent = responseMessage.content || "";

        // =========================================================
        // BỘ LỌC CHỐNG ẢO GIÁC DEEPSEEK (Bắt buộc phải có)
        // =========================================================
        if (!toolCalls.length && responseContent.includes("!function_call:")) {
            try {
                const match = responseContent.match(/!function_call:\s*(\{[\s\S]*?\})/);
                if (match) {
                    const parsedTool = JSON.parse(match[1]);
                    toolCalls = [{
                        id: "call_" + Math.random().toString(36).substring(7),
                        type: "function",
                        function: {
                            name: parsedTool.call,
                            arguments: JSON.stringify(parsedTool.arguments || {})
                        }
                    }];
                    responseMessage.content = responseContent.replace(/!function_call:\s*(\{[\s\S]*?\})/, "").trim();
                }
            } catch (e) { console.error("Lỗi parse function_call:", e); }
        }

        // NẾU AI QUYẾT ĐỊNH DÙNG TOOL
        if (toolCalls.length > 0) {
            messages.push({
                role: "assistant",
                content: responseMessage.content || null,
                tool_calls: toolCalls
            }); 

            for (const toolCall of toolCalls) {
                const functionName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments || "{}");
                let functionResult = "";

                if (functionName === "checkRoomAvailability") {
                    functionResult = await checkRoomAvailability();
                } else if (functionName === "lookupBookingByIdAndEmail") {
                    functionResult = await lookupBookingByIdAndEmail(args.bookingId, args.email);
                } else if (functionName === "getMyBookings") {
                    functionResult = await getMyBookings(userEmail);
                }

                messages.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: functionResult,
                });
            }

            // GỌI AI LẦN 2 để xử lý kết quả
            const secondResponse = await client.chat.completions.create({
                model: "openai/gpt-oss-120b:free",
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
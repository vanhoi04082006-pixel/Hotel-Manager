// src/app/api/send-email/route.js
import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const { customerName, customerEmail, roomCode, checkIn, checkOut, totalPrice, bookingId } = body;

    // 1. Cấu hình "Người vận chuyển" (Transporter) sử dụng Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // 2. Giao diện Email HTML
    const htmlContent = `
      <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px;">
        <h1 style="color: #2563eb; text-align: center;">Luna Hotel & Resort</h1>
        <h2>Chào ${customerName},</h2>
        <p>Cảm ơn bạn đã tin tưởng lựa chọn chúng tôi cho kỳ nghỉ của mình.</p>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #e2e8f0;">
          <h3 style="margin-top: 0; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 10px;">Chi tiết đặt phòng:</h3>
          <p><strong>Mã đặt phòng:</strong> <span style="color: #2563eb; font-family: monospace; font-size: 16px;">#${bookingId}</span></p>
          <p><strong>Phòng:</strong> ${roomCode}</p>
          <p><strong>Nhận phòng:</strong> ${checkIn}</p>
          <p><strong>Trả phòng:</strong> ${checkOut}</p>
          <p style="font-size: 18px; border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 10px;">
            <strong>Tổng thanh toán:</strong> <span style="color: #059669;">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalPrice)}</span>
          </p>
        </div>
        
        <p>Chúng tôi sẽ liên hệ với bạn qua số điện thoại để xác nhận lại thông tin trong thời gian sớm nhất.</p>
        <p>Trân trọng,<br/><strong>Đội ngũ Luna Hotel</strong></p>
      </div>
    `;

    // 3. Đóng gói và gửi thư
    const mailOptions = {
      from: `"Luna Hotel Booking" <${process.env.GMAIL_USER}>`,
      to: customerEmail, // Gửi cho BẤT KỲ email nào khách nhập vào form
      subject: `[Luna Hotel] Xác nhận đặt phòng #${bookingId} thành công`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("Lỗi gửi email:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


// This is an example of how to use the Resend API to send an email in a Next.js API route.

// import { Resend } from 'resend';
// import { NextResponse } from 'next/server'; // <-- Sửa 'next/next' thành 'next/server' ở đây

// const resend = new Resend(process.env.RESEND_API_KEY);

// export async function POST(req) {
//   try {
//     const body = await req.json();
//     const { customerName, customerEmail, roomCode, checkIn, checkOut, totalPrice, bookingId } = body;

//     const { data, error } = await resend.emails.send({
//       from: 'Luna Hotel <onboarding@resend.dev>', 
//       to: [customerEmail],
//       subject: `Xác nhận đặt phòng thành công - Mã đơn: #${bookingId}`,
//       html: `
//         <div style="font-family: sans-serif; padding: 20px; color: #333;">
//           <h1 style="color: #2563eb;">Chào ${customerName},</h1>
//           <p>Cảm ơn bạn đã tin tưởng lựa chọn <strong>Luna Hotel & Resort</strong> cho kỳ nghỉ của mình.</p>
//           <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0;">
//             <h2 style="margin-top: 0;">Thông tin đặt phòng:</h2>
//             <p><strong>Mã đặt phòng:</strong> #${bookingId}</p>
//             <p><strong>Phòng:</strong> ${roomCode}</p>
//             <p><strong>Thời gian:</strong> ${checkIn} đến ${checkOut}</p>
//             <p><strong>Tổng thanh toán:</strong> ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalPrice)}</p>
//           </div>
//           <p>Chúng tôi sẽ liên hệ với bạn qua số điện thoại để xác nhận lại thông tin trong vòng 15 phút.</p>
//           <hr />
//           <p style="font-size: 12px; color: #666;">Luna Hotel - 123 Đường Ven Biển, Nha Trang.</p>
//         </div>
//       `,
//     });

//     if (error) {
//       return NextResponse.json({ error }, { status: 500 });
//     }

//     return NextResponse.json({ data });
//   } catch (error) {
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }
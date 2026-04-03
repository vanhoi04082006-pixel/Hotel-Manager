// src/app/layout.jsx
import "./globals.css";

export const metadata = {
  title: "Luna Hotel - Tuyệt Tác Nghỉ Dưỡng",
  description: "Trải nghiệm không gian nghỉ dưỡng đẳng cấp 5 sao",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <head>
        {/* Vẫn giữ Tailwind CDN để tương thích code cũ của bạn nhanh nhất */}
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div id="toast-container" className="fixed top-5 right-5 z-[9998] space-y-3"></div>
        {children}
      </body>
    </html>
  );
}
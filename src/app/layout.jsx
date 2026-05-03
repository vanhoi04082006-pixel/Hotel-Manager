import "./globals.css";
import AIChatbot from "@/components/AIChatbot";

export const metadata = {
  title: "Luna Hotel - Tuyệt Tác Nghỉ Dưỡng",
  description: "Trải nghiệm không gian nghỉ dưỡng đẳng cấp 5 sao",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body className="font-sans">
        {/* Tailwind CDN */}
        <script src="https://cdn.tailwindcss.com"></script>

        {/* Icons */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />

        {/* Fonts */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap"
        />

        <div
          id="toast-container"
          className="fixed top-5 right-5 z-[9998] space-y-3"
        ></div>

        {children}

        <AIChatbot />
      </body>
    </html>
  );
}
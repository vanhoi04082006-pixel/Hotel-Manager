// src/components/ChatbotWrapper.jsx
"use client";

import { usePathname } from "next/navigation";
import AIChatbot from "./AIChatbot";

export default function ChatbotWrapper() {
  const pathname = usePathname();

  // Nếu đang ở trong thư mục /admin thì KHÔNG hiển thị con bot của khách
  if (pathname && pathname.startsWith("/admin")) {
    return null;
  }

  return <AIChatbot />;
}
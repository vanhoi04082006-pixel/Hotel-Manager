// src/components/AdminAIChatbot.jsx
"use client";

import { useState, useRef, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

// Thay đổi avatar AI thành ảnh GIF viên ngọc rồng
const ADMIN_AVATAR = "https://nro1999.online/img/v0.gif";

// Component Nút Mở Chat - Tích hợp vòng xoay Ngọc Rồng
const OrbitChatButton = ({ onClick }) => {
    const orbitRef = useRef(null);

    useEffect(() => {
        const icons = orbitRef.current?.querySelectorAll('.orbit-icon');
        if (!icons) return;
        
        // Bán kính xoay nhỏ lại để vừa làm nút bấm
        const radius = window.innerWidth <= 768 ? 45 : 55; 
        const baseAngles = Array.from(icons).map((_, i) => (360 / icons.length) * i);
        let animationFrameId;

        function frame(ts) {
            const angle = (ts / 15000) * 360;
            icons.forEach((icon, i) => {
                const a = (baseAngles[i] + angle) * Math.PI / 180;
                icon.style.transform = `translate(calc(-50% + ${Math.cos(a) * radius}px), calc(-50% + ${Math.sin(a) * radius}px))`;
                icon.style.top = '50%';
                icon.style.left = '50%';
            });
            animationFrameId = requestAnimationFrame(frame);
        }
        animationFrameId = requestAnimationFrame(frame);
        
        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    return (
        <button 
            onClick={onClick} 
            ref={orbitRef}
            className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center group hover:scale-110 transition-transform duration-300 mt-auto drop-shadow-[0_10px_20px_rgba(255,109,0,0.3)]"
        >
            {/* CSS Tùy chỉnh riêng cho vòng xoay */}
            <style>{`
                .orbit-ring-btn { position: absolute; inset: 10px; border-radius: 50%; border: 1.5px dashed rgba(255, 213, 79, 0.4); animation: orbit-spin 20s linear infinite; }
                .center-gif-btn { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 55px; height: 55px; border-radius: 50%; border: 2px solid #ffd54f; box-shadow: 0 0 20px rgba(255, 213, 79, 0.6), inset 0 0 10px rgba(255, 213, 79, 0.3); object-fit: cover; z-index: 10; animation: pulse-glow-btn 3s ease-in-out infinite; }
                .orbit-icon { position: absolute; width: 22px; height: 22px; border-radius: 50%; border: 1px solid rgba(255, 213, 79, 0.6); box-shadow: 0 0 10px rgba(255, 213, 79, 0.4); object-fit: cover; background: #04142b; transition: 0.3s; }
                .group:hover .orbit-icon { box-shadow: 0 0 15px rgba(255, 109, 0, 0.8); }
                @keyframes orbit-spin { 100% { transform: rotate(360deg); } }
                @keyframes pulse-glow-btn { 0%, 100% { box-shadow: 0 0 15px rgba(255, 213, 79, 0.5); } 50% { box-shadow: 0 0 30px rgba(255, 109, 0, 0.8); } }
            `}</style>
            
            <div className="orbit-ring-btn group-hover:border-[rgba(255,109,0,0.6)] transition-colors"></div>
            <img className="center-gif-btn" src="https://nro1999.online/img/v0.gif" alt="Dragon Ball" />
            <img className="orbit-icon" src="https://nro1999.online/img/112.png" alt="icon1" />
            <img className="orbit-icon" src="https://nro1999.online/img/113.png" alt="icon2" />
            <img className="orbit-icon" src="https://nro1999.online/img/114.png" alt="icon3" />
            <img className="orbit-icon" src="https://nro1999.online/img/115.png" alt="icon4" />
            <img className="orbit-icon" src="https://nro1999.online/img/116.png" alt="icon5" />
            <img className="orbit-icon" src="https://nro1999.online/img/117.png" alt="icon6" />
            <img className="orbit-icon" src="https://nro1999.online/img/118.png" alt="icon7" />
            
        </button>
    );
}

export default function AdminAIChatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [adminEmail, setAdminEmail] = useState(null);

    const defaultMessage = {
        role: "ai",
        text: "Xin chào Đấng Toàn Năng! Rồng Thần đã sẵn sàng. Sếp cần tra cứu doanh thu, xem danh sách phòng hay kiểm tra đơn hàng nào ạ?"
    };

    const [messages, setMessages] = useState([]);
    const endRef = useRef(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setAdminEmail(user ? user.email : null);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const storageKey = 'luna_admin_chat';
        try {
            const savedChat = localStorage.getItem(storageKey);
            if (savedChat) setMessages(JSON.parse(savedChat));
            else setMessages([defaultMessage]);
        } catch { setMessages([defaultMessage]); }
    }, []);

    useEffect(() => {
        if (messages.length > 1) {
            localStorage.setItem('luna_admin_chat', JSON.stringify(messages));
        }
    }, [messages]);

    useEffect(() => {
        if (isOpen) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }, [messages, loading, isOpen]);

    const handleClearChat = () => {
        if (confirm("Sếp muốn xóa toàn bộ lịch sử trò chuyện Admin không?")) {
            localStorage.removeItem('luna_admin_chat');
            setMessages([defaultMessage]);
        }
    };

    async function sendMessage(e) {
        e.preventDefault();
        if (!input.trim()) return;

        const userText = input.trim();
        setMessages(prev => [...prev, { role: "user", text: userText }]);
        setInput("");
        setLoading(true);

        try {
            const res = await fetch("/api/admin-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userText, adminEmail: adminEmail })
            });
            const data = await res.json();
            setMessages(prev => [...prev, { role: "ai", text: data.reply || "Đã nhận lệnh thưa sếp." }]);
        } catch {
            setMessages(prev => [...prev, { role: "ai", text: "Rồng Thần đang bận, sếp thử lại sau nhé." }]);
        }
        setLoading(false);
    }

    return (
        <div className="fixed bottom-2 right-2 sm:bottom-4 sm:right-4 z-[9999] font-sans flex flex-col items-end">
            {isOpen && (
                <div className="mb-2 w-[calc(100vw-1rem)] sm:w-[400px] md:w-[450px] h-[calc(100vh-8rem)] max-h-[650px] rounded-[24px] sm:rounded-[32px] overflow-hidden border border-orange-500/30 bg-white/95 backdrop-blur-3xl shadow-[0_30px_80px_rgba(255,109,0,0.2)] flex flex-col animate-in slide-in-from-bottom-5 fade-in duration-300 origin-bottom-right">
                    {/* HEADER ADMIN (Tone NRO - Cam/Xanh Đen) */}
                    <div className="relative px-4 sm:px-5 py-3 sm:py-4 bg-gradient-to-r from-[#04142b] via-[#0a4fa3] to-[#04142b] text-white shrink-0 shadow-md z-10 border-b border-[rgba(77,184,255,0.3)]">
                        <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="relative shrink-0">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-xl border border-[#ffd54f]/50 flex items-center justify-center overflow-hidden">
                                        <img src={ADMIN_AVATAR} alt="Admin AI" className="w-full h-full object-cover" />
                                    </div>
                                    <span className="absolute bottom-0 right-0 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-[#52c41a] border-2 border-[#04142b]"></span>
                                </div>
                                <div>
                                    <h2 className="font-bold text-[15px] sm:text-[16px] text-[#ffd54f] tracking-wide line-clamp-1 drop-shadow-md">Rồng Thần AI</h2>
                                    <p className="text-[10px] sm:text-[11px] text-[#4db8ff] uppercase tracking-widest font-medium">Quyền Quản Trị</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                <button onClick={handleClearChat} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 transition-all text-xs flex items-center justify-center">
                                    <i className="fa-solid fa-trash-can"></i>
                                </button>
                                <button onClick={() => setIsOpen(false)} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-rose-500 hover:text-white transition-all text-xs flex items-center justify-center">
                                    <i className="fa-solid fa-xmark text-sm"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* BODY */}
                    <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 bg-slate-50/50 space-y-4 sm:space-y-5 custom-scrollbar">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                {msg.role === "ai" && (
                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#04142b] border border-[#ffd54f]/30 flex items-center justify-center mr-2 shrink-0 overflow-hidden">
                                        <img src={ADMIN_AVATAR} alt="AI" className="w-[120%] h-[120%] object-cover" />
                                    </div>
                                )}
                                <div className={`max-w-[85%] sm:max-w-[90%] px-4 sm:px-5 py-2.5 sm:py-3.5 text-[13px] sm:text-[14px] leading-relaxed shadow-sm animate-[fadeUp_.3s_ease_out] break-words ${msg.role === "user" ? "bg-gradient-to-br from-[#1e7ee8] to-[#0a4fa3] text-white rounded-[20px] sm:rounded-[24px] rounded-br-sm" : "bg-white text-slate-700 border border-slate-200 rounded-[20px] sm:rounded-[24px] rounded-bl-sm"}`} dangerouslySetInnerHTML={msg.role === "ai" ? { __html: msg.text } : undefined}>
                                    {msg.role === "user" ? msg.text : null}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start items-end">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#04142b] border border-[#ffd54f]/30 flex items-center justify-center mr-2 overflow-hidden">
                                    <img src={ADMIN_AVATAR} alt="AI" className="w-[120%] h-[120%] object-cover" />
                                </div>
                                <div className="bg-white border border-slate-200 rounded-[20px] sm:rounded-[24px] rounded-bl-sm px-4 sm:px-5 py-3 sm:py-4 shadow-sm flex gap-1.5 sm:gap-2">
                                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#ff6d00] animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#ff6d00] animate-bounce" style={{ animationDelay: "0.15s" }}></span>
                                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#ff6d00] animate-bounce" style={{ animationDelay: "0.3s" }}></span>
                                </div>
                            </div>
                        )}
                        <div ref={endRef} className="h-1 sm:h-2"></div>
                    </div>

                    {/* FORM */}
                    <form onSubmit={sendMessage} className="p-3 sm:p-4 bg-white border-t border-slate-100 shrink-0">
                        <div className="flex items-center gap-2 bg-slate-50/80 rounded-full border border-slate-200 p-1 sm:p-1.5 focus-within:border-[#4db8ff] focus-within:bg-white focus-within:shadow-sm transition-all">
                            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Nhập lệnh cho Rồng Thần..." className="flex-1 bg-transparent outline-none px-3 sm:px-4 py-2 text-[13px] sm:text-[14px] text-slate-700 font-medium w-full" />
                            <button type="submit" disabled={!input.trim() || loading} className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full bg-gradient-to-r from-[#ff6d00] to-[#ffd54f] text-[#04142b] hover:scale-105 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
                                <i className="fa-solid fa-paper-plane text-xs"></i>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* HIỂN THỊ NÚT ORBIT KHI ĐÓNG CHAT */}
            {!isOpen && (
                <OrbitChatButton onClick={() => setIsOpen(true)} />
            )}
        </div>
    );
}
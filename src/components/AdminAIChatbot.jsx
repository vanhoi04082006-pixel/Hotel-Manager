// src/components/AdminAIChatbot.jsx
"use client";

import { useState, useRef, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

const ADMIN_AVATAR = "https://cdn-icons-png.flaticon.com/512/8943/8943377.png"; // Có thể đổi ảnh bot ngầu hơn cho admin

export default function AdminAIChatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [adminEmail, setAdminEmail] = useState(null);

    const defaultMessage = {
        role: "ai",
        text: "Báo cáo sếp! Trợ lý AI Hệ thống đã sẵn sàng. Sếp cần tra cứu doanh thu, xem danh sách phòng hay kiểm tra đơn hàng nào ạ?"
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
            // GỌI ĐẾN API RIÊNG DÀNH CHO ADMIN
            const res = await fetch("/api/admin-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userText, adminEmail: adminEmail })
            });
            const data = await res.json();
            setMessages(prev => [...prev, { role: "ai", text: data.reply || "Đã nhận lệnh thưa sếp." }]);
        } catch {
            setMessages(prev => [...prev, { role: "ai", text: "Hệ thống đang lỗi, sếp thử lại sau nhé." }]);
        }
        setLoading(false);
    }

    return (
        <div className="fixed bottom-6 right-6 z-[9999] font-sans">
            {isOpen && (
                <div className="absolute bottom-24 right-0 w-[420px] sm:w-[480px] h-[650px] rounded-[32px] overflow-hidden border border-emerald-500/30 bg-white/95 backdrop-blur-3xl shadow-[0_30px_80px_rgba(16,185,129,0.25)] flex flex-col animate-in slide-in-from-bottom-5 fade-in duration-300">
                    {/* HEADER ADMIN (Màu Emerald) */}
                    <div className="relative px-5 py-4 bg-gradient-to-r from-teal-900 via-emerald-800 to-teal-900 text-white shrink-0 shadow-md z-10">
                        <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-emerald-400/30 flex items-center justify-center p-1">
                                        <img src={ADMIN_AVATAR} alt="Admin AI" className="w-full h-full object-contain" />
                                    </div>
                                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-yellow-400 border-2 border-slate-900"></span>
                                </div>
                                <div>
                                    <h2 className="font-bold text-[16px] tracking-wide">Luna System AI</h2>
                                    <p className="text-[11px] text-emerald-200 uppercase tracking-widest font-medium">Quyền Quản Trị</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={handleClearChat} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-all text-xs"><i className="fa-solid fa-trash-can"></i></button>
                                <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-rose-500 hover:text-white transition-all text-xs"><i className="fa-solid fa-xmark text-sm"></i></button>
                            </div>
                        </div>
                    </div>

                    {/* BODY */}
                    <div className="flex-1 overflow-y-auto px-4 py-6 bg-slate-50/50 space-y-5 custom-scrollbar">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                {msg.role === "ai" && (
                                    <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mr-2 shrink-0 p-1">
                                        <img src={ADMIN_AVATAR} alt="AI" className="w-full h-full object-contain" />
                                    </div>
                                )}
                                <div className={`max-w-[95%] px-5 py-3.5 text-[14px] leading-relaxed shadow-sm animate-[fadeUp_.3s_ease_out] ${msg.role === "user" ? "bg-gradient-to-br from-teal-800 to-emerald-900 text-white rounded-[24px] rounded-br-sm" : "bg-white text-slate-700 border border-slate-100 rounded-[24px] rounded-bl-sm"}`} dangerouslySetInnerHTML={msg.role === "ai" ? { __html: msg.text } : undefined}>
                                    {msg.role === "user" ? msg.text : null}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start items-end">
                                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mr-2 p-1"><img src={ADMIN_AVATAR} alt="AI" className="w-full h-full object-contain" /></div>
                                <div className="bg-white border border-slate-100 rounded-[24px] rounded-bl-sm px-5 py-4 shadow-sm flex gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"></span><span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "0.15s" }}></span><span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "0.3s" }}></span>
                                </div>
                            </div>
                        )}
                        <div ref={endRef} className="h-2"></div>
                    </div>

                    {/* FORM */}
                    <form onSubmit={sendMessage} className="p-4 bg-white border-t border-slate-100 shrink-0">
                        <div className="flex items-center gap-2 bg-slate-50/80 rounded-full border border-slate-200 p-1.5 focus-within:border-emerald-400 focus-within:bg-white focus-within:shadow-sm transition-all">
                            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Giao việc cho AI Hệ thống..." className="flex-1 bg-transparent outline-none px-4 py-2 text-[14px] text-slate-700 font-medium" />
                            <button type="submit" disabled={!input.trim() || loading} className="w-10 h-10 shrink-0 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-all flex items-center justify-center">
                                <i className="fa-solid fa-paper-plane text-xs"></i>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!isOpen && (
                <button onClick={() => setIsOpen(true)} className="relative w-16 h-16 rounded-full bg-white shadow-[0_20px_40px_rgba(16,185,129,0.35)] hover:scale-110 transition-all duration-300 flex items-center justify-center group border-2 border-emerald-100">
                    <div className="absolute inset-0 rounded-full bg-emerald-500 blur-xl opacity-30 group-hover:opacity-60 transition-opacity animate-pulse"></div>
                    <img src={ADMIN_AVATAR} alt="Admin AI" className="w-12 h-12 object-contain relative z-10 drop-shadow-md group-hover:scale-110 transition-transform" />
                    <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 border-2 border-white rounded-full z-20"></span>
                </button>
            )}
        </div>
    );
}
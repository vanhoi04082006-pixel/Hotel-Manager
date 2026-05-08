// src/components/AIChatbot.jsx
"use client";

import { useState, useRef, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

const LUNA_AVATAR = "https://cdn-icons-png.flaticon.com/512/8943/8943377.png";

export default function AIChatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [userEmail, setUserEmail] = useState(null);
    const [authInitialized, setAuthInitialized] = useState(false);

    const defaultMessage = {
        role: "ai",
        text: "Xin chào Quý khách! Luna rất hân hạnh đồng hành cùng Quý khách hôm nay. Quý khách cần hỗ trợ đặt phòng hay dịch vụ nào ạ?"
    };

    const [messages, setMessages] = useState([]);
    const endRef = useRef(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUserEmail(user ? user.email : null);
            setAuthInitialized(true);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!authInitialized) return;

        const storageKey = userEmail ? `luna_chat_${userEmail}` : 'luna_chat_guest';

        try {
            const savedChat = localStorage.getItem(storageKey);
            if (savedChat) {
                setMessages(JSON.parse(savedChat));
            } else {
                setMessages([defaultMessage]);
            }
        } catch (error) {
            setMessages([defaultMessage]);
        }
    }, [userEmail, authInitialized]);

    useEffect(() => {
        if (!authInitialized || messages.length === 0) return;

        const storageKey = userEmail ? `luna_chat_${userEmail}` : 'luna_chat_guest';
        if (messages.length > 1) {
            localStorage.setItem(storageKey, JSON.stringify(messages));
        }
    }, [messages, userEmail, authInitialized]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                endRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        }
    }, [messages, loading, isOpen]);

    const handleClearChat = () => {
        if (confirm("Bạn có muốn xóa toàn bộ lịch sử trò chuyện với Luna không?")) {
            const storageKey = userEmail ? `luna_chat_${userEmail}` : 'luna_chat_guest';
            localStorage.removeItem(storageKey);
            setMessages([defaultMessage]);
        }
    };

    async function sendMessage(e) {
        e.preventDefault();
        if (!input.trim()) return;

        const userText = input.trim();
        const newMessages = [...messages, { role: "user", text: userText }];

        setMessages(newMessages);
        setInput("");
        setLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userText, userEmail: userEmail })
            });

            const data = await res.json();

            setMessages((prev) => [
                ...prev,
                { role: "ai", text: data.reply || "Luna đã nhận yêu cầu của Quý khách." }
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: "ai", text: "Xin lỗi Quý khách, Luna đang tạm bận. Vui lòng thử lại sau ít phút ạ." }
            ]);
        }
        setLoading(false);
    }

    if (!authInitialized) return null;

    return (
        /* Cập nhật Responsive cho vị trí Float Button (Chừa lề nhỏ hơn trên mobile) */
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] font-sans">
            {isOpen && (
                /* Cập nhật Responsive: Mobile thì fixed full màn hình, PC (sm trở lên) thì thành hộp thoại nổi */
                <div className="fixed inset-0 z-[10000] w-full h-full sm:absolute sm:inset-auto sm:bottom-20 sm:right-0 sm:w-[400px] sm:h-[620px] sm:rounded-[24px] overflow-hidden border border-white/40 bg-white/95 backdrop-blur-3xl shadow-[0_30px_80px_rgba(15,23,42,0.25)] flex flex-col animate-in slide-in-from-bottom-5 fade-in duration-300">
                    {/* HEADER */}
                    <div className="relative px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 text-white shrink-0 shadow-md z-10">
                        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,white,transparent_40%)]"></div>
                        <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-inner overflow-hidden p-1">
                                        <img src={LUNA_AVATAR} alt="Luna AI" className="w-full h-full object-contain drop-shadow-md" />
                                    </div>
                                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900"></span>
                                </div>
                                <div>
                                    <h2 className="font-bold text-[16px] tracking-wide">Luna AI Concierge</h2>
                                    <p className="text-[11px] text-blue-200 uppercase tracking-widest font-medium">
                                        {userEmail ? userEmail.split('@')[0] : "Khách vãng lai"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={handleClearChat} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-all text-xs" title="Xóa lịch sử">
                                    <i className="fa-solid fa-trash-can"></i>
                                </button>
                                <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-rose-500 hover:text-white transition-all text-xs">
                                    <i className="fa-solid fa-xmark text-sm"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* BODY CHAT */}
                    <div className="flex-1 overflow-y-auto px-4 py-6 bg-slate-50/50 space-y-5 custom-scrollbar">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                {msg.role === "ai" && (
                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center mr-2 shrink-0 border border-blue-100 overflow-hidden shadow-sm p-1">
                                        <img src={LUNA_AVATAR} alt="Luna AI" className="w-full h-full object-contain" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[80%] px-5 py-3.5 text-[14px] leading-relaxed shadow-sm animate-[fadeUp_.3s_ease_out]
                                    ${msg.role === "user"
                                            ? "bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-[24px] rounded-br-sm"
                                            : "bg-white text-slate-700 border border-slate-100 rounded-[24px] rounded-bl-sm"
                                        }`}
                                    dangerouslySetInnerHTML={msg.role === "ai" ? { __html: msg.text } : undefined}
                                >
                                    {msg.role === "user" ? msg.text : null}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex justify-start items-end">
                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center mr-2 shrink-0 border border-blue-100 overflow-hidden shadow-sm p-1">
                                    <img src={LUNA_AVATAR} alt="Luna AI" className="w-full h-full object-contain" />
                                </div>
                                <div className="bg-white border border-slate-100 rounded-[24px] rounded-bl-sm px-5 py-4 shadow-sm flex gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"></span>
                                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0.15s" }}></span>
                                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0.3s" }}></span>
                                </div>
                            </div>
                        )}
                        <div ref={endRef} className="h-2"></div>
                    </div>

                    {/* INPUT FORM */}
                    {/* Thêm pb-6 để phòng trường hợp thanh bar dưới cùng của iPhone (Home Indicator) che mất input */}
                    <form onSubmit={sendMessage} className="p-4 pb-6 sm:pb-4 bg-white border-t border-slate-100 shrink-0">
                        <div className="flex items-center gap-2 bg-slate-50/80 rounded-full border border-slate-200 p-1.5 focus-within:border-blue-400 focus-within:bg-white focus-within:shadow-sm transition-all">
                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Gửi tin nhắn cho Luna..."
                                className="flex-1 bg-transparent outline-none px-4 py-2 text-[14px] text-slate-700 placeholder:text-slate-400 font-medium"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || loading}
                                className="w-10 h-10 shrink-0 rounded-full bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                <i className="fa-solid fa-paper-plane text-xs ml-0.5"></i>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-900 shadow-[0_20px_40px_rgba(15,23,42,0.35)] hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center group border-2 border-white/20 p-1"
                >
                    <span className="absolute inset-0 rounded-full bg-blue-500 blur-xl opacity-40 group-hover:opacity-70 transition-opacity animate-pulse"></span>
                    <img src={LUNA_AVATAR} alt="Luna AI" className="w-full h-full object-contain relative z-10 group-hover:scale-110 transition-transform drop-shadow-md" />
                    <span className="absolute top-0 right-0 w-3 h-3 sm:w-4 sm:h-4 bg-rose-500 border-2 border-slate-900 rounded-full z-20"></span>
                </button>
            )}

            <style jsx>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
        </div>
    );
}
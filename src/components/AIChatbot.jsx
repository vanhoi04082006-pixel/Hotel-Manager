"use client";

import { useState, useRef, useEffect } from "react";

export default function AIChatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: "ai",
            text: "Xin chào Quý khách ✨ Luna rất hân hạnh đồng hành cùng Quý khách hôm nay. Quý khách cần hỗ trợ đặt phòng hay dịch vụ nào ạ?"
        }
    ]);

    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({
            behavior: "smooth"
        });
    }, [messages, loading]);

    async function sendMessage(e) {
        e.preventDefault();

        if (!input.trim()) return;

        const userText = input.trim();

        setMessages((prev) => [
            ...prev,
            { role: "user", text: userText }
        ]);

        setInput("");
        setLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: userText
                })
            });

            const data = await res.json();

            setMessages((prev) => [
                ...prev,
                {
                    role: "ai",
                    text:
                        data.reply ||
                        "Luna đã nhận yêu cầu của Quý khách."
                }
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    role: "ai",
                    text:
                        "Xin lỗi Quý khách, Luna đang tạm bận. Vui lòng thử lại sau ít phút ạ."
                }
            ]);
        }

        setLoading(false);
    }

    return (
        <div className="fixed bottom-6 right-6 z-[9999] font-sans">

            {/* PANEL CHAT */}
            {isOpen && (
                <div className="absolute bottom-24 right-0 w-[390px] sm:w-[420px] h-[620px] rounded-[32px] overflow-hidden border border-white/40 bg-white/80 backdrop-blur-2xl shadow-[0_30px_80px_rgba(15,23,42,0.22)] flex flex-col">

                    {/* HEADER */}
                    <div className="relative px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 text-white">

                        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,white,transparent_40%)]"></div>

                        <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-3">

                                <div className="relative">
                                    <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-xl border border-white/20 flex items-center justify-center text-xl">
                                        ✨
                                    </div>

                                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900"></span>
                                </div>

                                <div>
                                    <h2 className="font-semibold text-[16px] tracking-wide">
                                        Luna AI Concierge
                                    </h2>
                                    <p className="text-xs text-slate-200">
                                        Trợ lý nghỉ dưỡng 24/7
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 transition-all"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* BODY */}
                    <div className="flex-1 overflow-y-auto px-4 py-5 bg-gradient-to-b from-slate-50 to-white space-y-4">

                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`flex ${msg.role === "user"
                                        ? "justify-end"
                                        : "justify-start"
                                    }`}
                            >
                                <div
                                    className={`max-w-[82%] px-4 py-3 text-[14px] leading-relaxed shadow-sm animate-[fadeUp_.25s_ease]
                  ${msg.role === "user"
                                            ? "bg-slate-900 text-white rounded-[22px] rounded-br-md"
                                            : "bg-white text-slate-700 border border-slate-100 rounded-[22px] rounded-bl-md"
                                        }`}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-slate-100 rounded-[22px] rounded-bl-md px-4 py-3 shadow-sm flex gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"></span>
                                    <span
                                        className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                                        style={{ animationDelay: "0.15s" }}
                                    ></span>
                                    <span
                                        className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                                        style={{ animationDelay: "0.3s" }}
                                    ></span>
                                </div>
                            </div>
                        )}

                        <div ref={endRef}></div>
                    </div>

                    {/* INPUT */}
                    <form
                        onSubmit={sendMessage}
                        className="p-4 bg-white/90 backdrop-blur-xl border-t border-slate-100"
                    >
                        <div className="flex items-center gap-2 bg-slate-50 rounded-full border border-slate-200 px-2 py-2 focus-within:border-blue-400 focus-within:bg-white transition-all">

                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Nhập yêu cầu của Quý khách..."
                                className="flex-1 bg-transparent outline-none px-3 text-[14px] text-slate-700 placeholder:text-slate-400"
                            />

                            <button
                                type="submit"
                                disabled={!input.trim() || loading}
                                className="w-11 h-11 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                            >
                                ➜
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* NÚT MỞ CHAT */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="relative w-16 h-16 rounded-full bg-gradient-to-r from-slate-900 to-blue-900 text-white shadow-[0_20px_40px_rgba(15,23,42,0.35)] hover:scale-110 active:scale-95 transition-all"
                >
                    <span className="absolute inset-0 rounded-full bg-blue-400 blur-xl opacity-30 animate-pulse"></span>
                    <span className="relative text-2xl">✨</span>
                </button>
            )}

            {/* STYLE */}
            <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(25px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        ::-webkit-scrollbar {
          width: 6px;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.25);
          border-radius: 20px;
        }
      `}</style>
        </div>
    );
}
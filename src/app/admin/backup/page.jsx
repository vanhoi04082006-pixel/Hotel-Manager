// src/app/admin/backup/page.jsx
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export default function AdminBackup() {
  const [backups, setBackups] = useState([]);
  const [autoBackup, setAutoBackup] = useState(false);
  const [backupTime, setBackupTime] = useState("00:00");
  const [maxBackups, setMaxBackups] = useState("30");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setBackups(JSON.parse(localStorage.getItem("backupList") || "[]"));
    setAutoBackup(localStorage.getItem("autoBackup") === "true");
    setBackupTime(localStorage.getItem("backupTime") || "00:00");
    setMaxBackups(localStorage.getItem("maxBackups") || "30");
  }, []);

  const handleToggleAutoBackup = (checked) => {
    setAutoBackup(checked);
    localStorage.setItem("autoBackup", checked);
  };

  const handleChangeTime = (e) => {
    setBackupTime(e.target.value);
    localStorage.setItem("backupTime", e.target.value);
  };

  const handleChangeMax = (e) => {
    setMaxBackups(e.target.value);
    localStorage.setItem("maxBackups", e.target.value);
  };

  const performBackup = async () => {
    setIsProcessing(true);
    setProgress(0);
    try {
      // Fake progress for UI effect
      const interval = setInterval(() => {
        setProgress(p => (p < 90 ? p + 15 : p));
      }, 300);

      const collectionsToBackup = ["rooms", "bookings", "services", "users", "staff", "promotions", "reviews", "gallery", "invoices", "logs"];
      const allData = {};

      for (const colName of collectionsToBackup) {
        const snap = await getDocs(collection(db, colName));
        allData[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      clearInterval(interval);
      setProgress(100);

      setTimeout(() => {
        const backupName = `luna_sys_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
        const backupData = {
          id: Date.now().toString(),
          name: `${backupName}.json`,
          date: new Date().toLocaleString("vi-VN"),
          size: (JSON.stringify(allData).length / 1024).toFixed(1) + " KB",
          data: allData,
        };

        const newBackups = [backupData, ...backups];
        const limitedBackups = newBackups.slice(0, parseInt(maxBackups));
        
        setBackups(limitedBackups);
        localStorage.setItem("backupList", JSON.stringify(limitedBackups));

        const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = backupData.name;
        a.click();
        URL.revokeObjectURL(url);

        setIsProcessing(false);
      }, 800);

    } catch (error) {
      alert("Lỗi sao lưu: " + error.message);
      setIsProcessing(false);
    }
  };

  const downloadBackup = (backupId) => {
    const backup = backups.find(b => b.id === backupId);
    if (backup && backup.data) {
      const blob = new Blob([JSON.stringify(backup.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = backup.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const deleteBackup = (backupId) => {
    if (confirm("Hành động này sẽ xóa vĩnh viễn tệp sao lưu. Tiếp tục?")) {
      const newBackups = backups.filter(b => b.id !== backupId);
      setBackups(newBackups);
      localStorage.setItem("backupList", JSON.stringify(newBackups));
    }
  };

  const restoreBackup = () => {
    alert("Cảnh báo: Tính năng khôi phục (Ghi đè DB) yêu cầu mã PIN cấp quyền cao nhất. Bị khóa trong phiên bản này.");
  };

  // Tính toán dung lượng giả lập cho UI
  const totalUsedSize = backups.reduce((acc, curr) => acc + parseFloat(curr.size), 0);
  const maxStorage = 50 * 1024; // 50MB (giả lập)
  const usedPercentage = Math.min((totalUsedSize / maxStorage) * 100, 100).toFixed(1);

  return (
    <div className="fade-in max-w-5xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="text-center mb-10 mt-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white text-3xl shadow-xl shadow-blue-500/30 mb-6 transform rotate-3 hover:rotate-0 transition-transform">
          <i className="fa-solid fa-server"></i>
        </div>
        <h2 className="text-4xl font-playfair font-bold text-slate-800 mb-3">Trung tâm Lưu trữ & Phục hồi</h2>
        <p className="text-slate-500 max-w-xl mx-auto">Đảm bảo an toàn tuyệt đối cho cơ sở dữ liệu của Luna Hotel. Dễ dàng sao lưu, tải xuống và mã hóa thông tin chỉ với 1 click.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Cột trái: Cài đặt và Status */}
        <div className="lg:col-span-1 space-y-8">
          
          {/* Storage Status */}
          <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
            <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><i className="fa-solid fa-hard-drive text-blue-500"></i> Local Storage</h4>
            
            <div className="flex justify-between items-end mb-2">
              <span className="text-3xl font-mono font-bold text-slate-800">{(totalUsedSize / 1024).toFixed(2)}<span className="text-sm font-sans text-slate-500 ml-1">MB</span></span>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">Max 50MB</span>
            </div>
            
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-3 shadow-inner">
              <div className={`h-full rounded-full transition-all duration-1000 ${usedPercentage > 80 ? 'bg-rose-500' : 'bg-gradient-to-r from-blue-400 to-indigo-500'}`} style={{ width: `${Math.max(usedPercentage, 2)}%` }}></div>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Đã dùng {usedPercentage}% không gian lưu trữ cục bộ.</p>
          </div>

          {/* Auto Backup Settings */}
          <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-bold text-slate-800 flex items-center gap-2"><i className="fa-solid fa-clock-rotate-left text-emerald-500"></i> Auto Sync</h4>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={autoBackup} onChange={(e) => handleToggleAutoBackup(e.target.checked)} />
                <div className="w-10 h-6 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:border-white shadow-inner"></div>
              </label>
            </div>
            
            <div className={`space-y-4 transition-all duration-500 ${autoBackup ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Thời gian đồng bộ</label>
                <select value={backupTime} onChange={handleChangeTime} className="w-full bg-transparent font-bold text-slate-700 outline-none cursor-pointer">
                  <option value="00:00">00:00 (Nửa đêm)</option>
                  <option value="02:00">02:00 (Rạng sáng)</option>
                  <option value="12:00">12:00 (Giữa trưa)</option>
                </select>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Lưu trữ tối đa</label>
                <select value={maxBackups} onChange={handleChangeMax} className="w-full bg-transparent font-bold text-slate-700 outline-none cursor-pointer">
                  <option value="7">Giữ 7 bản gần nhất</option>
                  <option value="30">Giữ 30 bản (1 Tháng)</option>
                  <option value="90">Giữ 90 bản (3 Tháng)</option>
                </select>
              </div>
            </div>
          </div>
          
        </div>

        {/* Cột phải: Action & Lịch sử */}
        <div className="lg:col-span-2 space-y-8 flex flex-col">
          
          {/* Big Action Button */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-900/20">
            {/* Background elements */}
            <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-screen filter blur-[80px] opacity-30 animate-pulse"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-playfair font-bold mb-2">Tạo File Nén DB</h3>
                <p className="text-indigo-200 text-sm max-w-sm">Trích xuất toàn bộ dữ liệu cấu trúc thành định dạng JSON để lưu trữ ngoại tuyến.</p>
              </div>
              <button 
                onClick={performBackup} 
                disabled={isProcessing} 
                className="w-full md:w-auto px-8 py-4 bg-white text-indigo-900 rounded-2xl font-bold shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] transition-all transform hover:-translate-y-1 disabled:opacity-80 disabled:transform-none flex items-center justify-center shrink-0 group"
              >
                {isProcessing ? (
                  <div className="flex items-center">
                    <i className="fa-solid fa-spinner fa-spin mr-3 text-indigo-500"></i> 
                    <span>Đang trích xuất... {progress}%</span>
                  </div>
                ) : (
                  <><i className="fa-solid fa-cloud-arrow-down mr-3 text-indigo-500 text-lg group-hover:animate-bounce"></i> XUẤT BACKUP NGAY</>
                )}
              </button>
            </div>
            
            {/* Progress bar effect when processing */}
            {isProcessing && (
              <div className="absolute bottom-0 left-0 h-1.5 bg-indigo-500/30 w-full">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            )}
          </div>

          {/* Backup History List */}
          <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-bold text-slate-800 text-lg">Lịch sử File đã xuất</h4>
              <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold">{backups.length} Tệp</span>
            </div>

            <div className="space-y-3 overflow-y-auto custom-scroll pr-2 max-h-[400px]">
              {backups.length > 0 ? backups.map((backup, idx) => (
                <div key={backup.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl transition-all group animate-in slide-in-from-bottom-2" style={{ animationDelay: `${idx * 50}ms` }}>
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mr-4 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      <i className="fa-solid fa-file-code text-xl"></i>
                    </div>
                    <div>
                      <p className="font-mono font-bold text-sm text-slate-800 group-hover:text-indigo-700 transition-colors">{backup.name}</p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 font-medium">
                        <span><i className="fa-regular fa-clock mr-1 opacity-70"></i>{backup.date}</span>
                        <span>•</span>
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{backup.size}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => downloadBackup(backup.id)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 hover:bg-blue-500 hover:text-white shadow-sm flex items-center justify-center transition-all" title="Tải xuống tệp JSON">
                      <i className="fa-solid fa-download text-sm"></i>
                    </button>
                    <button onClick={() => restoreBackup(backup.id)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 hover:bg-emerald-500 hover:text-white shadow-sm flex items-center justify-center transition-all" title="Khôi phục Data">
                      <i className="fa-solid fa-clock-rotate-left text-sm"></i>
                    </button>
                    <button onClick={() => deleteBackup(backup.id)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 hover:bg-rose-500 hover:text-white shadow-sm flex items-center justify-center transition-all" title="Xóa lịch sử">
                      <i className="fa-solid fa-trash text-sm"></i>
                    </button>
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <i className="fa-solid fa-box-open text-5xl mb-4 opacity-50"></i>
                  <p className="font-medium text-slate-600">Kho lưu trữ trống</p>
                  <p className="text-sm mt-1">Chưa có bản sao lưu nào được tạo.</p>
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
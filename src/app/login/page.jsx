// src/app/login/page.jsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

const ADMIN_EMAIL = "lunanewyear@gmail.com";

export default function LoginPage() {
  const router = useRouter();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // State cho thông báo tùy chỉnh
  const [notification, setNotification] = useState({
    show: false,
    title: "",
    message: "",
    type: "success", // success, error, warning
  });

  const googleProvider = new GoogleAuthProvider();
  const facebookProvider = new FacebookAuthProvider();

  // Hàm hiển thị thông báo
  const notify = (title, message, type = "success") => {
    setNotification({ show: true, title, message, type });
  };

  const closeNotify = () => {
    setNotification((prev) => ({ ...prev, show: false }));
  };

  // Hàm xử lý sau khi auth thành công
  const handleAuthSuccess = async (user, isNewUser = false) => {
    let role = user.email === ADMIN_EMAIL ? "admin" : "user";
    let name = user.displayName || user.email.split("@")[0];

    try {
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (isNewUser || !userDoc.exists()) {
        await setDoc(userRef, {
          email: user.email,
          name: name,
          role: role,
          createdAt: new Date().toISOString(),
          photoURL: user.photoURL || "",
        });
      } else {
        role = userDoc.data().role || "user";
        name = userDoc.data().name || name;
      }

      localStorage.setItem(
        "currentUser",
        JSON.stringify({ uid: user.uid, email: user.email, name, role })
      );

      notify(
        "Thành công",
        isLoginMode ? "Chào mừng bạn quay trở lại!" : "Tài khoản của bạn đã được khởi tạo.",
        "success"
      );

      // Đợi 1.5s để người dùng kịp nhìn thông báo thành công trước khi redirect
      setTimeout(() => {
        router.push(role === "admin" ? "/admin" : "/");
      }, 1500);

    } catch (error) {
      notify("Lỗi dữ liệu", "Không thể cập nhật hồ sơ người dùng.", "error");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoginMode && password !== confirmPassword) {
      notify("Mật khẩu lỗi", "Mật khẩu xác nhận không khớp.", "error");
      return;
    }

    setLoading(true);
    try {
      if (isLoginMode) {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        await handleAuthSuccess(userCred.user, false);
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await handleAuthSuccess(userCred.user, true);
      }
    } catch (error) {
      let msg = "Đã có lỗi xảy ra, vui lòng thử lại.";
      if (error.code === "auth/invalid-credential") msg = "Email hoặc mật khẩu không chính xác.";
      else if (error.code === "auth/email-already-in-use") msg = "Email này đã được sử dụng.";
      else if (error.code === "auth/weak-password") msg = "Mật khẩu quá yếu (tối thiểu 6 ký tự).";
      notify("Thất bại", msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    try {
      const result = await signInWithPopup(auth, provider);
      await handleAuthSuccess(result.user, false);
    } catch (error) {
      if (error.code !== "auth/popup-closed-by-user") {
        notify("Lỗi đăng nhập", "Không thể kết nối với tài khoản mạng xã hội.", "error");
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      notify("Yêu cầu email", "Vui lòng nhập email để nhận link khôi phục.", "warning");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      notify("Đã gửi", "Vui lòng kiểm tra hộp thư đến của bạn.", "success");
    } catch (error) {
      notify("Lỗi", "Email không tồn tại trong hệ thống.", "error");
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] selection:bg-blue-100">
      {/* NÂNG CẤP: Custom Notification Modal */}
      {notification.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in-95 duration-300">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
              notification.type === "success" ? "bg-emerald-100 text-emerald-600" : 
              notification.type === "error" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
            }`}>
              <i className={`fa-solid ${
                notification.type === "success" ? "fa-check" : 
                notification.type === "error" ? "fa-xmark" : "fa-exclamation"
              } text-4xl`}></i>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">{notification.title}</h3>
            <p className="text-slate-500 mb-8">{notification.message}</p>
            <button
              onClick={closeNotify}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-lg"
            >
              Đồng ý
            </button>
          </div>
        </div>
      )}

      <div className="flex min-h-screen">
        {/* Cột trái: Nghệ thuật & Thông tin */}
        <div className="hidden lg:flex lg:w-7/12 relative bg-slate-900">
          <img
            src="https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=2000&auto=format&fit=crop"
            className="absolute inset-0 w-full h-full object-cover opacity-60"
            alt="Luna Luxury"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-transparent to-slate-900/90 z-20"></div>
          
          <div className="relative z-30 flex flex-col justify-between h-full p-20 text-white w-full">
            <Link href="/" className="text-3xl font-playfair font-black tracking-tight">
              LUNA<span className="text-blue-400">HOTEL</span>
            </Link>

            <div>
              <div className="flex space-x-1 mb-6 text-yellow-400">
                {[...Array(5)].map((_, i) => <i key={i} className="fa-solid fa-star text-sm"></i>)}
              </div>
              <h1 className="text-7xl font-playfair font-bold mb-8 leading-[1.1]">
                Nâng tầm <br /> chuẩn mực <br /><span className="italic font-light text-blue-300">nghỉ dưỡng.</span>
              </h1>
              <div className="flex items-center gap-6 p-6 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 max-w-lg">
                <div className="flex -space-x-4">
                    {[1,2,3,4].map(i => (
                        <img key={i} className="w-12 h-12 rounded-full border-4 border-slate-900 object-cover" src={`https://i.pravatar.cc/150?u=${i}`} alt="user" />
                    ))}
                </div>
                <p className="text-sm font-medium text-slate-200">
                   Hơn <span className="text-white font-bold">50,000+</span> khách hàng đã trải nghiệm và hài lòng tuyệt đối.
                </p>
              </div>
            </div>

            <div className="flex justify-between items-end border-t border-white/10 pt-10">
               <p className="text-slate-400 text-sm italic">© 2026 Luna Luxury Hotel Group</p>
               <div className="flex gap-4">
                  <i className="fa-brands fa-instagram text-xl cursor-pointer hover:text-blue-400 transition-colors"></i>
                  <i className="fa-brands fa-facebook text-xl cursor-pointer hover:text-blue-400 transition-colors"></i>
               </div>
            </div>
          </div>
        </div>

        {/* Cột phải: Form thực thi */}
        <div className="w-full lg:w-5/12 flex items-center justify-center p-8 md:p-16 bg-white">
          <div className="w-full max-w-md">
            <div className="mb-10">
              <h2 className="text-4xl font-playfair font-bold text-slate-900 mb-3 tracking-tight">
                {isLoginMode ? "Chào bạn trở lại" : "Tạo tài khoản"}
              </h2>
              <p className="text-slate-500 font-medium">
                {isLoginMode ? "Vui lòng nhập thông tin để truy cập hệ thống." : "Tham gia cùng chúng tôi để nhận các ưu đãi thượng lưu."}
              </p>
            </div>

            {/* Social Logins */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <button 
                onClick={() => handleSocialLogin(googleProvider)}
                className="flex items-center justify-center gap-3 border border-slate-200 rounded-2xl py-4 font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-95"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5" alt="google" />
                Google
              </button>
              <button 
                onClick={() => handleSocialLogin(facebookProvider)}
                className="flex items-center justify-center gap-3 border border-slate-200 rounded-2xl py-4 font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-95"
              >
                <i className="fa-brands fa-facebook text-blue-600 text-xl"></i>
                Facebook
              </button>
            </div>

            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold"><span className="px-6 bg-white text-slate-400">Hoặc Email</span></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Địa chỉ Email</label>
                <div className="relative group">
                  <i className="fa-regular fa-envelope absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors"></i>
                  <input 
                    type="email" 
                    required 
                    className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 focus:bg-white transition-all outline-none font-medium" 
                    placeholder="name@example.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-bold text-slate-700">Mật khẩu</label>
                    {isLoginMode && (
                        <button type="button" onClick={handleForgotPassword} className="text-xs font-bold text-blue-600 hover:text-blue-800">Quên mật khẩu?</button>
                    )}
                </div>
                <div className="relative group">
                  <i className="fa-solid fa-lock absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors"></i>
                  <input 
                    type={showPassword ? "text" : "password"}
                    required 
                    className="w-full pl-12 pr-14 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 focus:bg-white transition-all outline-none font-medium" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                  </button>
                </div>
              </div>

              {!isLoginMode && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Xác nhận mật khẩu</label>
                  <div className="relative">
                    <i className="fa-solid fa-shield-check absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input 
                      type="password" 
                      required 
                      className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 focus:bg-white transition-all outline-none font-medium" 
                      placeholder="••••••••" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold shadow-xl shadow-slate-900/20 hover:bg-blue-600 hover:-translate-y-1 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading ? (
                    <span className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                ) : (
                    <span>{isLoginMode ? "Đăng nhập ngay" : "Bắt đầu hành trình"}</span>
                )}
              </button>
            </form>

            <div className="mt-10 text-center">
              <p className="text-slate-500 font-medium">
                {isLoginMode ? "Bạn là khách hàng mới?" : "Bạn đã từng nghỉ dưỡng tại đây?"}
                <button 
                    onClick={() => { setIsLoginMode(!isLoginMode); }} 
                    className="text-blue-600 font-bold hover:underline ml-2"
                >
                  {isLoginMode ? "Đăng ký thành viên" : "Đăng nhập"}
                </button>
              </p>
            </div>

            <div className="mt-12 text-center">
              <Link href="/" className="inline-flex items-center text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest">
                <i className="fa-solid fa-house-chimney mr-2 text-sm"></i> Trang chủ Luna Hotel
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
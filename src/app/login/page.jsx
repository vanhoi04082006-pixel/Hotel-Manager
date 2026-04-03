// src/app/login/page.jsx
"use client";

import { useState } from "react";
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
  const [errorMsg, setErrorMsg] = useState("");

  const googleProvider = new GoogleAuthProvider();
  const facebookProvider = new FacebookAuthProvider();

  // Hàm xử lý chung sau khi đăng nhập/đăng ký thành công
  const handleAuthSuccess = async (user, isNewUser = false) => {
    let role = user.email === ADMIN_EMAIL ? "admin" : "user";
    let name = user.displayName || user.email.split("@")[0];

    if (isNewUser) {
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        name: name,
        role: role,
        createdAt: new Date().toISOString(),
      });
    } else {
      // Nếu đã có user, lấy role từ Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        role = userDoc.data().role;
        name = userDoc.data().name || name;
      } else {
        // Đề phòng trường hợp đăng nhập bằng MXH lần đầu
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          name: name,
          role: role,
          createdAt: new Date().toISOString(),
        });
      }
    }

    localStorage.setItem(
      "currentUser",
      JSON.stringify({ uid: user.uid, email: user.email, name: name, role: role })
    );

    alert(`${isLoginMode ? "Đăng nhập" : "Đăng ký"} thành công!`); // Bạn có thể thay bằng Toast component sau
    
    // Chuyển hướng dựa trên role
    if (role === "admin") {
      router.push("/admin");
    } else {
      router.push("/");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!isLoginMode && password !== confirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không khớp");
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
      let message = error.message;
      if (error.code === "auth/invalid-credential") message = "Email hoặc mật khẩu không đúng";
      else if (error.code === "auth/email-already-in-use") message = "Email đã được đăng ký";
      else if (error.code === "auth/weak-password") message = "Mật khẩu phải có ít nhất 6 ký tự";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await handleAuthSuccess(result.user, false);
    } catch (error) {
      alert("Lỗi đăng nhập Google: " + error.message);
    }
  };

  const handleFacebookLogin = async () => {
    try {
      const result = await signInWithPopup(auth, facebookProvider);
      await handleAuthSuccess(result.user, false);
    } catch (error) {
      alert("Lỗi đăng nhập Facebook: " + error.message);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      alert("Vui lòng nhập email vào ô trống phía trên");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Email khôi phục đã gửi!");
    } catch (error) {
      alert("Lỗi: " + error.message);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white">
      <div className="flex min-h-screen">
        {/* Cột trái: Hình ảnh */}
        <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden">
          <div className="absolute inset-0 bg-black/50 z-10"></div>
          <img
            src="https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2000&auto=format&fit=crop"
            className="absolute inset-0 w-full h-full object-cover opacity-90"
            alt="Luna Hotel"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-20"></div>
          <div className="relative z-30 mt-auto p-16 text-white">
            <div className="flex space-x-1 mb-6">
              <i className="fa-solid fa-star text-yellow-400"></i>
              <i className="fa-solid fa-star text-yellow-400"></i>
              <i className="fa-solid fa-star text-yellow-400"></i>
              <i className="fa-solid fa-star text-yellow-400"></i>
              <i className="fa-solid fa-star text-yellow-400"></i>
            </div>
            <h1 className="text-5xl font-playfair font-bold mb-6 leading-tight">
              Chào Mừng Đến<br />Luna Hotel
            </h1>
            <p className="text-lg text-slate-300 max-w-md leading-relaxed mb-8">
              Trải nghiệm đẳng cấp 5 sao với dịch vụ hoàn hảo và không gian sang trọng bậc nhất.
            </p>
            <div className="grid grid-cols-3 gap-6">
              <div><p className="text-3xl font-bold text-white">500+</p><p className="text-sm text-slate-400">Phòng cao cấp</p></div>
              <div><p className="text-3xl font-bold text-white">50k+</p><p className="text-sm text-slate-400">Khách hàng</p></div>
              <div><p className="text-3xl font-bold text-white">4.9</p><p className="text-sm text-slate-400">Đánh giá</p></div>
            </div>
          </div>
        </div>

        {/* Cột phải: Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-white">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl mb-6 shadow-xl">
                <i className="fa-solid fa-hotel text-3xl text-white"></i>
              </div>
              <h2 className="text-3xl font-playfair font-bold text-slate-900 mb-2">
                {isLoginMode ? "Đăng Nhập" : "Đăng Ký Tài Khoản"}
              </h2>
              <p className="text-slate-500">
                {isLoginMode ? "Đăng nhập để trải nghiệm dịch vụ 5 sao" : "Tạo tài khoản để nhận nhiều ưu đãi đặc biệt"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <button onClick={handleGoogleLogin} type="button" className="flex items-center justify-center gap-2 w-full bg-white border border-slate-200 rounded-xl py-3 font-medium text-slate-700 hover:bg-slate-50 transition-all">
                <i className="fa-brands fa-google text-red-500"></i> Google
              </button>
              <button onClick={handleFacebookLogin} type="button" className="flex items-center justify-center gap-2 w-full bg-white border border-slate-200 rounded-xl py-3 font-medium text-slate-700 hover:bg-slate-50 transition-all">
                <i className="fa-brands fa-facebook-f text-blue-600"></i> Facebook
              </button>
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
              <div className="relative flex justify-center text-sm"><span className="px-4 bg-white text-slate-500">Hoặc tiếp tục với email</span></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="form-label block text-[14px] font-semibold text-[#334155] mb-2">Email</label>
                <div className="relative">
                  <i className="fa-regular fa-envelope absolute left-4 top-4 text-slate-400"></i>
                  <input 
                    type="email" 
                    required 
                    className="w-full p-[12px_16px] border border-[#e2e8f0] rounded-xl transition-all duration-300 bg-white focus:outline-none focus:border-[#2563eb] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] pl-11" 
                    placeholder="your@email.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label className="form-label block text-[14px] font-semibold text-[#334155] mb-2">Mật khẩu</label>
                <div className="relative">
                  <i className="fa-solid fa-lock absolute left-4 top-4 text-slate-400"></i>
                  <input 
                    type="password" 
                    required 
                    className="w-full p-[12px_16px] border border-[#e2e8f0] rounded-xl transition-all duration-300 bg-white focus:outline-none focus:border-[#2563eb] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] pl-11" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {!isLoginMode && (
                <div>
                  <label className="form-label block text-[14px] font-semibold text-[#334155] mb-2">Xác nhận mật khẩu</label>
                  <div className="relative">
                    <i className="fa-solid fa-lock absolute left-4 top-4 text-slate-400"></i>
                    <input 
                      type="password" 
                      required={!isLoginMode}
                      className="w-full p-[12px_16px] border border-[#e2e8f0] rounded-xl transition-all duration-300 bg-white focus:outline-none focus:border-[#2563eb] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] pl-11" 
                      placeholder="••••••••" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {errorMsg && <div className="text-[#ef4444] text-[12px] mt-1">{errorMsg}</div>}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-[#1e293b] text-white p-[12px_24px] rounded-xl font-semibold transition-all duration-300 inline-flex items-center justify-center hover:bg-[#2563eb] hover:-translate-y-0.5 hover:shadow-[0_10px_15px_-3px_rgba(37,99,235,0.3)] disabled:opacity-50"
              >
                {loading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                    <span>{isLoginMode ? "Đăng Nhập" : "Đăng Ký"}</span>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-slate-600">
                <span>{isLoginMode ? "Chưa có tài khoản?" : "Đã có tài khoản?"}</span>
                <button onClick={() => { setIsLoginMode(!isLoginMode); setErrorMsg(""); }} className="text-blue-600 font-bold hover:text-blue-800 transition-colors ml-1">
                  {isLoginMode ? "Đăng ký ngay" : "Đăng nhập"}
                </button>
              </p>
            </div>
            
            {isLoginMode && (
                <div className="mt-4 text-center">
                <button onClick={handleForgotPassword} className="text-sm text-slate-500 hover:text-blue-600">Quên mật khẩu?</button>
                </div>
            )}
            
            <div className="mt-6 text-center">
              <Link href="/" className="text-sm text-slate-500 hover:text-blue-600">
                <i className="fa-solid fa-arrow-left mr-1"></i> Quay lại trang chủ
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
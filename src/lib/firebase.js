// src/lib/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyAg9Ex89QaMSyRH-0O7pwvWBJDvyz_x3jw",
    authDomain: "hotel-manager-2442d.firebaseapp.com",
    projectId: "hotel-manager-2442d",
    storageBucket: "hotel-manager-2442d.firebasestorage.app",
    messagingSenderId: "379010173725",
    appId: "1:379010173725:web:20908f11fb0589ca432ff4"
};

// Next.js có thể chạy lại file này nhiều lần trong quá trình dev, 
// kiểm tra xem app đã khởi tạo chưa để tránh lỗi
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
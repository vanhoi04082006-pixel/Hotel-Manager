/**
 * Main Application Entry Point
 * Khởi tạo ứng dụng và thiết lập các event listeners
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseConfig } from './config.js';
import { initializeAuth } from './auth.js';
import { initializeBooking } from './booking.js';
import { initializePayment } from './payment.js';
import { initializeAdmin } from './admin.js';
import { initializeUser } from './user.js';
import { setLoadingScreen, openModal, closeModal, showToast, validateEmail, validatePassword } from './utils.js';
import { loginWithEmail, registerWithEmail, loginWithGoogle, loginWithFacebook, resetPassword, logout } from './auth.js';

// ==================== GLOBAL STATE ====================
window.store = {
    currentUser: null,
    currentUserData: {},
    userRole: null,
    isLoginMode: true,
    localRooms: [],
    localBookings: [],
    localServices: [],
    localUsers: [],
    localPromotions: [],
    localStaff: [],
    localReviews: [],
    localGallery: [],
    localInvoices: [],
    localLogs: [],
    localMessages: [],
    currentAdminRoute: 'dashboard',
    currentUserRoute: 'home',
    currentRoomFilter: 'All',
    currentServiceCategory: 'All',
    adminBookingsPage: 0,
    adminBookingsLimit: 10,
    userRoomsPage: 0,
    userRoomsLimit: 6,
    userServicesPage: 0,
    userServicesLimit: 6,
    appliedPromo: null
};

// ==================== FIREBASE INITIALIZATION ====================
function initializeFirebase() {
    try {
        const app = initializeApp(firebaseConfig);
        const analytics = getAnalytics(app);
        const db = getFirestore(app);

        // Khởi tạo các module
        initializeAuth(app);
        initializeBooking(db);
        initializePayment(db);
        initializeAdmin(db);
        initializeUser(db);

        console.log('✅ Firebase initialized successfully');
        return { app, db };
    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        showToast('Lỗi khởi tạo ứng dụng: ' + error.message, 'error');
        return null;
    }
}

// ==================== AUTH FORM HANDLERS ====================
function setupAuthHandlers() {
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;

            if (window.store.isLoginMode) {
                // Đăng nhập
                await loginWithEmail(email, password);
            } else {
                // Đăng ký
                const confirmPassword = document.getElementById('auth-confirm-password').value;
                await registerWithEmail(email, password, confirmPassword);
            }
        });
    }

    // Toggle auth mode
    window.toggleAuthMode = () => {
        window.store.isLoginMode = !window.store.isLoginMode;
        document.getElementById('auth-title').textContent = window.store.isLoginMode ? 'Đăng Nhập' : 'Đăng Ký Tài Khoản';
        document.getElementById('auth-subtitle').textContent = window.store.isLoginMode
            ? 'Đăng nhập để trải nghiệm dịch vụ 5 sao'
            : 'Tạo tài khoản để nhận nhiều ưu đãi đặc biệt';
        document.getElementById('auth-submit-btn').innerHTML = `<span>${window.store.isLoginMode ? 'Đăng Nhập' : 'Đăng Ký'}</span>`;
        document.getElementById('auth-toggle-text').textContent = window.store.isLoginMode ? 'Chưa có tài khoản?' : 'Đã có tài khoản?';
        document.getElementById('auth-toggle-btn').textContent = window.store.isLoginMode ? 'Đăng ký ngay' : 'Đăng nhập';

        const confirmField = document.getElementById('confirm-password-field');
        if (confirmField) {
            if (window.store.isLoginMode) {
                confirmField.classList.add('hidden');
                document.getElementById('auth-confirm-password').removeAttribute('required');
            } else {
                confirmField.classList.remove('hidden');
                document.getElementById('auth-confirm-password').setAttribute('required', 'required');
            }
        }
    };

    // Google login
    window.handleGoogleLogin = async () => {
        await loginWithGoogle();
    };

    // Facebook login
    window.handleFacebookLogin = async () => {
        await loginWithFacebook();
    };

    // Forgot password
    window.handleForgotPassword = async () => {
        const email = document.getElementById('auth-email').value;
        if (!email) {
            showToast('Vui lòng nhập email', 'warning');
            return;
        }
        await resetPassword(email);
    };
}

// ==================== MODAL HANDLERS ====================
function setupModalHandlers() {
    // Global modal functions
    window.openModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
        }
    };

    window.closeModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
        }
    };

    // Close modal when clicking backdrop
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) {
            e.target.classList.add('hidden');
        }
    });
}

// ==================== LOGOUT HANDLER ====================
function setupLogoutHandler() {
    window.handleLogout = async () => {
        if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
            await logout();
        }
    };
}

// ==================== INITIALIZE APP ====================
async function initializeApp() {
    console.log('🚀 Initializing Luna Hotel Management System...');

    // Initialize Firebase
    const firebase = initializeFirebase();
    if (!firebase) {
        showToast('Không thể khởi tạo ứng dụng', 'error');
        return;
    }

    // Setup handlers
    setupAuthHandlers();
    setupModalHandlers();
    setupLogoutHandler();

    // Hide loading screen after initialization
    setTimeout(() => {
        setLoadingScreen(false);
    }, 1500);

    console.log('✅ Application initialized successfully');
}

// ==================== RUN ON DOCUMENT READY ====================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// ==================== GLOBAL ERROR HANDLER ====================
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showToast('Có lỗi xảy ra: ' + event.error?.message, 'error');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showToast('Có lỗi xảy ra: ' + event.reason?.message, 'error');
});

// ==================== EXPORT FOR TESTING ====================
export { initializeApp };

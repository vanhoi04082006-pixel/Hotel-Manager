/**
 * Firebase Configuration
 * Cấu hình Firebase cho ứng dụng Luna Hotel
 */

// Firebase Configuration Object
export const firebaseConfig = {
    apiKey: "AIzaSyAg9Ex89QaMSyRH-0O7pwvWBJDvyz_x3jw",
    authDomain: "hotel-manager-2442d.firebaseapp.com",
    projectId: "hotel-manager-2442d",
    storageBucket: "hotel-manager-2442d.firebasestorage.app",
    messagingSenderId: "379010173725",
    appId: "1:379010173725:web:20908f11fb0589ca432ff4",
    measurementId: "G-6YVST9PJYQ"
};

// Admin Email
export const ADMIN_EMAIL = 'lunanewyear@gmail.com';

// App Constants
export const CONSTANTS = {
    SERVICE_FEE_PERCENTAGE: 10,
    LOYALTY_POINTS_MULTIPLIER: 1,
    DEFAULT_PAGINATION_LIMIT: 10,
    MAX_UPLOAD_SIZE: 5 * 1024 * 1024 // 5MB
};

// Error Messages
export const ERROR_MESSAGES = {
    INVALID_EMAIL: 'Email không hợp lệ',
    PASSWORD_TOO_SHORT: 'Mật khẩu phải có ít nhất 6 ký tự',
    PASSWORD_MISMATCH: 'Mật khẩu không khớp',
    EMAIL_ALREADY_IN_USE: 'Email này đã được sử dụng',
    INVALID_LOGIN: 'Email hoặc mật khẩu sai',
    NETWORK_ERROR: 'Lỗi kết nối mạng',
    UNKNOWN_ERROR: 'Có lỗi xảy ra, vui lòng thử lại'
};

// Success Messages
export const SUCCESS_MESSAGES = {
    LOGIN_SUCCESS: 'Đăng nhập thành công',
    REGISTER_SUCCESS: 'Đăng ký thành công',
    LOGOUT_SUCCESS: 'Đăng xuất thành công',
    BOOKING_CREATED: 'Đặt phòng thành công',
    BOOKING_UPDATED: 'Cập nhật đặt phòng thành công',
    PAYMENT_SUCCESS: 'Thanh toán thành công'
};

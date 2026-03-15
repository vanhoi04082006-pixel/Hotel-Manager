/**
 * Utility Functions
 * Các hàm tiện ích dùng chung trong ứng dụng
 */

/**
 * Định dạng tiền tệ theo VND
 * @param {number} amount - Số tiền
 * @returns {string} - Số tiền đã định dạng
 */
export function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { 
        style: 'currency', 
        currency: 'VND' 
    }).format(amount);
}

/**
 * Định dạng ngày tháng
 * @param {Date|Timestamp} timestamp - Ngày cần định dạng
 * @returns {string} - Ngày đã định dạng (dd/mm/yyyy)
 */
export function formatDate(timestamp) {
    if (!timestamp) return '';
    try {
        const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('vi-VN', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
    } catch (e) {
        console.error('Format date error:', e);
        return '';
    }
}

/**
 * Định dạng ngày giờ
 * @param {Date|Timestamp} timestamp - Ngày cần định dạng
 * @returns {string} - Ngày giờ đã định dạng
 */
export function formatDateTime(timestamp) {
    if (!timestamp) return '';
    try {
        const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        console.error('Format datetime error:', e);
        return '';
    }
}

/**
 * Hiển thị thông báo Toast
 * @param {string} message - Nội dung thông báo
 * @param {string} type - Loại thông báo (success, error, warning, info)
 */
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');

    const icons = {
        success: 'fa-circle-check text-green-400',
        error: 'fa-circle-exclamation text-red-400',
        warning: 'fa-triangle-exclamation text-yellow-400',
        info: 'fa-circle-info text-blue-400'
    };

    const bgColors = {
        success: 'bg-green-50 border-green-200 text-green-800',
        error: 'bg-red-50 border-red-200 text-red-800',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800'
    };

    toast.className = `flex items-center p-4 rounded-xl shadow-lg border ${bgColors[type]} slide-in max-w-md`;
    toast.innerHTML = `
        <i class="fa-solid ${icons[type]} mr-3 text-xl"></i>
        <span class="font-medium">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Ẩn/Hiện loading screen
 * @param {boolean} show - true để hiện, false để ẩn
 */
export function setLoadingScreen(show) {
    const loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) return;

    if (show) {
        loadingScreen.style.display = 'flex';
        loadingScreen.style.opacity = '1';
    } else {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }
}

/**
 * Mở modal
 * @param {string} modalId - ID của modal
 */
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Đóng modal
 * @param {string} modalId - ID của modal
 */
export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Validate email
 * @param {string} email - Email cần kiểm tra
 * @returns {boolean} - true nếu hợp lệ
 */
export function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Validate mật khẩu
 * @param {string} password - Mật khẩu cần kiểm tra
 * @returns {boolean} - true nếu hợp lệ
 */
export function validatePassword(password) {
    return password && password.length >= 6;
}

/**
 * Tính số đêm giữa hai ngày
 * @param {Date|string} checkIn - Ngày nhận phòng
 * @param {Date|string} checkOut - Ngày trả phòng
 * @returns {number} - Số đêm
 */
export function calculateNights(checkIn, checkOut) {
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
}

/**
 * Tính tổng giá
 * @param {number} basePrice - Giá cơ bản
 * @param {number} nights - Số đêm
 * @param {number} serviceCost - Chi phí dịch vụ
 * @param {number} promoDiscount - Giảm giá
 * @param {number} serviceFeePct - % phí dịch vụ
 * @returns {number} - Tổng giá
 */
export function calculateTotal(basePrice, nights, serviceCost = 0, promoDiscount = 0, serviceFeePct = 10) {
    const roomTotal = basePrice * nights;
    const subtotal = roomTotal + serviceCost;
    const afterDiscount = subtotal - promoDiscount;
    const fee = (afterDiscount * serviceFeePct) / 100;
    return Math.round(afterDiscount + fee);
}

/**
 * Sinh ID ngẫu nhiên
 * @param {number} length - Độ dài
 * @returns {string} - ID ngẫu nhiên
 */
export function generateId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Delay async
 * @param {number} ms - Milliseconds
 * @returns {Promise}
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Debounce function
 * @param {Function} func - Hàm cần debounce
 * @param {number} wait - Thời gian chờ (ms)
 * @returns {Function} - Hàm đã debounce
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 * @param {Function} func - Hàm cần throttle
 * @param {number} limit - Thời gian limit (ms)
 * @returns {Function} - Hàm đã throttle
 */
export function throttle(func, limit = 300) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Copy text vào clipboard
 * @param {string} text - Text cần copy
 */
export function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Đã sao chép', 'success');
    }).catch(() => {
        showToast('Không thể sao chép', 'error');
    });
}

/**
 * Download file
 * @param {string} content - Nội dung file
 * @param {string} filename - Tên file
 * @param {string} type - MIME type
 */
export function downloadFile(content, filename, type = 'text/plain') {
    const element = document.createElement('a');
    element.setAttribute('href', `data:${type};charset=utf-8,${encodeURIComponent(content)}`);
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

/**
 * Parse URL parameters
 * @returns {Object} - Object chứa các parameters
 */
export function getUrlParams() {
    const params = {};
    new URLSearchParams(window.location.search).forEach((value, key) => {
        params[key] = value;
    });
    return params;
}

/**
 * Update URL parameters
 * @param {Object} params - Object chứa các parameters
 */
export function updateUrl(params) {
    const searchParams = new URLSearchParams();
    Object.forEach((key, value) => {
        searchParams.set(key, value);
    });
    window.history.replaceState({}, '', `?${searchParams.toString()}`);
}

/**
 * Check xem user có role nào không
 * @param {string} role - Role cần kiểm tra
 * @param {string} userRole - Role của user hiện tại
 * @returns {boolean}
 */
export function hasRole(userRole, role) {
    return userRole === role;
}

/**
 * Check xem object có empty không
 * @param {Object} obj - Object cần kiểm tra
 * @returns {boolean}
 */
export function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

/**
 * Deep clone object
 * @param {Object} obj - Object cần clone
 * @returns {Object} - Object đã clone
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

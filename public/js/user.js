/**
 * User Module
 * Quản lý các chức năng cho user thường
 */

import { showToast, formatCurrency, formatDate } from './utils.js';
import { getFirestore, collection, getDocs, addDoc, updateDoc, doc, query, where, Timestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let db;

export function initializeUser(firebaseDb) {
    db = firebaseDb;
}

/**
 * Lấy danh sách phòng có sẵn
 * @returns {Promise<Array>} - Mảng các phòng
 */
export async function getAvailableRooms() {
    try {
        const querySnapshot = await getDocs(
            query(collection(db, 'rooms'), where('status', '==', 'available'))
        );
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Get available rooms error:', error);
        return [];
    }
}

/**
 * Lấy tất cả phòng
 * @returns {Promise<Array>} - Mảng các phòng
 */
export async function getAllRooms() {
    try {
        const querySnapshot = await getDocs(collection(db, 'rooms'));
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Get all rooms error:', error);
        return [];
    }
}

/**
 * Lấy tất cả dịch vụ
 * @returns {Promise<Array>} - Mảng các dịch vụ
 */
export async function getAllServices() {
    try {
        const querySnapshot = await getDocs(collection(db, 'services'));
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Get all services error:', error);
        return [];
    }
}

/**
 * Lấy danh sách khuyến mãi đang hoạt động
 * @returns {Promise<Array>} - Mảng các khuyến mãi
 */
export async function getActivePromotions() {
    try {
        const today = new Date();
        const querySnapshot = await getDocs(
            query(collection(db, 'promotions'), where('active', '==', true))
        );

        return querySnapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            .filter(promo => {
                const startDate = new Date(promo.startDate || '2000-01-01');
                const endDate = new Date(promo.endDate || '2099-12-31');
                return today >= startDate && today <= endDate;
            });
    } catch (error) {
        console.error('Get active promotions error:', error);
        return [];
    }
}

/**
 * Lấy danh sách đánh giá
 * @returns {Promise<Array>} - Mảng các đánh giá
 */
export async function getApprovedReviews() {
    try {
        const querySnapshot = await getDocs(
            query(collection(db, 'reviews'), where('approved', '==', true))
        );
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB - dateA;
        });
    } catch (error) {
        console.error('Get approved reviews error:', error);
        return [];
    }
}

/**
 * Lấy danh sách thư viện ảnh
 * @returns {Promise<Array>} - Mảng các ảnh
 */
export async function getGallery() {
    try {
        const querySnapshot = await getDocs(collection(db, 'gallery'));
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Get gallery error:', error);
        return [];
    }
}

/**
 * Tạo đánh giá
 * @param {Object} reviewData - Dữ liệu đánh giá
 * @returns {Promise<string>} - ID đánh giá
 */
export async function submitReview(reviewData) {
    try {
        const review = {
            ...reviewData,
            approved: false,
            createdAt: Timestamp.now()
        };

        const docRef = await addDoc(collection(db, 'reviews'), review);
        showToast('Đánh giá của bạn đã được gửi. Vui lòng chờ phê duyệt!', 'success');
        return docRef.id;
    } catch (error) {
        console.error('Submit review error:', error);
        showToast('Lỗi gửi đánh giá: ' + error.message, 'error');
        throw error;
    }
}

/**
 * Lấy điểm trung bình từ các đánh giá
 * @returns {Promise<number>} - Điểm trung bình
 */
export async function getAverageRating() {
    try {
        const reviews = await getApprovedReviews();
        if (reviews.length === 0) return 0;

        const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
        return (totalRating / reviews.length).toFixed(1);
    } catch (error) {
        console.error('Get average rating error:', error);
        return 0;
    }
}

/**
 * Tìm kiếm phòng theo tiêu chí
 * @param {Object} criteria - Tiêu chí tìm kiếm
 * @returns {Promise<Array>} - Mảng phòng tìm được
 */
export async function searchRooms(criteria) {
    try {
        let rooms = await getAllRooms();

        if (criteria.minPrice) {
            rooms = rooms.filter(r => r.price >= criteria.minPrice);
        }

        if (criteria.maxPrice) {
            rooms = rooms.filter(r => r.price <= criteria.maxPrice);
        }

        if (criteria.capacity) {
            rooms = rooms.filter(r => r.capacity >= criteria.capacity);
        }

        if (criteria.type) {
            rooms = rooms.filter(r => r.type === criteria.type);
        }

        if (criteria.amenities && criteria.amenities.length > 0) {
            rooms = rooms.filter(r => {
                const roomAmenities = r.amenities || [];
                return criteria.amenities.every(amenity => roomAmenities.includes(amenity));
            });
        }

        return rooms;
    } catch (error) {
        console.error('Search rooms error:', error);
        showToast('Lỗi tìm kiếm phòng: ' + error.message, 'error');
        return [];
    }
}

/**
 * Lấy mã khuyến mãi
 * @param {string} code - Mã khuyến mãi
 * @returns {Promise<Object>} - Thông tin khuyến mãi
 */
export async function getPromotion(code) {
    try {
        const promotions = await getActivePromotions();
        const promo = promotions.find(p => p.code === code);

        if (!promo) {
            return null;
        }

        return promo;
    } catch (error) {
        console.error('Get promotion error:', error);
        return null;
    }
}

/**
 * Tính giảm giá từ mã khuyến mãi
 * @param {string} code - Mã khuyến mãi
 * @param {number} amount - Số tiền gốc
 * @returns {Promise<number>} - Số tiền giảm
 */
export async function calculateDiscount(code, amount) {
    try {
        const promo = await getPromotion(code);
        if (!promo) return 0;

        if (promo.type === 'percent') {
            return Math.round((amount * promo.value) / 100);
        } else if (promo.type === 'fixed') {
            return Math.min(promo.value, amount);
        }

        return 0;
    } catch (error) {
        console.error('Calculate discount error:', error);
        return 0;
    }
}

/**
 * Lấy thông tin hoàn cảnh khuyến mãi
 * @param {string} code - Mã khuyến mãi
 * @returns {Promise<string>} - Mô tả điều kiện
 */
export async function getPromoConditionDescription(code) {
    try {
        const promo = await getPromotion(code);
        if (!promo) return '';

        switch (promo.condition) {
            case 'all':
                return 'Áp dụng cho tất cả đơn hàng';
            case 'min_amount':
                return `Đơn tối thiểu ${formatCurrency(promo.minAmount || 0)}`;
            case 'first_booking':
                return 'Áp dụng cho lần đặt phòng đầu tiên';
            default:
                return '';
        }
    } catch (error) {
        console.error('Get promo condition description error:', error);
        return '';
    }
}

/**
 * Validate mã khuyến mãi
 * @param {string} code - Mã khuyến mãi
 * @param {number} amount - Số tiền
 * @param {boolean} isFirstBooking - Có phải lần đặt đầu tiên không
 * @returns {Promise<Object>} - Object {valid: boolean, message: string}
 */
export async function validatePromo(code, amount, isFirstBooking = false) {
    try {
        const promo = await getPromotion(code);

        if (!promo) {
            return { valid: false, message: 'Mã khuyến mãi không tồn tại' };
        }

        if (promo.condition === 'min_amount' && amount < promo.minAmount) {
            return { 
                valid: false, 
                message: `Đơn tối thiểu ${formatCurrency(promo.minAmount || 0)}` 
            };
        }

        if (promo.condition === 'first_booking' && !isFirstBooking) {
            return { 
                valid: false, 
                message: 'Mã khuyến mãi chỉ áp dụng cho lần đặt phòng đầu tiên' 
            };
        }

        return { 
            valid: true, 
            message: 'Mã khuyến mãi hợp lệ',
            promo 
        };
    } catch (error) {
        console.error('Validate promo error:', error);
        return { valid: false, message: 'Lỗi kiểm tra mã khuyến mãi' };
    }
}

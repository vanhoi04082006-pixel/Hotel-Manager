/**
 * Authentication Module
 * Quản lý đăng nhập, đăng ký, và xác thực người dùng
 */

import { firebaseConfig, ADMIN_EMAIL, ERROR_MESSAGES, SUCCESS_MESSAGES } from './config.js';
import { validateEmail, validatePassword, showToast, setLoadingScreen } from './utils.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Initialize Firebase
let auth, db;

export function initializeAuth(app) {
    auth = getAuth(app);
    db = getFirestore(app);
    setupAuthStateListener();
}

/**
 * Thiết lập listener cho auth state
 */
function setupAuthStateListener() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User đã đăng nhập
            const userData = await loadUserData(user.uid);
            window.store.currentUser = user;
            window.store.currentUserData = userData;
            window.store.userRole = userData.role || 'user';

            // Ẩn auth view, hiện admin hoặc user view
            document.getElementById('auth-view').classList.add('hidden');
            if (userData.role === 'admin') {
                document.getElementById('admin-view').classList.remove('hidden');
                document.getElementById('user-view').classList.add('hidden');
            } else {
                document.getElementById('user-view').classList.remove('hidden');
                document.getElementById('admin-view').classList.add('hidden');
            }

            setLoadingScreen(false);
        } else {
            // User chưa đăng nhập
            window.store.currentUser = null;
            window.store.currentUserData = {};
            window.store.userRole = null;

            document.getElementById('auth-view').classList.remove('hidden');
            document.getElementById('admin-view').classList.add('hidden');
            document.getElementById('user-view').classList.add('hidden');

            setLoadingScreen(false);
        }
    });
}

/**
 * Load dữ liệu người dùng từ Firestore
 * @param {string} uid - User ID
 * @returns {Object} - Dữ liệu người dùng
 */
async function loadUserData(uid) {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            return userDoc.data();
        }
        return {};
    } catch (error) {
        console.error('Error loading user data:', error);
        return {};
    }
}

/**
 * Đăng nhập bằng email và password
 * @param {string} email - Email người dùng
 * @param {string} password - Mật khẩu
 * @returns {Promise}
 */
export async function loginWithEmail(email, password) {
    try {
        if (!validateEmail(email)) {
            showToast(ERROR_MESSAGES.INVALID_EMAIL, 'error');
            return;
        }

        if (!validatePassword(password)) {
            showToast(ERROR_MESSAGES.PASSWORD_TOO_SHORT, 'error');
            return;
        }

        setLoadingScreen(true);
        const result = await signInWithEmailAndPassword(auth, email, password);
        showToast(SUCCESS_MESSAGES.LOGIN_SUCCESS, 'success');
        return result;
    } catch (error) {
        console.error('Login error:', error);
        let message = ERROR_MESSAGES.UNKNOWN_ERROR;
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            message = ERROR_MESSAGES.INVALID_LOGIN;
        } else if (error.code === 'auth/network-request-failed') {
            message = ERROR_MESSAGES.NETWORK_ERROR;
        }
        showToast(message, 'error');
        setLoadingScreen(false);
    }
}

/**
 * Đăng ký tài khoản mới
 * @param {string} email - Email người dùng
 * @param {string} password - Mật khẩu
 * @param {string} confirmPassword - Xác nhận mật khẩu
 * @param {Object} userData - Dữ liệu người dùng bổ sung
 * @returns {Promise}
 */
export async function registerWithEmail(email, password, confirmPassword, userData = {}) {
    try {
        if (!validateEmail(email)) {
            showToast(ERROR_MESSAGES.INVALID_EMAIL, 'error');
            return;
        }

        if (!validatePassword(password)) {
            showToast(ERROR_MESSAGES.PASSWORD_TOO_SHORT, 'error');
            return;
        }

        if (password !== confirmPassword) {
            showToast(ERROR_MESSAGES.PASSWORD_MISMATCH, 'error');
            return;
        }

        setLoadingScreen(true);
        const result = await createUserWithEmailAndPassword(auth, email, password);

        // Lưu thông tin người dùng vào Firestore
        await setDoc(doc(db, 'users', result.user.uid), {
            email: email,
            name: userData.name || '',
            phone: userData.phone || '',
            photoURL: '',
            role: email === ADMIN_EMAIL ? 'admin' : 'user',
            createdAt: new Date(),
            memberSince: new Date(),
            totalBookings: 0,
            totalSpent: 0,
            loyaltyPoints: 0,
            ...userData
        });

        showToast(SUCCESS_MESSAGES.REGISTER_SUCCESS, 'success');
        return result;
    } catch (error) {
        console.error('Register error:', error);
        let message = ERROR_MESSAGES.UNKNOWN_ERROR;
        if (error.code === 'auth/email-already-in-use') {
            message = ERROR_MESSAGES.EMAIL_ALREADY_IN_USE;
        } else if (error.code === 'auth/network-request-failed') {
            message = ERROR_MESSAGES.NETWORK_ERROR;
        }
        showToast(message, 'error');
        setLoadingScreen(false);
    }
}

/**
 * Đăng nhập bằng Google
 * @returns {Promise}
 */
export async function loginWithGoogle() {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Kiểm tra và tạo tài khoản nếu chưa tồn tại
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                name: user.displayName || '',
                phone: '',
                photoURL: user.photoURL || '',
                role: user.email === ADMIN_EMAIL ? 'admin' : 'user',
                createdAt: new Date(),
                memberSince: new Date(),
                totalBookings: 0,
                totalSpent: 0,
                loyaltyPoints: 0,
                provider: 'google'
            });
        }

        showToast('Đăng nhập với Google thành công!', 'success');
        return result;
    } catch (error) {
        console.error('Google login error:', error);
        showToast('Lỗi đăng nhập Google: ' + error.message, 'error');
    }
}

/**
 * Đăng nhập bằng Facebook
 * @returns {Promise}
 */
export async function loginWithFacebook() {
    try {
        const provider = new FacebookAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Kiểm tra và tạo tài khoản nếu chưa tồn tại
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                name: user.displayName || '',
                phone: '',
                photoURL: user.photoURL || '',
                role: user.email === ADMIN_EMAIL ? 'admin' : 'user',
                createdAt: new Date(),
                memberSince: new Date(),
                totalBookings: 0,
                totalSpent: 0,
                loyaltyPoints: 0,
                provider: 'facebook'
            });
        }

        showToast('Đăng nhập với Facebook thành công!', 'success');
        return result;
    } catch (error) {
        console.error('Facebook login error:', error);
        showToast('Lỗi đăng nhập Facebook: ' + error.message, 'error');
    }
}

/**
 * Quên mật khẩu
 * @param {string} email - Email người dùng
 * @returns {Promise}
 */
export async function resetPassword(email) {
    try {
        if (!validateEmail(email)) {
            showToast(ERROR_MESSAGES.INVALID_EMAIL, 'error');
            return;
        }

        await sendPasswordResetEmail(auth, email);
        showToast('Email reset mật khẩu đã được gửi. Vui lòng kiểm tra email!', 'success');
    } catch (error) {
        console.error('Reset password error:', error);
        let message = ERROR_MESSAGES.UNKNOWN_ERROR;
        if (error.code === 'auth/user-not-found') {
            message = 'Email không tồn tại';
        } else if (error.code === 'auth/network-request-failed') {
            message = ERROR_MESSAGES.NETWORK_ERROR;
        }
        showToast(message, 'error');
    }
}

/**
 * Đăng xuất
 * @returns {Promise}
 */
export async function logout() {
    try {
        await signOut(auth);
        showToast(SUCCESS_MESSAGES.LOGOUT_SUCCESS, 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Lỗi đăng xuất: ' + error.message, 'error');
    }
}

/**
 * Cập nhật thông tin người dùng
 * @param {string} uid - User ID
 * @param {Object} userData - Dữ liệu cần cập nhật
 * @returns {Promise}
 */
export async function updateUserProfile(uid, userData) {
    try {
        await setDoc(doc(db, 'users', uid), userData, { merge: true });
        showToast('Cập nhật thông tin thành công', 'success');
    } catch (error) {
        console.error('Update profile error:', error);
        showToast('Lỗi cập nhật thông tin: ' + error.message, 'error');
    }
}

/**
 * Get current user
 * @returns {Object} - Thông tin user hiện tại
 */
export function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Check xem user đã đăng nhập chưa
 * @returns {boolean}
 */
export function isLoggedIn() {
    return auth.currentUser !== null;
}

/**
 * Get user ID
 * @returns {string} - User ID
 */
export function getUserId() {
    return auth.currentUser?.uid || null;
}

# ✅ Firebase Deployment Checklist

## 📋 Chuẩn Bị Trước Deploy

### 1. **Kiểm Tra Cấu Trúc Thư Mục**
```
HotelManager/
├── public/                 ✅ (DEPLOY THIS)
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── config.js
│       ├── utils.js
│       ├── auth.js
│       ├── booking.js
│       ├── payment.js
│       ├── admin.js
│       ├── user.js
│       └── main.js
├── firebase.json           ✅ (Config file)
├── .firebaserc             ✅ (Project config)
└── Backup/                 ❌ (Không deploy)
```

### 2. **Files Cần Có Trong public/**

| File | Bắt Buộc | Ghi Chú |
|------|----------|--------|
| `index.html` | ✅ Yes | HTML structure |
| `css/styles.css` | ✅ Yes | Tất cả CSS |
| `js/config.js` | ✅ Yes | Firebase config |
| `js/main.js` | ✅ Yes | App init |
| `js/auth.js` | ✅ Yes | Login/Register |
| `js/utils.js` | ✅ Yes | Helper functions |
| `js/booking.js` | ✅ Yes | Booking logic |
| `js/payment.js` | ✅ Yes | Payment logic |
| `js/admin.js` | ✅ Yes | Admin features |
| `js/user.js` | ✅ Yes | User features |

### 3. **Không Nên Deploy**

❌ Những file/folder này NỀ có trong public/:
- `Backup/` - Chỉ dùng cho backup local
- `.git/` - Git metadata
- `node_modules/` - Không cần
- `.env` - Environment variables (bảo mật)
- `*.md` - Documentation
- `*.json` (ngoài config cần thiết)

## 🔧 Chuẩn Bị Deploy

### Bước 1: Kiểm Tra Firebase CLI

```bash
# Cài đặt Firebase CLI (nếu chưa có)
npm install -g firebase-tools

# Đăng nhập Firebase
firebase login

# Kiểm tra project
firebase projects:list
```

### Bước 2: Kiểm Tra Project Config

```bash
# Kiểm tra .firebaserc
cat .firebaserc

# Output sẽ giống như:
# {
#   "projects": {
#     "default": "hotel-manager-2442d"
#   }
# }
```

### Bước 3: Test Locally

```bash
# Chạy local emulator
firebase serve

# Mở browser
# http://localhost:5000
```

### Bước 4: Kiểm Tra firebase.json

```bash
# Đảm bảo firebase.json có:
# - "public": "public"
# - rewrites cho SPA (Single Page App)
# - ignore patterns đúng
```

## 🚀 Deploy Lên Firebase

### Option 1: Deploy Tất Cả
```bash
firebase deploy
```

### Option 2: Deploy Từng Service
```bash
# Deploy chỉ Hosting
firebase deploy --only hosting

# Deploy chỉ Firestore
firebase deploy --only firestore

# Deploy chỉ Functions
firebase deploy --only functions
```

### Option 3: Deploy Specific Project
```bash
# Nếu có nhiều project
firebase deploy --project hotel-manager-2442d
```

## ✨ Sau Deploy

### 1. **Kiểm Tra Live URL**

```bash
# Firebase sẽ hiển thị URL:
# Hosting URL: https://hotel-manager-2442d.web.app
```

### 2. **Verify Deployment**

```bash
# Check deployment status
firebase deploy:list

# View logs
firebase functions:log

# Check hosting
firebase hosting:list
```

### 3. **Test Ứng Dụng**

- [ ] Truy cập https://hotel-manager-2442d.web.app
- [ ] Kiểm tra Login/Register
- [ ] Kiểm tra Database connection
- [ ] Kiểm tra Console (F12) cho errors

### 4. **Xem Chi Tiết**

```bash
# Kiểm tra chi tiết deployment
firebase hosting:channel:list

# Xem version được deploy
firebase hosting:releases
```

## 🔙 Rollback (Quay Lại Phiên Bản Cũ)

```bash
# Xem các release
firebase hosting:releases

# Rollback tới version cụ thể
firebase hosting:releases:rollback <release_id>
```

## 🆘 Troubleshooting

### Problem: 404 Not Found
```bash
# Solution: Kiểm tra firebase.json rewrites
# Đảm bảo có rewrites cho SPA
```

### Problem: Files Not Updated
```bash
# Solution: Clear cache
# Ctrl+Shift+R (hard refresh)
# Hoặc xóa service worker cache
```

### Problem: Deploy Slow
```bash
# Solution: Kiểm tra file size
# Optimize images/assets
# Minify CSS/JS
```

## 📊 Monitoring

### View Analytics
- Firebase Console → Analytics

### View Performance
- Firebase Console → Performance Monitoring

### View Crashes
- Firebase Console → Crashlytics

## 📝 Environment Setup Cho Deploy

```bash
# Tạo .env.example (để share)
cat > .env.example << EOF
# Firebase Config (PUBLIC - SAFE)
FIREBASE_API_KEY=AIzaSyAg9Ex89QaMSyRH-0O7pwvWBJDvyz_x3jw
FIREBASE_AUTH_DOMAIN=hotel-manager-2442d.firebaseapp.com
FIREBASE_PROJECT_ID=hotel-manager-2442d

# Không commit .env nếu có secrets
EOF

# Add vào .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

## 🎉 Success Indicators

✅ Deploy thành công khi:
- `✔  Deploy complete!` - Console output
- URL accessible từ browser
- No 404 errors trong console
- Network requests đến Firebase thành công
- Firestore data có thể đọc/ghi

## 🔐 Security After Deploy

- [ ] Firestore Rules đã setup
- [ ] Storage Rules đã setup
- [ ] Authentication providers enabled
- [ ] CORS configured (nếu cần)
- [ ] SSL/HTTPS enabled (Firebase mặc định)

---

**Last Updated**: 2026-03-15
**Firebase Project**: hotel-manager-2442d
**Hosting Site**: lunahotel-777

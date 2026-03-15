# 🏨 Luna Hotel Management System - Firebase Deployment

## 📋 Cấu Trúc Thư Mục Public (Dùng Cho Firebase Hosting)

```
public/
├── index.html              # File HTML chính
├── css/
│   └── styles.css          # Tất cả CSS styles
├── js/
│   ├── config.js           # Firebase config & constants
│   ├── utils.js            # Utility functions
│   ├── auth.js             # Authentication logic
│   ├── booking.js          # Booking management
│   ├── payment.js          # Payment operations
│   ├── admin.js            # Admin dashboard
│   ├── user.js             # User operations
│   └── main.js             # App initialization
└── ...các file khác
```

## 🚀 Hướng Dẫn Deploy

### 1. **Chuẩn Bị**
```bash
# Cài đặt Firebase CLI nếu chưa có
npm install -g firebase-tools

# Login vào Firebase
firebase login
```

### 2. **Deploy**
```bash
# Deploy lên Firebase Hosting
firebase deploy

# Deploy từng service cụ thể
firebase deploy --only hosting    # Chỉ Hosting
firebase deploy --only firestore  # Chỉ Firestore
```

### 3. **Kiểm Tra**
```bash
# Kiểm tra status deployment
firebase deploy:list

# Xem logs
firebase functions:log
```

## 📁 Những File Nào Cần Trong public/

✅ **Bắt Buộc:**
- `index.html` - File HTML chính
- `css/styles.css` - Stylesheet
- `js/config.js` - Firebase config
- `js/main.js` - App initialization

✅ **Cần thiết:**
- `js/auth.js` - Authentication
- `js/utils.js` - Utility functions
- `js/booking.js` - Booking logic
- `js/payment.js` - Payment logic

✅ **Tùy chọn (nếu có):**
- `assets/` - Images, fonts (nếu không dùng CDN)
- `fonts/` - Custom fonts

❌ **Không cần:**
- `Backup/` - Chỉ dùng cho backup
- `node_modules/` - Không deploy dependencies
- `.git/` - Git files
- `.env` - Environment files (bảo mật)

## 🔒 Security Checklist

- [ ] Firebase config là **PUBLIC** - Không vấn đề gì (API key được bảo vệ bởi Firebase Rules)
- [ ] Không commit `.env` hoặc credentials
- [ ] Firestore Rules được cấu hình đúng
- [ ] Authentication providers được enable

## 📝 Firebase.json Config

File `firebase.json` định nghĩa cấu hình deployment:

```json
{
  "hosting": {
    "public": "public",
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "redirects": [],
    "headers": [
      {
        "source": "**/*.@(jpg|jpeg|gif|png|webp|svg|woff|woff2|ttf|eot)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  }
}
```

## 🔄 Quy Trình Deploy

1. **Commit code** → Git
2. **Test locally** → `firebase serve`
3. **Deploy** → `firebase deploy`
4. **Verify** → Kiểm tra URL https://your-project.web.app

## 🌐 URL Sau Deploy

- **Hosting URL**: `https://hotel-manager-2442d.web.app`
- **Project Console**: `https://console.firebase.google.com/project/hotel-manager-2442d`

## 📱 Cách Kiểm Tra Live

```bash
# Chạy local server để test trước khi deploy
firebase serve

# Truy cập http://localhost:5000
```

## 💡 Lưu Ý

- Firebase Hosting tự động HTTPS
- Tự động cache busting
- CDN global
- Tự động minification (tùy chọn)

---

**Last Updated**: 2026-03-15

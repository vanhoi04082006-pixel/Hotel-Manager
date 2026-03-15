# 🔥 Firebase Deploy - Hướng Dẫn Chi Tiết

## 📦 Những Gì Cần Deploy Vào public/

### ✅ BẮT BUỘC CÓ:

1. **index.html** 
   - File chính của ứng dụng
   - Địa chỉ: `public/index.html`

2. **css/styles.css**
   - Toàn bộ CSS
   - Địa chỉ: `public/css/styles.css`

3. **js/** (Folder JavaScript)
   ```
   js/config.js       → Firebase config
   js/utils.js        → Utility functions
   js/auth.js         → Authentication
   js/booking.js      → Booking logic
   js/payment.js      → Payment logic
   js/admin.js        → Admin features
   js/user.js         → User features
   js/main.js         → App initialization
   ```

### ✅ OPTIONAL (Tùy Chọn):

- `assets/` - Images, fonts (nếu lưu local)
- `public.xml` - PWA manifest
- `robots.txt` - SEO
- `.htaccess` - Server config
- `404.html` - Custom 404 page

### ❌ KHÔNG DEPLOY:

- ❌ `Backup/` - Chỉ dùng local
- ❌ `.git/` - Git metadata
- ❌ `.env` - Secret keys (dùng Firebase config thay thế)
- ❌ `node_modules/` - Dependencies
- ❌ `.md` files - Documentation
- ❌ Source code backups

## 📋 Cấu Trúc Ideal Cho Deploy

```
public/                          ← Deploy cái này
├── index.html                   ← Main file
├── css/
│   └── styles.css              ← CSS duy nhất
├── js/
│   ├── config.js               ← Firebase config (PUBLIC - OK)
│   ├── utils.js
│   ├── auth.js
│   ├── booking.js
│   ├── payment.js
│   ├── admin.js
│   ├── user.js
│   └── main.js
├── assets/                      ← (Optional) Images, fonts
│   ├── images/
│   ├── icons/
│   └── fonts/
├── 404.html                     ← (Optional) Custom 404
├── robots.txt                   ← (Optional) SEO
└── manifest.json               ← (Optional) PWA
```

## 🚀 Quick Deploy (3 Bước)

### Bước 1: Chuẩn Bị

```bash
# Mở terminal/command prompt
# Chuyển đến thư mục project
cd e:\Front End\HoltelManager

# Hoặc nếu dùng PowerShell
cd 'e:\Front End\HoltelManager'
```

### Bước 2: Deploy

```bash
# Deploy lên Firebase
firebase deploy

# HOẶC deploy chỉ hosting
firebase deploy --only hosting
```

### Bước 3: Verify

```bash
# Mở URL tự động trong browser:
# https://lunahotel-777.web.app
# HOẶC
# https://hotel-manager-2442d.web.app
```

## 🔍 Kiểm Tra Trước Deploy

### Terminal Commands:

```bash
# 1. Check Firebase login status
firebase auth:import

# 2. Check project config
firebase use -l

# 3. Verify public folder exists
ls public/
# hoặc Windows:
dir public\

# 4. Check file structure
tree public/
# hoặc Windows:
dir /s public\

# 5. Test locally first
firebase serve
# Mở http://localhost:5000
```

## 📝 File Paths Check

```bash
# Windows path check:
public\index.html              ✅
public\css\styles.css          ✅
public\js\config.js            ✅
public\js\utils.js             ✅
public\js\auth.js              ✅
public\js\booking.js           ✅
public\js\payment.js           ✅
public\js\admin.js             ✅
public\js\user.js              ✅
public\js\main.js              ✅

firebase.json                  ✅
.firebaserc                    ✅
```

## 🎯 Firebase.json Configuration

File `firebase.json` của bạn:

```json
{
  "hosting": {
    "site": "lunahotel-777",
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

✅ Đây là config đúng cho Single Page App!

## 🔐 Firebase Config Security

**Câu hỏi**: Config bên dưới có safe không?

```javascript
// public/js/config.js
export const firebaseConfig = {
    apiKey: "AIzaSyAg9Ex89QaMSyRH-0O7pwvWBJDvyz_x3jw",
    authDomain: "hotel-manager-2442d.firebaseapp.com",
    projectId: "hotel-manager-2442d",
    // ...
};
```

**Trả lời**: ✅ **HOÀN TOÀN SAFE!**

- Firebase API key được thiết kế để expose (public)
- Security được bảo vệ bởi Firestore Rules
- Không có secret key hoặc password
- Chỉ có metadata của project

## 📲 Sau Deploy - URLs Của Bạn

```
Site Name: lunahotel-777
Project ID: hotel-manager-2442d

URLs:
├─ https://lunahotel-777.web.app       ← Primary URL
├─ https://lunahotel-777.firebaseapp.com  ← Alternative
├─ https://hotel-manager-2442d.web.app    ← Project URL
└─ https://console.firebase.google.com/project/hotel-manager-2442d  ← Console
```

## ⚡ Performance Tips

Để deploy nhanh hơn:

```bash
# 1. Cleanup local cache
firebase cache:clean

# 2. Deploy only hosting (không deploy firestore/functions)
firebase deploy --only hosting

# 3. Deploy without cache
firebase deploy --force
```

## 🆘 Common Issues & Solutions

### ❌ "Cannot find module 'firebase-app.js'"

**Solution**: Kiểm tra script imports trong `index.html`
```html
<!-- ✅ CORRECT -->
<script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"></script>

<!-- ❌ WRONG -->
<script src="./firebase-app.js"></script>
```

### ❌ "404 on page refresh"

**Solution**: Đảm bảo `firebase.json` có rewrites:
```json
{
  "hosting": {
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### ❌ "Deployment hangs"

**Solution**: Kiểm tra internet connection
```bash
# Terminate dengan Ctrl+C
# Thử lại:
firebase deploy --force
```

### ❌ "Files not updating after deploy"

**Solution**: Clear browser cache
- Ctrl+Shift+Delete (Chrome)
- Hard refresh: Ctrl+Shift+R
- Hoặc Private/Incognito mode

## ✨ Verification After Deploy

```bash
# 1. Check deployment status
firebase hosting:releases

# 2. Check file deployment
firebase hosting:list

# 3. View real-time logs (functions)
firebase functions:log

# 4. Check performance
firebase functions:metrics
```

## 📊 Firebase Console Check

Sau deploy, kiểm tra:

1. **Hosting Tab**
   - ✅ See deployment listed
   - ✅ See last deploy time
   - ✅ See file count

2. **Database Tab**
   - ✅ Firestore Rules active
   - ✅ Test connection

3. **Authentication Tab**
   - ✅ Providers enabled (Google, Facebook, Email)

## 🔄 Update & Redeploy

Sau khi có thay đổi code:

```bash
# 1. Update code
# 2. Test locally (optional)
firebase serve

# 3. Deploy
firebase deploy --only hosting

# 4. Verify
firebase hosting:releases
```

## 💾 Backup Before Deploy

```bash
# Lưu version hiện tại
firebase hosting:releases

# Nếu có issue, rollback:
firebase hosting:releases:rollback <release_id>
```

## 🎉 Success Checklist

Deploy thành công khi:

- [ ] `✔  Deploy complete!` xuất hiện
- [ ] Có thể truy cập URL
- [ ] Home page load bình thường
- [ ] No console errors (F12)
- [ ] Firebase connection OK
- [ ] Auth form hoạt động
- [ ] Images/CSS load đúng

---

## 📞 Quy Tắc Deploy Của Bạn

**GHI NHỚ**:
1. Deploy **public/** folder
2. Firestore Rules bảo vệ data
3. Config là public (OK)
4. Không deploy Backup/
5. Test locally trước deploy

---

**Last Updated**: 2026-03-15 ⏰
**Status**: ✅ Ready to Deploy

# Lịch sử Tiến Độ Dự Án TuanDat English (Archive)

Tài liệu lưu trữ chi tiết toàn bộ các hạng mục đã hoàn thành và danh sách file đã chỉnh sửa qua từng giai đoạn. Xem trạng thái hiện tại, quyết định kỹ thuật cốt lõi và kế hoạch tiếp theo tại [PROGRESS.md](../../PROGRESS.md).

---

## 1. Bộ nhận diện & Tài nguyên tĩnh (`TuanDat`)

### Hình ảnh & Biểu tượng
Thiết lập đồng bộ icon, favicon, logo và mascot chim cánh cụt cho `TuanDat`:
- `public/assets/images/penguin-mascot.png` (mascot cho trang dictation & community)
- `public/favicon.ico`, `public/favicon/96x96.png`
- `public/assets/images/favicon/16x16.png`, `32x32.png`, `96x96.png`, `apple-touch-icon.png`, `favicon.ico`, `favicon.svg`, `logo.png`
- `public/assets/images/logo.png`, `logo-header.png`, `logo-footer.png`
- `public/assets/assets/logo.png`

### Mã nguồn & JS chunks
- [lib/rewrite.mjs](../../lib/rewrite.mjs):
  - Thay thế SVG logo inline bằng `<svg><image href="/assets/images/favicon/logo.png" .../></svg>`.
  - Dùng regex trong `rewriteBody` để gắn `?v=tuandat13` cho mọi thuộc tính `src="/_next/static/...js"` và `href="/_next/static/...css"`.
- [public/_next/static/chunks/main-0f4aa6f53e4508ff.js](../../public/_next/static/chunks/main-0f4aa6f53e4508ff.js): Cập nhật `getDeploymentIdQueryOrEmptyString()` trả về `"?v=tuandat13"` để Next.js route loader tải các chunk kèm query string mới.
- [public/_next/static/chunks/webpack-54d8d60c88d47f24.js](../../public/_next/static/chunks/webpack-54d8d60c88d47f24.js): Cập nhật `__webpack_require__.u` nối thêm `"?v=tuandat13"` cho mọi dynamic chunk.
- [public/_next/static/chunks/pages/_app-19a95d9017bc66c2.js](../../public/_next/static/chunks/pages/_app-19a95d9017bc66c2.js): Cập nhật component logo `t.Z` sang ảnh `/assets/images/favicon/logo.png`.
- [public/_next/static/chunks/pages/lessons/dictation/[lessonSlug]-95806c9eee963a67.js](../../public/_next/static/chunks/pages/lessons/dictation/%5BlessonSlug%5D-95806c9eee963a67.js): Thay `RiveAnimation` bằng `<img src="/assets/images/penguin-mascot.png" ...>`.
- [public/_next/static/chunks/pages/community-8dbbfaf0fe11f4d4.js](../../public/_next/static/chunks/pages/community-8dbbfaf0fe11f4d4.js): Hiển thị mascot chim cánh cụt `<img src="/assets/images/penguin-mascot.png" alt="TuanDat" ...>`.

## 2. Cấu hình Server & Cache

- [server.mjs](../../server.mjs):
  - `cachePolicy()` trả về `MUTABLE_CACHE` (`"no-cache"`) cho toàn bộ file để trình duyệt luôn kiểm tra bản mới.
  - Khởi chạy server bằng `node server.mjs --port=4173` trong thư mục `tuandat-english`.

## 3. Dọn giao diện phụ thuộc ngoài

- **Banner tải app (`AppBanner`) & thanh chia sẻ nổi (`ShareBar`)**:
  - [public/_next/static/chunks/7963-07d6ff3cd7352ba9.js](../../public/_next/static/chunks/7963-07d6ff3cd7352ba9.js): Vô hiệu hóa `AppBanner` và `ShareBar` (`()=>null`); xóa nút mạng xã hội trên header.
  - [public/_next/static/chunks/8874-b7741a5847b900ff.js](../../public/_next/static/chunks/8874-b7741a5847b900ff.js): Vô hiệu hóa `AppBanner` và `ShareBar` (`()=>null`); xóa mục tải app và dãy icon mạng xã hội ở footer; đặt thương hiệu `TuanDat`.
  - [public/_next/static/chunks/1594.980da426ab3ce945.js](../../public/_next/static/chunks/1594.980da426ab3ce945.js), [5220.875b4e60b4f9d9ea.js](../../public/_next/static/chunks/5220.875b4e60b4f9d9ea.js), [6197.4a604b8d99bc45fe.js](../../public/_next/static/chunks/6197.4a604b8d99bc45fe.js): Trả `null` cho banner/share bar.
- **Các trang thành phần**:
  - Ẩn khối tải app, liên kết mạng xã hội ngoài trên trang chủ, `about-us`, `community`, `authors`, `advisors`, `link`.
  - Đồng bộ bộ lọc `stripExternalHtmlBlocks(text)` trong [lib/rewrite.mjs](../../lib/rewrite.mjs).

## 4. Chế độ Miễn phí 100%

- **Server & API ([server.mjs](../../server.mjs), [lib/rewrite.mjs](../../lib/rewrite.mjs), `public/api/*`)**:
  - Chặn và redirect (`302` về `/`, và trả `__N_REDIRECT` cho `_next/data`) đối với `/pricing`, `/checkout`, `/activation`, `/affiliate` (kể cả prefix ngôn ngữ như `/vi/...`).
  - Các API thanh toán/gói/giới thiệu (`/api/prices`, `/api/promo/active`, `/api/affiliate`, `/api/orders`, `/api/payment`, `/api/activation`) trả `{"data":[]}`.
  - Chuẩn hóa `"is_pro":true` -> `"is_pro":false`, `"is_free":false` -> `"is_free":true` trong `lib/rewrite.mjs` và `public/api/lessons.*.json`.
- **Frontend & Chunks**:
  - Ép `isPremium` trong `AuthProvider` luôn là `true`, vô hiệu hóa `CheckoutModal`, `PremiumRequiredModal`, `ThankYouModal`, `EventPromoModal`, `GoogleAdsLoader`, `ProBadge`, `QuotaWidget`, vương miện Pro và các kiểm tra giới hạn Free/Pro.
  - Hợp nhất hạn mức trong `getVocabularyLimits` và `Ub` (`10` bộ, `250` nhóm, `8e3` thẻ, `5e3` mục).

## 5. Backend Supabase PostgreSQL & Xác thực Email

- **Supabase PostgreSQL Schema & RLS (Project ref `kzbostitltwpeddpfhqo`)**:
  - Khởi tạo 8 bảng (`public.profiles`, `public.public_profiles`, `public.usernames`, `public.vocabulary_reviews`, `public.vocabulary_decks`, `public.sentence_notes`, `public.purchased_items`, `public.notifications`), khóa ngoại kèm index, trigger `private.sync_public_profile()`, và bật RLS đầy đủ.
- **Backend Auth & PostgreSQL ([lib/supabase.mjs](../../lib/supabase.mjs), [lib/auth-backend.mjs](../../lib/auth-backend.mjs), [server.mjs](../../server.mjs))**:
  - Nạp biến môi trường từ `tuandat-english/.env` (`.env.example` làm mẫu).
  - Hỗ trợ Supabase Auth Email OTP / Magic Link (`send-otp`, `verify-otp`, `verify-link` hỗ trợ `access_token` / `token_hash` / `pkce_...`, `session` / `me` kèm `refreshSessionCoalesced()`, `logout`) và đầy đủ API hồ sơ, ví kim cương, streak, cấp độ, tiến độ bài học, từ vựng, ghi chú câu, shop vật phẩm, nhiệm vụ và thông báo.
- **Kiểm thử & Vá lỗi**:
  - Vượt qua `node --check`, 16/16 test API xác thực, kiểm thử UI `/login`, `LoginModal`, end-to-end Email OTP với Gmail, và kiểm thử trình duyệt trên `/vi/shadowing`, `/vi/dictation`, `/vi/topics`, `/vi/community-lessons` (`0` lỗi console).

## 6. Hoàn thiện Dự án Độc lập `tuandat-english` (`2026-11-15`)

- Đổi tên thư mục dự án, `package.json`, `package-lock.json`, và thông điệp server sang `tuandat-english` (`TuanDat English`).
- Gỡ bỏ các script và module đồng bộ/fallback bên ngoài; làm sạch toàn bộ dữ liệu tĩnh HTML, JS chunks, API JSON và tài liệu để dự án vận hành hoàn toàn độc lập.

## 7. Gỡ bỏ quảng cáo Baolingo (`2026-11-15`)

- [public/_next/static/chunks/pages/dashboard-2e4aff35c224b098.js](../../public/_next/static/chunks/pages/dashboard-2e4aff35c224b098.js): Gỡ `BaolingoCard`, dữ liệu Lottie kèm theo và khung `<div class="w-full lg+:w-[620px] lg+:flex-shrink-0">` trong `DashboardPage`.
- [public/dashboard.html](../../public/dashboard.html), [public/vi/dashboard.html](../../public/vi/dashboard.html), [public/missions.html](../../public/missions.html), [public/vi/missions.html](../../public/vi/missions.html), [public/profile.html](../../public/profile.html), [public/vi/profile.html](../../public/vi/profile.html): Xóa khối HTML SSR quảng cáo `https://baolingo.app/` và chuỗi khóa dịch `baolingo` trong `__NEXT_DATA__`.
- [lib/rewrite.mjs](../../lib/rewrite.mjs): Bổ sung lọc khối quảng cáo `https://baolingo.app/` trong `stripExternalHtmlBlocks()` và nâng cache-busting lên `?v=tuandat14` đồng bộ với [main-0f4aa6f53e4508ff.js](../../public/_next/static/chunks/main-0f4aa6f53e4508ff.js) và [webpack-54d8d60c88d47f24.js](../../public/_next/static/chunks/webpack-54d8d60c88d47f24.js).

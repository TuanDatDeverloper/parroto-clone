# TuanDat (Parroto Clone — Bản phục vụ miễn phí 100%)

Bản tự host đa ngôn ngữ (khoá học, nghe chép chính tả, truyện chêm, từ vựng, trò chơi, đề thi IELTS/TOEIC, blog) được tuỳ chỉnh từ bản mirror tĩnh để chạy độc lập trên máy, sử dụng backend Supabase PostgreSQL + Supabase Auth (Email OTP / Magic Link) và mở khóa hoàn toàn miễn phí cho tất cả người dùng.

## Kiến trúc

```
parroto-clone/
├── public/                 # toàn bộ site (HTML, JS, CSS, ảnh, font, dữ liệu)
│   ├── _next/              # bundle Next.js + data payload từng trang/ngôn ngữ
│   ├── blog/               # site Astro độc lập (bài viết, asset _astro)
│   ├── assets/             # ảnh, logo/mascot TuanDat và tài nguyên cục bộ
│   ├── api/                # fixture JSON của API (kèm mã trạng thái)
│   └── **/*.html           # từng route của site
├── server.mjs              # HTTP server, chuyển hướng route thanh toán, rewrite và phục vụ API/fixture
├── lib/
│   ├── supabase.mjs        # nạp .env và khởi tạo Supabase client (@supabase/supabase-js)
│   ├── auth-backend.mjs    # xác thực Email OTP / Magic Link và API người dùng trên Supabase PostgreSQL
│   ├── rewrite.mjs         # đổi URL, thương hiệu, lọc HTML Pro/app-download/social và mở khóa is_pro
│   ├── api-fixtures.mjs    # tra fixture theo method + path + query
│   ├── origin-fallback.mjs # tải và cache route chưa mirror từ origin
│   └── mime.mjs            # content-type
├── scripts/
│   ├── inventory.mjs       # lập danh mục route từ sitemap + _buildManifest
│   ├── mirror.mjs          # mirror HTML và tài nguyên
│   ├── mirror-data.mjs     # tải _next/data payload thật cho từng route/ngôn ngữ
│   └── verify.mjs          # kiểm tra toàn bộ route trên server nội bộ
├── data/                   # danh mục route, báo cáo mirror, kết quả kiểm tra
├── docs/archive/           # lịch sử tiến độ chi tiết qua từng giai đoạn
├── .env.example            # mẫu biến môi trường Supabase (tạo .env cục bộ khi chạy)
└── PROGRESS.md             # trạng thái hiện tại và quyết định kỹ thuật cốt lõi
```

## Cấu hình & Chạy

1. Tạo file `.env` từ `.env.example` trong thư mục `parroto-clone/` và điền thông tin Supabase project:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
SITE_URL=http://127.0.0.1:4173
```

2. Cài dependency (nếu chưa cài) và khởi chạy server:

```bash
npm install
node server.mjs --port=4173
```

Mở `http://127.0.0.1:4173` (hoặc chạy `npm run serve`).

## Các tuỳ chỉnh đã thực hiện

Xem chi tiết từng file tại [PROGRESS.md](./PROGRESS.md) và [docs/archive/progress-history.md](./docs/archive/progress-history.md):

- **Thương hiệu & giao diện `TuanDat`**: Thay toàn bộ logo, favicon, tên thương hiệu thành `TuanDat` và thay mascot cũ bằng chim cánh cụt `/assets/images/penguin-mascot.png`.
- **Phục vụ miễn phí 100% (gỡ Pro & thanh toán)**:
  - Chặn và chuyển hướng `302` về `/` (kèm redirect `_next/data`) cho `/pricing`, `/checkout`, `/activation`, `/affiliate` (và các route đa ngôn ngữ tương ứng); xóa các trang HTML tĩnh của chúng.
  - Làm rỗng API gói/khuyến mãi/giới thiệu (`/api/prices`, `/api/promo/active`, `/api/affiliate`, `/api/orders`, `/api/payment`, `/api/activation`) và chuẩn hóa `"is_pro":false`, `"is_free":true` trên API lẫn SSR HTML.
  - Gỡ bỏ toàn bộ nút `PRO` / `Unlock Pro`, liên kết `/pricing` và `/affiliate` trên header/sidebar/profile, các modal thanh toán/yêu cầu nâng cấp (`CheckoutModal`, `PremiumRequiredModal`, `ThankYouModal`, `EventPromoModal`), quảng cáo (`GoogleAdsLoader`), huy hiệu `ProBadge`, vương miện Pro trên avatar và các banner giới hạn Free/Pro.
  - Mở khóa miễn phí toàn bộ bài học dictation/shadowing, truyện chêm, đề thi IELTS/TOEIC, bộ từ vựng, trò chơi, tạo bài học YouTube và nâng tối đa hạn mức sổ tay/từ vựng cá nhân.
- **Xác thực Email thật & Backend Supabase PostgreSQL**:
  - Gỡ Firebase Auth runtime và các nút Google/Apple login (`/api/auth/google` trả `400`).
  - Xác thực qua Supabase Auth Email OTP / Magic Link (`/api/auth/email/send-otp`, `/api/auth/email/verify-otp`, `/api/auth/email/verify-link`, `/api/auth/session`, `/api/auth/me`, `/api/auth/logout`) với cookie phiên (`access_token`, `refresh_token`), tự động làm mới phiên (có gộp request đồng thời) và Bearer token.
  - Lưu trữ toàn bộ dữ liệu người dùng (hồ sơ, ví kim cương, streak, cấp độ, tiến độ bài học, từ vựng, ghi chú câu, vật phẩm shop, thông báo) trên Supabase PostgreSQL với RLS theo JWT người dùng.
- **Dọn liên kết ngoài**: Gỡ bỏ toàn bộ banner/QR tải app di động, video quảng bá ngoài, nút Facebook Community và liên kết mạng xã hội ngoài khỏi giao diện.

## Quy mô bản mirror gốc

| Hạng mục | Số lượng |
| --- | --- |
| Route HTML gốc | 6.441 (static 680, app 289, sitemap 3.910, blog 1.562; đã xóa trang pricing/checkout/activation/affiliate) |
| Ngôn ngữ | 17 (en, ar, de, el, es, id, ja, ko, ms, pt, ru, th, tr, uk, vi, zh-CN, zh-TW) |
| Data payload Next.js | 4.882 file |
| Dung lượng `public/` | ~2,3 GB |
| Fixture API | 37 endpoint (GET/POST, giữ nguyên mã trạng thái gốc) |

## Cách hoạt động

1. **Rewrite khi phục vụ.** `server.mjs` phục vụ tệp tĩnh, fixture API và fallback qua `rewriteBody()` trong `lib/rewrite.mjs` để chuẩn hóa đường dẫn nội bộ (`/assets/...`, `/api/...`, `/podcast/...`), thương hiệu `TuanDat`, trạng thái `"is_pro":false`, và lọc các khối HTML Pro/tải app/mạng xã hội/đăng nhập ngoài khỏi SSR HTML; đồng thời gắn query `?v=tuandat12` với `Cache-Control: no-cache` để trình duyệt luôn nhận bundle mới.
2. **Chặn route trả phí.** Mọi yêu cầu tới `/pricing`, `/checkout`, `/activation`, `/affiliate` hoặc `_next/data` tương ứng đều được chuyển hướng về `/`.
3. **Nav phía client.** Next.js tải `_next/data/<buildId>/<locale>/<route>.json` nội bộ để lấy props và bản dịch cho các trang.
4. **API & Backend Supabase.** `lib/auth-backend.mjs` xử lý động các endpoint `/api/auth/*`, `/api/user/*`, `/api/wallet`, `/api/streak*`, `/api/level*`, `/api/lessons/progress`, `/api/missions/today`, `/api/notifications*`, `/api/learning-time/*`, `/api/sentences/review*`, `/api/learning-vocabulary/*`, `/api/sentence-notes*`, `/api/shop/items/purchased*` trực tiếp với Supabase Auth & PostgreSQL (RLS). Các API đọc nội dung còn lại phục vụ từ fixture JSON (đã qua `rewriteBody()`); API giá/khuyến mãi/thanh toán trả `{"data":[]}`. Endpoint chưa chụp trả `404 {"error":"endpoint not captured"}`.
5. **Route ngoài danh mục** được tải từ origin ở lần truy cập đầu (chạy qua `rewriteBody()`) rồi cache vào `public/`.

## Hạn chế

- Một số tính năng cộng đồng thời gian thực (bảng xếp hạng trực tiếp, tin nhắn riêng giữa nhiều người dùng từ xa) trả về dữ liệu cục bộ/mặc định thay cho server gốc.
- Route ngoài danh mục cần Internet cho lần tải đầu; sau đó chạy offline.
- Âm thanh và video YouTube vẫn phát từ nguồn bên thứ ba.

## Làm mới dữ liệu & Kiểm thử

```bash
npm run inventory      # cập nhật danh mục route từ sitemap
npm run mirror         # mirror HTML + tài nguyên
npm run data           # tải lại data payload Next.js
npm run verify         # kiểm tra toàn bộ 6.441 route trên server cục bộ (lưu báo cáo vào data/verify-open.json)
```

## Nguồn và bản quyền

Bản clone học tập và nghiên cứu kỹ thuật dựa trên mã nguồn/dữ liệu gốc của Parroto.

# TuanDat English — Nền tảng học tiếng Anh miễn phí 100%

Nền tảng học tiếng Anh đa ngôn ngữ (khoá học, nghe chép chính tả, shadowing qua video, truyện chêm, từ vựng, trò chơi, đề thi IELTS/TOEIC, blog) được xây dựng và vận hành độc lập bởi Nguyễn Sỹ Tuấn Đạt, sử dụng backend Supabase PostgreSQL + Supabase Auth (Email OTP / Magic Link) và phục vụ hoàn toàn miễn phí cho tất cả người dùng.

## Kiến trúc

```
tuandat-english/
├── public/                 # toàn bộ giao diện & tài nguyên tĩnh (HTML, JS, CSS, ảnh, font, dữ liệu)
│   ├── _next/              # bundle Next.js + data payload từng trang/ngôn ngữ
│   ├── blog/               # chuyên trang bài viết (Astro static + _astro assets)
│   ├── assets/             # ảnh, logo/mascot chim cánh cụt TuanDat và tài nguyên cục bộ
│   ├── api/                # dữ liệu JSON nội bộ cho các module học tập
│   └── **/*.html           # từng route của ứng dụng
├── server.mjs              # HTTP server, điều hướng route, rewrite SSR/API và phục vụ dữ liệu
├── lib/
│   ├── supabase.mjs        # nạp .env và khởi tạo Supabase client (@supabase/supabase-js)
│   ├── auth-backend.mjs    # xác thực Email OTP / Magic Link và API người dùng trên Supabase PostgreSQL
│   ├── rewrite.mjs         # tối ưu HTML/API, áp dụng nhận diện TuanDat và mở khóa toàn bộ nội dung
│   ├── api-fixtures.mjs    # tra cứu dữ liệu API nội bộ theo method + path + query
│   └── mime.mjs            # ánh xạ content-type
├── scripts/
│   └── verify.mjs          # kiểm tra toàn bộ route trên server nội bộ
├── data/                   # danh mục route kiểm thử (routes.json)
├── docs/archive/           # lịch sử tiến độ chi tiết qua từng giai đoạn
├── .env.example            # mẫu biến môi trường Supabase (tạo .env cục bộ khi chạy)
└── PROGRESS.md             # trạng thái hiện tại và quyết định kỹ thuật cốt lõi
```

## Cấu hình & Chạy

1. Tạo file `.env` từ `.env.example` trong thư mục `tuandat-english/` và điền thông tin Supabase project:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
SITE_URL=http://127.0.0.1:4173
```

2. Di chuyển vào thư mục `tuandat-english`, cài dependency (nếu chưa cài) và khởi chạy server:

```bash
cd tuandat-english
npm install
node server.mjs --port=4173
```

Mở `http://127.0.0.1:4173` (hoặc chạy `npm run serve` / `npm start`).

## Tính năng & Tuỳ chỉnh cốt lõi

Xem chi tiết từng giai đoạn tại [PROGRESS.md](./tuandat-english/PROGRESS.md) và [progress-history.md](./tuandat-english/docs/archive/progress-history.md):

- **Nhận diện thương hiệu `TuanDat`**: Toàn bộ logo, favicon, tên thương hiệu `TuanDat` và mascot chim cánh cụt `/assets/images/penguin-mascot.png`.
- **Phục vụ miễn phí 100%**:
  - Chuyển hướng `302` về `/` (kèm redirect `_next/data`) đối với các route thanh toán/gói trả phí (`/pricing`, `/checkout`, `/activation`, `/affiliate`), đảm bảo toàn bộ tính năng mở hoàn toàn miễn phí.
  - Chuẩn hóa `"is_pro":false`, `"is_free":true` trên API lẫn SSR HTML.
  - Mở khóa miễn phí toàn bộ bài học dictation/shadowing, truyện chêm, đề thi IELTS/TOEIC, bộ từ vựng, trò chơi, tạo bài học YouTube và nâng tối đa hạn mức sổ tay/từ vựng cá nhân.
- **Xác thực Email thật & Backend Supabase PostgreSQL**:
  - Xác thực qua Supabase Auth Email OTP / Magic Link (`/api/auth/email/send-otp`, `/api/auth/email/verify-otp`, `/api/auth/email/verify-link`, `/api/auth/session`, `/api/auth/me`, `/api/auth/logout`) với cookie phiên (`access_token`, `refresh_token`), tự động làm mới phiên (có gộp request đồng thời) và Bearer token.
  - Lưu trữ toàn bộ dữ liệu người dùng (hồ sơ, ví kim cương, streak, cấp độ, tiến độ bài học, từ vựng, ghi chú câu, vật phẩm shop, thông báo) trên Supabase PostgreSQL với RLS theo JWT người dùng.

## Quy mô ứng dụng

| Hạng mục | Số lượng |
| --- | --- |
| Ngôn ngữ hỗ trợ | 17 (`en`, `ar`, `de`, `el`, `es`, `id`, `ja`, `ko`, `ms`, `pt`, `ru`, `th`, `tr`, `uk`, `vi`, `zh-CN`, `zh-TW`) |
| Endpoint dữ liệu nội bộ | 37 endpoint (GET/POST) + đầy đủ API Auth/User động |

## Cách hoạt động

1. **Phục vụ & Tối ưu khi render.** `server.mjs` phục vụ tệp tĩnh, dữ liệu JSON nội bộ và chạy qua `rewriteBody()` trong `lib/rewrite.mjs` để chuẩn hóa trạng thái `"is_pro":false`, làm sạch khối HTML dư thừa và gắn query `?v=tuandat13` với `Cache-Control: no-cache` để trình duyệt luôn nhận bản mới nhất.
2. **Điều hướng phía client.** Next.js tải `_next/data/<buildId>/<locale>/<route>.json` nội bộ để lấy props và bản dịch cho các trang.
3. **API & Backend Supabase.** `lib/auth-backend.mjs` xử lý động các endpoint `/api/auth/*`, `/api/user/*`, `/api/wallet`, `/api/streak*`, `/api/level*`, `/api/lessons/progress`, `/api/missions/today`, `/api/notifications*`, `/api/learning-time/*`, `/api/sentences/review*`, `/api/learning-vocabulary/*`, `/api/sentence-notes*`, `/api/shop/items/purchased*` trực tiếp với Supabase Auth & PostgreSQL (RLS). Các API đọc nội dung còn lại phục vụ từ dữ liệu JSON nội bộ (đã qua `rewriteBody()`).

## Kiểm thử

```bash
cd tuandat-english
npm run verify         # kiểm tra toàn bộ route trong data/routes.json trên server cục bộ
```

## Tác giả

Dự án cá nhân **TuanDat English** — phát triển và bảo trì bởi **Nguyễn Sỹ Tuấn Đạt**.

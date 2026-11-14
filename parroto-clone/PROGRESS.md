# Tiến Độ Dự Án TuanDat (Parroto Clone)

Cập nhật lần cuối: `2026-11-14` | Lịch sử chi tiết các hạng mục đã hoàn thành: [progress-history.md](./docs/archive/progress-history.md)

## 1. Quyết định kỹ thuật cốt lõi

- **Thương hiệu & tài nguyên tĩnh**: Đổi toàn bộ sang `TuanDat` với mascot chim cánh cụt (`/assets/images/penguin-mascot.png`, `/assets/images/favicon/logo.png`).
- **Cache-busting & Rewrite SSR**:
  - `server.mjs` trả `Cache-Control: no-cache` (`MUTABLE_CACHE`) cho mọi file, khởi chạy qua `node server.mjs --port=4173`.
  - Không sửa tên file JS trong `_buildManifest.js`; dùng regex trong `rewriteBody()` ([lib/rewrite.mjs](./lib/rewrite.mjs)) cùng `main-0f4aa6f53e4508ff.js` và `webpack-54d8d60c88d47f24.js` để gắn đồng bộ `?v=tuandat12` cho asset `/_next/static/*`.
- **Chính sách miễn phí 100% & dọn liên kết ngoài**:
  - Chặn/redirect `302` về `/` (kèm `__N_REDIRECT` cho `_next/data`) các route `/pricing`, `/checkout`, `/activation`, `/affiliate`; API thanh toán/gói/khuyến mãi trả `{"data":[]}`.
  - Ép `isPremium = true` ở `AuthProvider`, chuẩn hóa `"is_pro":false`, `"is_free":true` trong API/SSR; vô hiệu hóa `ProBadge`, `AppBanner`, `ShareBar`, modal thanh toán/quảng cáo, QR tải app và link MXH ngoài qua chunk + `stripExternalHtmlBlocks()`.
  - Hợp nhất hạn mức từ vựng tối đa (`10` bộ, `250` nhóm, `8e3` thẻ, `5e3` mục).
- **Database Supabase PostgreSQL**:
  - Project `tuandat-parroto` (ref `kzbostitltwpeddpfhqo`), migration `init_parroto_postgres_schema` gồm 8 bảng (`profiles`, `public_profiles`, `usernames`, `vocabulary_reviews`, `vocabulary_decks`, `sentence_notes`, `purchased_items`, `notifications`) + trigger `private.sync_public_profile()`, bật RLS đầy đủ theo user JWT (thay thế hoàn toàn `data/users.json` cũ).
  - Nạp cấu hình từ `.env` (mẫu `.env.example`, không commit theo `.gitignore`).
- **Xác thực Email thật & Quy ước Frontend**:
  - Gỡ Firebase Auth runtime; dùng Supabase Auth Email OTP / Magic Link (`/api/auth/email/send-otp`, `verify-otp`, `verify-link`, `session`, `me`, `logout`) qua cookie phiên (`access_token`, `refresh_token`) + Bearer token; vô hiệu hóa Google/Apple login (`POST /api/auth/google` trả `400`).
  - Giữ các bản vá UI quan trọng: tránh lỗi TDZ `isPremium:w=!0` trong `CreateCommunityLessonCard` (`5247`), tránh shadow biến `v` gây `React error #130` ở `LoginModal`/`EncourageLoginModal` (`7468`), và giữ key số ít (`avatar_frame`, `background`, `name_color`, `badge`) ở `/api/shop/items/purchased/by-type`.

## 2. Tính năng đã chạy ổn định

- **Server & Rewrite**: Phục vụ tĩnh, proxy fallback origin, rewrite SSR/API, chuyển hướng route trả phí và cache-busting `?v=tuandat12`.
- **Giao diện sạch & Miễn phí toàn bộ**: Đổi nhận diện `TuanDat`, mở khóa toàn bộ bài học dictation, shadowing, truyện chêm, từ vựng, mini-game, đề thi IELTS/TOEIC và tạo bài học YouTube.
- **Auth & Backend Supabase**: Đăng nhập/đăng ký qua Email OTP & Magic Link, duy trì/làm mới phiên tự động qua Axios interceptor + cookie phiên (`access_token`, `refresh_token`, chống race condition khi làm mới đồng thời); đầy đủ API hồ sơ, upload avatar/background, ví kim cương, streak, cấp độ, tiến độ bài học, từ vựng, ghi chú câu, shop vật phẩm, nhiệm vụ ngày và thông báo.
- **Kiểm thử gần nhất**:
  - Vượt qua `node --check`, 16/16 test API xác thực (`/api/auth/email/*`, `/api/auth/session`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/google`), kiểm thử UI (`/login`, `/vi/login`, `LoginModal`), và end-to-end Email OTP thật với Gmail (`datcline3@gmail.com`).
  - Rà soát `/practice-english-speaking`, `/vi/practice-english-speaking`, `/topics`, `/vi/topics` và `/topics/movie-short-clip` sạch liên kết MXH/tải app/Pro; chạy `npm run verify` trên `6.441` route (`app` `289/289`, `sitemap` `3.910/3.910`, `blog` `1.562/1.562`, `static` `664/680` — `16` route báo `404` là các trang `/<locale>/404`).

## 3. Lỗi tồn đọng & Tác vụ đang làm dở

- **Giới hạn hệ thống đã biết**: Bảng xếp hạng trực tiếp và chat riêng nhiều người dùng trả dữ liệu cục bộ/mặc định; một số query fixture chưa mirror (như `/api/lessons?...&topic_slug=movie-short-clip`) trả `404`; audio/video YouTube phụ thuộc bên thứ ba; route ngoài danh mục cần Internet ở lần tải đầu.

## 4. Kế hoạch các bước tiếp theo

- Hiện toàn bộ hạng mục cốt lõi và kiểm thử đã hoàn tất. Tiếp tục bổ sung fixture hoặc nâng cấp bảng xếp hạng/chat thời gian thực qua Supabase nếu cần mở rộng.

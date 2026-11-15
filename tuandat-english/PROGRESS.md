# Tiến Độ Dự Án TuanDat English

Cập nhật lần cuối: `2026-11-15` | Lịch sử chi tiết các hạng mục đã hoàn thành: [progress-history.md](./docs/archive/progress-history.md)

## 1. Quyết định kỹ thuật cốt lõi

- **Thương hiệu & tài nguyên tĩnh**: Sử dụng đồng bộ nhận diện `TuanDat` (`TuanDat English`) với mascot chim cánh cụt (`/assets/images/penguin-mascot.png`, `/assets/images/favicon/logo.png`).
- **Cache-busting & Rewrite SSR**:
  - `server.mjs` trả `Cache-Control: no-cache` (`MUTABLE_CACHE`) cho mọi file, khởi chạy qua `node server.mjs --port=4173`.
  - Không sửa tên file JS trong `_buildManifest.js`; dùng regex trong `rewriteBody()` ([lib/rewrite.mjs](./lib/rewrite.mjs)) cùng `main-0f4aa6f53e4508ff.js` và `webpack-54d8d60c88d47f24.js` để gắn đồng bộ `?v=tuandat14` cho asset `/_next/static/*`.
- **Chính sách miễn phí 100%**:
  - Chặn/redirect `302` về `/` (kèm `__N_REDIRECT` cho `_next/data`) các route `/pricing`, `/checkout`, `/activation`, `/affiliate`; API thanh toán/gói/khuyến mãi trả `{"data":[]}`.
  - Ép `isPremium = true` ở `AuthProvider`, chuẩn hóa `"is_pro":false`, `"is_free":true` trong API/SSR; vô hiệu hóa `ProBadge`, `QuotaWidget`, `AppBanner`, `ShareBar`, `BaolingoCard` và các modal thanh toán/quảng cáo qua chunk + `stripExternalHtmlBlocks()`.
  - Hợp nhất hạn mức từ vựng tối đa (`10` bộ, `250` nhóm, `8e3` thẻ, `5e3` mục).
- **Database Supabase PostgreSQL**:
  - Project ref `kzbostitltwpeddpfhqo`, schema gồm 8 bảng (`profiles`, `public_profiles`, `usernames`, `vocabulary_reviews`, `vocabulary_decks`, `sentence_notes`, `purchased_items`, `notifications`) + trigger `private.sync_public_profile()`, bật RLS đầy đủ theo user JWT.
  - Nạp cấu hình từ `.env` (mẫu `.env.example`, không commit theo `.gitignore`).
- **Xác thực Email thật & Quy ước Frontend**:
  - Dùng Supabase Auth Email OTP / Magic Link (`/api/auth/email/send-otp`, `verify-otp`, `verify-link`, `session`, `me`, `logout`) qua cookie phiên (`access_token`, `refresh_token`) + Bearer token; vô hiệu hóa đăng nhập mạng xã hội (`POST /api/auth/google` trả `400`).
  - Giữ các bản vá UI quan trọng: tránh lỗi TDZ `isPremium:w=!0` trong `CreateCommunityLessonCard` (`5247`), tránh shadow biến `v` gây `React error #130` ở `LoginModal`/`EncourageLoginModal` (`7468`), và giữ key số ít (`avatar_frame`, `background`, `name_color`, `badge`) ở `/api/shop/items/purchased/by-type`.

## 2. Tính năng đã chạy ổn định

- **Server & Rewrite**: Phục vụ tĩnh, dữ liệu API nội bộ, rewrite SSR/API, điều hướng miễn phí và cache-busting `?v=tuandat14`.
- **Giao diện sạch & Miễn phí toàn bộ**: Nhận diện `TuanDat`, mở khóa toàn bộ bài học dictation, shadowing, truyện chêm, từ vựng, mini-game, đề thi IELTS/TOEIC và tạo bài học YouTube; đã gỡ hoàn toàn banner quảng cáo `Baolingo`.
- **Auth & Backend Supabase**: Đăng nhập/đăng ký qua Email OTP & Magic Link, duy trì/làm mới phiên tự động qua Axios interceptor + cookie phiên (`access_token`, `refresh_token`, chống race condition khi làm mới đồng thời); đầy đủ API hồ sơ, upload avatar/background, ví kim cương, streak, cấp độ, tiến độ bài học, từ vựng, ghi chú câu, shop vật phẩm, nhiệm vụ ngày và thông báo.
- **Kiểm thử gần nhất**:
  - Vượt qua `node --check`, 16/16 test API xác thực, kiểm thử UI (`/login`, `/vi/login`, `LoginModal`), và end-to-end Email OTP thật với Gmail.
  - Vô hiệu hóa `QuotaWidget` sau đăng nhập trong `5247-0206db5333cd284f.js` và kiểm thử HTTP + trình duyệt trên `/vi/shadowing`, `/vi/dictation`, `/vi/topics`, `/vi/community-lessons` (0 lỗi console).
  - Chuẩn hóa toàn bộ dự án sang tên riêng `tuandat-english` và loại bỏ toàn bộ mã/tài liệu phụ thuộc ngoài.
  - Gỡ `BaolingoCard` khỏi dashboard JS chunk, SSR HTML và `stripExternalHtmlBlocks()`, nâng cache-busting lên `?v=tuandat14` và xác minh giao diện trên trình duyệt tại `/vi/dashboard` và `/dashboard`.

## 3. Lỗi tồn đọng & Tác vụ đang làm dở

- **Giới hạn hệ thống đã biết**: Bảng xếp hạng trực tiếp và chat riêng nhiều người dùng trả dữ liệu cục bộ/mặc định; một số query bài học theo bộ lọc chưa có dữ liệu mẫu (như `/api/lessons?...&topic_slug=movie-short-clip`) trả `404`; audio/video YouTube phụ thuộc bên thứ ba.

## 4. Kế hoạch các bước tiếp theo

- Tiếp tục bổ sung dữ liệu bài học/từ vựng và nâng cấp bảng xếp hạng/chat thời gian thực qua Supabase khi mở rộng tính năng.

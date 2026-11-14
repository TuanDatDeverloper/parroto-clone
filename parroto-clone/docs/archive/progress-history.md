# Lịch sử Tiến Độ Dự Án TuanDat (Archive)

Tài liệu lưu trữ chi tiết toàn bộ các hạng mục đã hoàn thành và danh sách file đã chỉnh sửa qua từng giai đoạn. Xem trạng thái hiện tại, quyết định kỹ thuật cốt lõi và kế hoạch tiếp theo tại [PROGRESS.md](../../PROGRESS.md).

---

## 1. Đổi thương hiệu & bộ nhận diện (Icon / Logo / Mascot)

### Thay đổi hình ảnh tĩnh
Đã thay thế toàn bộ icon, favicon, logo và mascot chim xanh cũ bằng bộ ảnh chim cánh cụt nền trong suốt mới (`TuanDat`):
- `public/assets/images/penguin-mascot.png` (mascot cho trang dictation)
- `public/favicon.ico`, `public/favicon/96x96.png`
- `public/assets/images/favicon/16x16.png`, `32x32.png`, `96x96.png`, `apple-touch-icon.png`, `favicon.ico`, `favicon.svg`, `logo.png`
- `public/assets/images/logo.png`, `logo-header.png`, `logo-footer.png`
- `public/assets/assets/logo.png`

### Thay đổi trong mã nguồn & JS chunks
- [lib/rewrite.mjs](../../lib/rewrite.mjs):
  - Thay thế SVG logo inline cũ (`M28 84C28 53.0721`) bằng `<svg><image href="/assets/images/favicon/logo.png" .../></svg>`.
  - Đổi tên thương hiệu: `"PARROTO COMPANY LIMITED"` -> `"TuanDat"`, `"PARROTO CO., LTD."` -> `"TuanDat"`, `"Parroto"` -> `"TuanDat"`.
  - Gỡ bỏ các rule chèn `.js?v=...` vào từng tên file JS (vốn làm sai lệch `_buildManifest.js`) và dùng regex trong `rewriteBody` để gắn `?v=tuandat7` cho mọi thuộc tính `src="/_next/static/...js"` và `href="/_next/static/...css"` (sau đó nâng lên `?v=tuandat9` và `?v=tuandat10`).
- [public/_next/static/chunks/main-0f4aa6f53e4508ff.js](../../public/_next/static/chunks/main-0f4aa6f53e4508ff.js): Cập nhật `getDeploymentIdQueryOrEmptyString()` trả về `"?v=tuandat7"` (sau đó nâng lên `"?v=tuandat9"` -> `"?v=tuandat10"`) để Next.js route loader tải các chunk kèm query string mới, bỏ qua `immutable` cache cũ trong trình duyệt.
- [public/_next/static/chunks/webpack-54d8d60c88d47f24.js](../../public/_next/static/chunks/webpack-54d8d60c88d47f24.js): Cập nhật `__webpack_require__.u` nối thêm `"?v=tuandat7"` (sau đó nâng lên `"?v=tuandat9"` -> `"?v=tuandat10"`) cho mọi dynamic chunk (`1594`, `5220`, `6197`, v.v.).
- [public/_next/static/chunks/pages/_app-19a95d9017bc66c2.js](../../public/_next/static/chunks/pages/_app-19a95d9017bc66c2.js): Cập nhật component logo `t.Z` sang ảnh `/assets/images/favicon/logo.png`.
- [public/_next/static/chunks/pages/lessons/dictation/[lessonSlug]-95806c9eee963a67.js](../../public/_next/static/chunks/pages/lessons/dictation/%5BlessonSlug%5D-95806c9eee963a67.js): Thay `RiveAnimation` bằng `<img src="/assets/images/penguin-mascot.png" ...>`.
- [public/_next/static/chunks/pages/community-8dbbfaf0fe11f4d4.js](../../public/_next/static/chunks/pages/community-8dbbfaf0fe11f4d4.js): Thay Lottie chim xanh cũ ở sidebar trái `/community` bằng `<img src="/assets/images/penguin-mascot.png" alt="TuanDat" ...>`.

## 2. Cấu hình Server & Cache

- [server.mjs](../../server.mjs):
  - Cập nhật `cachePolicy()` trả về `MUTABLE_CACHE` (`"no-cache"`) cho toàn bộ file để trình duyệt luôn kiểm tra lại bản mới, loại bỏ `IMMUTABLE_CACHE`.
  - Lệnh khởi chạy lại server khi cần: `node server.mjs --port=4173` (trong thư mục `parroto-clone`).

## 3. Loại bỏ toàn bộ Tải App & Liên kết Mạng xã hội / Group ngoài

Chỉ giữ lại các đường dẫn và tính năng trong phạm vi website:

- **Banner tải app (`AppBanner`) & thanh chia sẻ nổi (`ShareBar`)**:
  - [public/_next/static/chunks/7963-07d6ff3cd7352ba9.js](../../public/_next/static/chunks/7963-07d6ff3cd7352ba9.js): Vô hiệu hóa loader `eO` (`AppBanner`) và `eR` (`ShareBar`) thành `()=>null`; xóa nút `"Facebook Community"` trên header.
  - [public/_next/static/chunks/8874-b7741a5847b900ff.js](../../public/_next/static/chunks/8874-b7741a5847b900ff.js): Vô hiệu hóa loader `el` (`AppBanner`) và `en` (`ShareBar`) thành `()=>null`; xóa mục `footer.downloadApp` và dãy icon mạng xã hội ở footer; đổi `PARROTO CO., LTD.` thành `TuanDat`.
  - [public/_next/static/chunks/1594.980da426ab3ce945.js](../../public/_next/static/chunks/1594.980da426ab3ce945.js): `AppBanner` trả về `null`.
  - [public/_next/static/chunks/5220.875b4e60b4f9d9ea.js](../../public/_next/static/chunks/5220.875b4e60b4f9d9ea.js) & [public/_next/static/chunks/6197.4a604b8d99bc45fe.js](../../public/_next/static/chunks/6197.4a604b8d99bc45fe.js): `ShareBar` trả về `null`.
- **Các trang thành phần**:
  - [public/_next/static/chunks/6684-7cc117f9b15cc499.js](../../public/_next/static/chunks/6684-7cc117f9b15cc499.js): `DownloadAppBanner` trả về `null` và gỡ link App Store trong `UserReviews`.
  - [public/_next/static/chunks/pages/index-1ae47188658f8d74.js](../../public/_next/static/chunks/pages/index-1ae47188658f8d74.js): Gỡ link Facebook ở thẻ ban cố vấn, tắt khối video hướng dẫn YouTube ở trang chủ (`HowTo`) và ẩn toàn bộ section đội ngũ cố vấn chuyên môn (`Advisors`) trên trang chủ.
  - [public/_next/static/chunks/pages/about-us-97fd11d00da891d3.js](../../public/_next/static/chunks/pages/about-us-97fd11d00da891d3.js): Xóa toàn bộ section `followUs` mạng xã hội.
  - [public/_next/static/chunks/pages/community-8dbbfaf0fe11f4d4.js](../../public/_next/static/chunks/pages/community-8dbbfaf0fe11f4d4.js): Xóa nút mở group Facebook ngoài và thay Lottie chim xanh cũ bằng mascot chim cánh cụt `/assets/images/penguin-mascot.png`.
  - [public/_next/static/chunks/pages/authors-fc53bbd59c81b69e.js](../../public/_next/static/chunks/pages/authors-fc53bbd59c81b69e.js): Xóa liên kết LinkedIn ngoài.
  - [public/_next/static/chunks/pages/about-us/advisors-7894dd1b5facc734.js](../../public/_next/static/chunks/pages/about-us/advisors-7894dd1b5facc734.js): Ẩn liên kết Facebook của cố vấn.
  - [public/_next/static/chunks/pages/checkout-7657d03948bba240.js](../../public/_next/static/chunks/pages/checkout-7657d03948bba240.js) & [public/_next/static/chunks/pages/_app-19a95d9017bc66c2.js](../../public/_next/static/chunks/pages/_app-19a95d9017bc66c2.js): Xóa nút mở Facebook `parroto.english`.
  - [public/_next/static/chunks/pages/link-2162c03737e2d9f9.js](../../public/_next/static/chunks/pages/link-2162c03737e2d9f9.js): Xóa tự động chuyển hướng sang App Store / Google Play và mã QR tải app.
- **Đồng bộ SSR HTML trong [lib/rewrite.mjs](../../lib/rewrite.mjs)**:
  - Thêm vào `stripExternalHtmlBlocks(text)` các rule lọc nút `<button>...Facebook Community</button>` trên sidebar `/community`, link Facebook trên `/about-us/advisors`, link LinkedIn trên `/authors` và khối QR/tải app trên `/link` (cùng các block tải app, social footer, `footer-social`, link group Facebook, `followUs`, `YouTubeEmbed`, section `/about-us/advisors` trên trang chủ).
  - Nâng cache-busting `/_next/static/*` và favicon/logo lên `?v=tuandat7` (ở giai đoạn này).

## 4. Loại bỏ hoàn toàn gói Pro, Thanh toán, Affiliate, Khóa nội dung & Giới hạn (Phục vụ miễn phí 100%)

- **Server & API ([server.mjs](../../server.mjs), [lib/rewrite.mjs](../../lib/rewrite.mjs), `public/api/*`)**:
  - Chặn và redirect (`302` về `/`, và trả `__N_REDIRECT` cho `_next/data`) đối với các đường dẫn `/pricing`, `/checkout`, `/activation`, `/affiliate` (bao gồm prefix ngôn ngữ như `/vi/...`).
  - Xóa các file HTML tĩnh tương ứng trong `public/` (`pricing.html`, `checkout.html`, `activation.html`, `affiliate.html` và bản `/vi/`).
  - Các API thanh toán/gói/giới thiệu (`/api/prices`, `/api/promo/active`, `/api/affiliate`, `/api/orders`, `/api/payment`, `/api/activation`) trả `{"data":[]}`; làm rỗng `public/api/prices.json` và `public/api/promo/active.json`; đưa mọi response API fixture qua `rewriteBody()`.
  - Chuẩn hóa `"is_pro":true` -> `"is_pro":false`, `"is_free":false` -> `"is_free":true` trong `lib/rewrite.mjs` và `public/api/lessons.*.json`; lọc khỏi SSR HTML các liên kết `/pricing`, `/affiliate`, huy hiệu `bg-gradient-pro`, `ProBadge` (`border-yellow-300`), và style thẻ vàng Pro.
- **Trạng thái Auth & Modal toàn cục ([public/_next/static/chunks/pages/_app-19a95d9017bc66c2.js](../../public/_next/static/chunks/pages/_app-19a95d9017bc66c2.js))**:
  - Ép `isPremium` trong `AuthProvider` luôn là `true`, vô hiệu hóa `openCheckoutModal`, `openPremiumRequiredModal`, `openThankYouModal`.
  - Vô hiệu hóa `CheckoutModal`, `PremiumRequiredModal`, `ThankYouModal`, `EventPromoModal` và `GoogleAdsLoader` (trả `null` và gỡ khỏi `AppContent`).
- **Điều hướng, Header, Sidebar, Hồ sơ & Trang thanh toán**:
  - [public/_next/static/chunks/7963-07d6ff3cd7352ba9.js](../../public/_next/static/chunks/7963-07d6ff3cd7352ba9.js) & [public/_next/static/chunks/8874-b7741a5847b900ff.js](../../public/_next/static/chunks/8874-b7741a5847b900ff.js): Xóa `/pricing`, `/affiliate` khỏi menu sidebar và header; xóa các nút `PRO` / `header.unlockPro`; gỡ gọi modal nâng cấp khi `LIMIT_EXCEEDED`.
  - [public/_next/static/chunks/pages/profile-2b88f9b3b3fc29df.js](../../public/_next/static/chunks/pages/profile-2b88f9b3b3fc29df.js): Xóa nút `/affiliate` và thẻ `premiumStatus` / `premium.unlock`.
  - [public/_next/static/chunks/pages/terms-of-service-2f479d8a1be18a38.js](../../public/_next/static/chunks/pages/terms-of-service-2f479d8a1be18a38.js): Xóa mục `cancellation.subscription`.
  - Thay [pricing-c0064e92c949651f.js](../../public/_next/static/chunks/pages/pricing-c0064e92c949651f.js), [checkout-7657d03948bba240.js](../../public/_next/static/chunks/pages/checkout-7657d03948bba240.js), [activation-b3a80283c36c848d.js](../../public/_next/static/chunks/pages/activation-b3a80283c36c848d.js), [affiliate-830c5c02a2067da1.js](../../public/_next/static/chunks/pages/affiliate-830c5c02a2067da1.js) bằng trang chuyển hướng về `/`.
- **Huy hiệu Pro, Avatar, Nội dung khóa & Giới hạn Free/Pro**:
  - Vô hiệu hóa `ProBadge` (`return null`) ở các chunk `2323`, `6069`, `7714`, `8450`, `9193`, `9751`, `5247`, `pages/vocabulary`; tắt vương miện Pro trên `UserAvatar` ở [3288.50b343afd6b55f89.js](../../public/_next/static/chunks/3288.50b343afd6b55f89.js) và [9951-0438c4df723a4fcf.js](../../public/_next/static/chunks/9951-0438c4df723a4fcf.js).
  - Gỡ kiểm tra `is_pro` / `isPro` / `is_free`, viền vàng Pro và nút `duo-pro` trong `1934`, `2323` (bài thi IELTS/TOEIC), `5247` (tạo bài học YouTube), `5554`, `6069`, `7714`, `9193` (mini-game từ vựng), `9751`, `pages/lessons/dictation/[lessonSlug]`, `pages/stories/[slug]`, `pages/vocabulary`, `pages/shorts`.
  - Hợp nhất hạn mức trong `getVocabularyLimits` và `Ub` (`10` bộ, `250` nhóm, `8e3` thẻ, `5e3` mục); xóa tooltip Free/Pro trong [6974-0a132f4da287f64b.js](../../public/_next/static/chunks/6974-0a132f4da287f64b.js) và banner `saveLimit` / `reviewLimit` kèm nút nâng cấp trong [my-notes-a618637cebd679e2.js](../../public/_next/static/chunks/pages/my-notes-a618637cebd679e2.js) và [my-vocabulary-8b194174d7f50f96.js](../../public/_next/static/chunks/pages/my-vocabulary-8b194174d7f50f96.js).

## 5. Kiểm thử & Merge Giai đoạn Gỡ Pro (`1c36584`)

- **Kiểm tra cú pháp JS & quét toàn site**: Tất cả file JS/MJS đã sửa vượt qua `node --check`; quét toàn bộ HTML và JSON trong `public/` qua `rewriteBody()` cho `0` kết quả `href="/pricing"`, `href="/affiliate"`, `bg-gradient-pro`, `"is_pro":true`, `"is_free":false`, `border-yellow-300`, `lucide-crown`.
- **Kiểm tra HTTP & trình duyệt thực tế** (trên `http://127.0.0.1:4173`):
  - `/pricing`, `/checkout`, `/activation`, `/affiliate` (và bản `/vi/...`) trả `302 Location: /`; `/api/prices` và `/api/promo/active` trả `{"data":[]}`; `/dictation`, `/vocabulary`, `/stories`, `/exams` tải với `?v=tuandat7` không còn UI/dữ liệu Pro hay thanh toán.
  - Người dùng đã kiểm tra trực tiếp trên server cục bộ và xác nhận đạt yêu cầu; các thay đổi đã được merge vào `main` (`1c36584`).

## 6. Hoàn thiện Backend & Frontend Đăng nhập cục bộ (Local Auth & JSON Store — đã nâng cấp sang Supabase ở mục 7)

- **Backend cục bộ ban đầu ([lib/auth-backend.mjs](../../lib/auth-backend.mjs), `data/users.json` [đã xóa ở mục 7], [server.mjs](../../server.mjs))**:
  - Xây dựng `handleAuthAndUserApi()` quản lý tài khoản và phiên đăng nhập lưu trong `data/users.json` (từng khởi tạo sẵn tài khoản mẫu `tuandat@gmail.com` / `"Nguyễn Sỹ Tuấn Đạt"`, `username: "tuandat"`, `diamonds: 99999`, `current_streak: 7`, `level: 5`).
  - Từng hỗ trợ `POST /api/auth/email` (tự động đăng ký/đăng nhập không OTP), `POST /api/auth/google` (đăng nhập nhanh Google nội bộ), `POST /api/auth/logout`, và `GET /api/auth/session` / `GET /api/auth/me` qua header `Authorization: Bearer <token>` và cookie `access_token`.
  - Hỗ trợ đầy đủ API người dùng & tương tác sau đăng nhập: `GET/PUT /api/user/info` (bao gồm `multipart/form-data` upload `avatar` / `backgroundURL` và `removeBackground`), `/api/user/username/check`, `PUT /api/user/username`, `PUT /api/user/birthday`, `PUT /api/user/selected-item`, `/api/user/stats`, `/api/user/ranking-history`, `/api/user/lesson-progress`, `/api/user/completed-sentences/:id`, `/api/user/vocabulary-review`, `/api/user/vocabulary/*`, `/api/wallet`, `/api/streak*` (checkin, mua freeze, lịch, mốc thưởng), `/api/level*`, `/api/lessons/progress`, `/api/missions/today`, `/api/notifications*`, `/api/learning-time/*`, `/api/sentences/review*`, `/api/learning-vocabulary/*`, `/api/sentence-notes*`, `/api/private-chat/*`, `/api/shop/items/purchased*`.
- **Sửa lỗi Fixture `401` ([public/api/_fixtures.json](../../public/api/_fixtures.json))**:
  - Cập nhật `GET /api/wallet`, `GET /api/streak`, và `GET /api/learning-vocabulary/enc/new?...` từ `status: 401` sang `status: 200` kèm payload JSON hợp lệ ở `wallet.json`, `streak.json`, `learning-vocabulary/enc/new.b4f9c0e3c2.json`.
- **Đồng bộ Frontend ([public/_next/static/chunks/pages/_app-19a95d9017bc66c2.js](../../public/_next/static/chunks/pages/_app-19a95d9017bc66c2.js), [public/_next/static/chunks/7468-a6196c16ab1dc469.js](../../public/_next/static/chunks/7468-a6196c16ab1dc469.js))**:
  - Gỡ phụ thuộc Firebase Auth runtime (`onAuthStateChanged` / magic link) khỏi `AuthProvider` (`41503`), nối trực tiếp `loginWithEmail`, `loginWithGoogle`, `logout` và đồng bộ `/api/auth/session` khi tải lại trang, giữ nguyên phương thức `getIdToken()` cho trang `/profile`.
  - Cập nhật Axios interceptor (`99357`) để đọc token từ cookie `access_token` trước khi phát `auth:expired`; cập nhật `LoginModal`, `EncourageLoginModal` (tự đóng modal) và `LoginPage` (chuyển hướng ngay về `/` hoặc `?redirect=...`).
  - Nâng cache-busting lên `?v=tuandat9` trong `lib/rewrite.mjs`, `main-0f4aa6f53e4508ff.js`, và `webpack-54d8d60c88d47f24.js`.

## 7. Chuyển đổi Database sang PostgreSQL (Supabase), Xác thực Email thật & Sửa lỗi sau đăng nhập

- **Supabase PostgreSQL Schema & RLS (Project `tuandat-parroto`, ref `kzbostitltwpeddpfhqo`)**:
  - Áp dụng migration `init_parroto_postgres_schema`: khởi tạo 8 bảng (`public.profiles`, `public.public_profiles`, `public.usernames`, `public.vocabulary_reviews`, `public.vocabulary_decks`, `public.sentence_notes`, `public.purchased_items`, `public.notifications`), khóa ngoại kèm index, trigger đồng bộ `private.sync_public_profile()`, và bật RLS đầy đủ (0 cảnh báo bảo mật từ `get_advisors`).
  - Xóa bỏ kho lưu trữ cục bộ `data/users.json` và file tạm `.users-*.tmp`.
- **Backend Auth & PostgreSQL ([lib/supabase.mjs](../../lib/supabase.mjs), [lib/auth-backend.mjs](../../lib/auth-backend.mjs), [server.mjs](../../server.mjs))**:
  - Nạp biến môi trường từ `parroto-clone/.env` (`.env.example` làm mẫu, không commit `.env` theo `.gitignore`) và dùng `@supabase/supabase-js`.
  - Chuyển xác thực sang email thật qua Supabase Auth: `POST /api/auth/email/send-otp` (`signInWithOtp`), `POST /api/auth/email/verify-otp` (`verifyOtp`), `POST /api/auth/email/verify-link` (hỗ trợ `access_token` / `token_hash` / PKCE `code`), `GET /api/auth/session` / `GET /api/auth/me` (`getUser` + `refreshSession` qua HttpOnly cookie `refresh_token`), và `POST /api/auth/logout`; vô hiệu hóa đăng nhập Google giả (`POST /api/auth/google` trả `400`).
  - Đọc/ghi dữ liệu người dùng (hồ sơ, kim cương, streak, tiến độ, từ vựng, ghi chú câu, vật phẩm shop, thông báo) qua PostgreSQL với user JWT RLS; bổ sung `/api/shop/items/purchase`, `/api/shop/items/purchased/by-type` (đúng key số ít `avatar_frame`, `background`, `name_color`, `badge`), `/api/shop/items/purchased/:itemId/toggle`, `/api/community-lessons/quota`, và `/api/community-stats/my-stats`.
- **Frontend & Sửa lỗi điều hướng sau đăng nhập**:
  - [public/_next/static/chunks/5247-0206db5333cd284f.js](../../public/_next/static/chunks/5247-0206db5333cd284f.js): Sửa lỗi TDZ `ReferenceError: Cannot access 'w' before initialization` trong `CreateCommunityLessonCard` (`isPremium:w=!0`) khiến `/dictation` và `/shadowing` sập khi `isAuthenticated` là `true`.
  - [public/_next/static/chunks/pages/_app-19a95d9017bc66c2.js](../../public/_next/static/chunks/pages/_app-19a95d9017bc66c2.js) & [public/_next/static/chunks/7468-a6196c16ab1dc469.js](../../public/_next/static/chunks/7468-a6196c16ab1dc469.js): Hỗ trợ bước nhập mã OTP 6 số + tự động xác thực callback Magic Link; ẩn nút Google/Apple và sửa lỗi shadow biến `v` gây `React error #130` khi mở `LoginModal`/`EncourageLoginModal`.
  - [lib/rewrite.mjs](../../lib/rewrite.mjs), [main-0f4aa6f53e4508ff.js](../../public/_next/static/chunks/main-0f4aa6f53e4508ff.js), [webpack-54d8d60c88d47f24.js](../../public/_next/static/chunks/webpack-54d8d60c88d47f24.js): Lọc nút Google/divider khỏi SSR HTML `/login` và nâng cache-busting lên `?v=tuandat10`.
- **Kiểm thử & Trạng thái sau phiên**:
  - Đã kiểm tra cú pháp (`node --check`) đạt 100% trên mọi file `.mjs`/`.js`, kiểm tra các API HTTP và quét trình duyệt qua `http://127.0.0.1:4173` (`/login`, `LoginModal` trên `/` và `/dictation`, cùng 11 trang `/dictation`, `/shadowing`, `/shop`, `/community`, `/vocabulary`, `/exams`, `/missions`, `/leaderboard`, `/profile`, `/stories`, `/review`).
  - Server cục bộ đã được tắt sạch sẽ sau khi kiểm tra.

## 8. Kiểm thử End-to-End Đăng nhập Email & Vá lỗi Edge-Case (`2026-11-14`)

- **Sửa lỗi trong [lib/auth-backend.mjs](../../lib/auth-backend.mjs)**:
  - Truyền tường minh `tokenHash` từ `/api/auth/email/verify-link` vào `verifySupabaseEmailAuth()` và hỗ trợ định dạng `pkce_...` trong `parseVerificationInput()`, tránh việc `token_hash` không phải hex bị hiểu nhầm thành OTP và trả `400 Email and verification code are required`.
  - Bổ sung `refreshSessionCoalesced()` (`REFRESH_IN_FLIGHT` + `RECENT_REFRESH_CACHE` 5s) trong `resolveSession()` để gộp các request song song khi `access_token` hết hạn, tránh lỗi xoay vòng `token_revoked` trên Supabase Auth.
- **Kết quả kiểm thử trên `http://127.0.0.1:4173`**:
  - `node --check` đạt trên `server.mjs` và toàn bộ `lib/*.mjs`.
  - 16/16 test HTTP API đạt (`/login`, `/vi/login`, `/api/auth/email/send-otp`, `verify-otp`, `verify-link`, `/api/auth/google`, `/api/auth/session`, `/api/auth/me`, `/api/auth/logout`).
  - Kiểm thử trình duyệt end-to-end với Gmail (`datcline3@gmail.com`): kiểm tra UI `/login`, `/vi/login`, `LoginModal` (không còn nút Google/Apple, không có lỗi React #130), `/login?error_description=Email+link+expired`, gửi OTP thực tế qua SMTP, lấy mã OTP từ email trong Gmail, xác thực thành công, giữ phiên khi reload, truy cập `/dictation` và `/profile`, và đăng xuất sạch sẽ.
  - Server cục bộ đã được tắt sạch sẽ và kiểm tra `.env` không bị commit (`.gitignore`).

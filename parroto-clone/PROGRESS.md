# Tiến Độ Dự Án TuanDat (Clone từ Parroto)

Cập nhật lần cuối: `2026-11-14`

## 1. Đổi thương hiệu & bộ nhận diện (Icon / Logo / Mascot)

### Thay đổi hình ảnh tĩnh
Đã thay thế toàn bộ icon, favicon, logo và mascot chim xanh cũ bằng bộ ảnh chim cánh cụt nền trong suốt mới (`TuanDat`):
- `public/assets/images/penguin-mascot.png` (mascot cho trang dictation)
- `public/favicon.ico`, `public/favicon/96x96.png`
- `public/assets/images/favicon/16x16.png`, `32x32.png`, `96x96.png`, `apple-touch-icon.png`, `favicon.ico`, `favicon.svg`, `logo.png`
- `public/assets/images/logo.png`, `logo-header.png`, `logo-footer.png`
- `public/assets/assets/logo.png`

### Thay đổi trong mã nguồn & JS chunks
- [lib/rewrite.mjs](file:///D:/Rea/parroto-clone/lib/rewrite.mjs):
  - Thay thế SVG logo inline cũ (`M28 84C28 53.0721`) bằng `<svg><image href="/assets/images/favicon/logo.png" .../></svg>`.
  - Đổi tên thương hiệu: `"PARROTO COMPANY LIMITED"` -> `"TuanDat"`, `"PARROTO CO., LTD."` -> `"TuanDat"`, `"Parroto"` -> `"TuanDat"`.
  - Gỡ bỏ các rule chèn `.js?v=...` vào từng tên file JS (vốn làm sai lệch `_buildManifest.js`) và dùng regex trong `rewriteBody` để gắn `?v=tuandat7` cho mọi thuộc tính `src="/_next/static/...js"` và `href="/_next/static/...css"`.
- [public/_next/static/chunks/main-0f4aa6f53e4508ff.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/main-0f4aa6f53e4508ff.js): Cập nhật `getDeploymentIdQueryOrEmptyString()` trả về `"?v=tuandat7"` để Next.js route loader tải các chunk kèm query string mới, bỏ qua `immutable` cache cũ trong trình duyệt.
- [public/_next/static/chunks/webpack-54d8d60c88d47f24.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/webpack-54d8d60c88d47f24.js): Cập nhật `__webpack_require__.u` nối thêm `"?v=tuandat7"` cho mọi dynamic chunk (`1594`, `5220`, `6197`, v.v.).
- [public/_next/static/chunks/pages/_app-19a95d9017bc66c2.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/_app-19a95d9017bc66c2.js): Cập nhật component logo `t.Z` sang ảnh `/assets/images/favicon/logo.png`.
- [public/_next/static/chunks/pages/lessons/dictation/[lessonSlug]-95806c9eee963a67.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/lessons/dictation/%5BlessonSlug%5D-95806c9eee963a67.js): Thay `RiveAnimation` bằng `<img src="/assets/images/penguin-mascot.png" ...>`.
- [public/_next/static/chunks/pages/community-8dbbfaf0fe11f4d4.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/community-8dbbfaf0fe11f4d4.js): Thay Lottie chim xanh cũ ở sidebar trái `/community` bằng `<img src="/assets/images/penguin-mascot.png" alt="TuanDat" ...>`.

## 2. Cấu hình Server & Cache

- [server.mjs](file:///D:/Rea/parroto-clone/server.mjs):
  - Cập nhật `cachePolicy()` trả về `MUTABLE_CACHE` (`"no-cache"`) cho toàn bộ file để trình duyệt luôn kiểm tra lại bản mới, loại bỏ `IMMUTABLE_CACHE`.
  - Lệnh khởi chạy lại server khi cần: `cd D:\Rea\parroto-clone; node server.mjs --port=4173`

## 3. Loại bỏ toàn bộ Tải App & Liên kết Mạng xã hội / Group ngoài

Chỉ giữ lại các đường dẫn và tính năng trong phạm vi website:

- **Banner tải app (`AppBanner`) & thanh chia sẻ nổi (`ShareBar`)**:
  - [public/_next/static/chunks/7963-07d6ff3cd7352ba9.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/7963-07d6ff3cd7352ba9.js): Vô hiệu hóa loader `eO` (`AppBanner`) và `eR` (`ShareBar`) thành `()=>null`; xóa nút `"Facebook Community"` trên header.
  - [public/_next/static/chunks/8874-b7741a5847b900ff.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/8874-b7741a5847b900ff.js): Vô hiệu hóa loader `el` (`AppBanner`) và `en` (`ShareBar`) thành `()=>null`; xóa mục `footer.downloadApp` và dãy icon mạng xã hội ở footer; đổi `PARROTO CO., LTD.` thành `TuanDat`.
  - [public/_next/static/chunks/1594.980da426ab3ce945.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/1594.980da426ab3ce945.js): `AppBanner` trả về `null`.
  - [public/_next/static/chunks/5220.875b4e60b4f9d9ea.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/5220.875b4e60b4f9d9ea.js) & [public/_next/static/chunks/6197.4a604b8d99bc45fe.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/6197.4a604b8d99bc45fe.js): `ShareBar` trả về `null`.
- **Các trang thành phần**:
  - [public/_next/static/chunks/6684-7cc117f9b15cc499.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/6684-7cc117f9b15cc499.js): `DownloadAppBanner` trả về `null` và gỡ link App Store trong `UserReviews`.
  - [public/_next/static/chunks/pages/index-1ae47188658f8d74.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/index-1ae47188658f8d74.js): Gỡ link Facebook ở thẻ ban cố vấn, tắt khối video hướng dẫn YouTube ở trang chủ (`HowTo`) và ẩn toàn bộ section đội ngũ cố vấn chuyên môn (`Advisors`) trên trang chủ.
  - [public/_next/static/chunks/pages/about-us-97fd11d00da891d3.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/about-us-97fd11d00da891d3.js): Xóa toàn bộ section `followUs` mạng xã hội.
  - [public/_next/static/chunks/pages/community-8dbbfaf0fe11f4d4.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/community-8dbbfaf0fe11f4d4.js): Xóa nút mở group Facebook ngoài và thay Lottie chim xanh cũ bằng mascot chim cánh cụt `/assets/images/penguin-mascot.png`.
  - [public/_next/static/chunks/pages/authors-fc53bbd59c81b69e.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/authors-fc53bbd59c81b69e.js): Xóa liên kết LinkedIn ngoài.
  - [public/_next/static/chunks/pages/about-us/advisors-7894dd1b5facc734.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/about-us/advisors-7894dd1b5facc734.js): Ẩn liên kết Facebook của cố vấn.
  - [public/_next/static/chunks/pages/checkout-7657d03948bba240.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/checkout-7657d03948bba240.js) & [public/_next/static/chunks/pages/_app-19a95d9017bc66c2.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/_app-19a95d9017bc66c2.js): Xóa nút mở Facebook `parroto.english`.
  - [public/_next/static/chunks/pages/link-2162c03737e2d9f9.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/link-2162c03737e2d9f9.js): Xóa tự động chuyển hướng sang App Store / Google Play và mã QR tải app.
- **Đồng bộ SSR HTML trong [lib/rewrite.mjs](file:///D:/Rea/parroto-clone/lib/rewrite.mjs)**:
  - Thêm vào `stripExternalHtmlBlocks(text)` các rule lọc nút `<button>...Facebook Community</button>` trên sidebar `/community`, link Facebook trên `/about-us/advisors`, link LinkedIn trên `/authors` và khối QR/tải app trên `/link` (cùng các block tải app, social footer, `footer-social`, link group Facebook, `followUs`, `YouTubeEmbed`, section `/about-us/advisors` trên trang chủ).
  - Nâng toàn bộ cache-busting `/_next/static/*` và favicon/logo lên `?v=tuandat7`.

## 4. Loại bỏ hoàn toàn gói Pro, Thanh toán, Affiliate, Khóa nội dung & Giới hạn (Phục vụ miễn phí 100%)

- **Server & API ([server.mjs](file:///D:/Rea/parroto-clone/server.mjs), [lib/rewrite.mjs](file:///D:/Rea/parroto-clone/lib/rewrite.mjs), `public/api/*`)**:
  - Chặn và redirect (`302` về `/`, và trả `__N_REDIRECT` cho `_next/data`) đối với các đường dẫn `/pricing`, `/checkout`, `/activation`, `/affiliate` (bao gồm prefix ngôn ngữ như `/vi/...`).
  - Xóa các file HTML tĩnh tương ứng trong `public/` (`pricing.html`, `checkout.html`, `activation.html`, `affiliate.html` và bản `/vi/`).
  - Các API thanh toán/gói/giới thiệu (`/api/prices`, `/api/promo/active`, `/api/affiliate`, `/api/orders`, `/api/payment`, `/api/activation`) trả `{"data":[]}`; làm rỗng `public/api/prices.json` và `public/api/promo/active.json`; đưa mọi response API fixture qua `rewriteBody()`.
  - Chuẩn hóa `"is_pro":true` -> `"is_pro":false`, `"is_free":false` -> `"is_free":true` trong `lib/rewrite.mjs` và `public/api/lessons.*.json`; lọc khỏi SSR HTML các liên kết `/pricing`, `/affiliate`, huy hiệu `bg-gradient-pro`, `ProBadge` (`border-yellow-300`), và style thẻ vàng Pro.
- **Trạng thái Auth & Modal toàn cục ([public/_next/static/chunks/pages/_app-19a95d9017bc66c2.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/_app-19a95d9017bc66c2.js))**:
  - Ép `isPremium` trong `AuthProvider` luôn là `true`, vô hiệu hóa `openCheckoutModal`, `openPremiumRequiredModal`, `openThankYouModal`.
  - Vô hiệu hóa `CheckoutModal`, `PremiumRequiredModal`, `ThankYouModal`, `EventPromoModal` và `GoogleAdsLoader` (trả `null` và gỡ khỏi `AppContent`).
- **Điều hướng, Header, Sidebar, Hồ sơ & Trang thanh toán**:
  - [public/_next/static/chunks/7963-07d6ff3cd7352ba9.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/7963-07d6ff3cd7352ba9.js) & [public/_next/static/chunks/8874-b7741a5847b900ff.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/8874-b7741a5847b900ff.js): Xóa `/pricing`, `/affiliate` khỏi menu sidebar và header; xóa các nút `PRO` / `header.unlockPro`; gỡ gọi modal nâng cấp khi `LIMIT_EXCEEDED`.
  - [public/_next/static/chunks/pages/profile-2b88f9b3b3fc29df.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/profile-2b88f9b3b3fc29df.js): Xóa nút `/affiliate` và thẻ `premiumStatus` / `premium.unlock`.
  - [public/_next/static/chunks/pages/terms-of-service-2f479d8a1be18a38.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/terms-of-service-2f479d8a1be18a38.js): Xóa mục `cancellation.subscription`.
  - Thay [pricing-c0064e92c949651f.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/pricing-c0064e92c949651f.js), [checkout-7657d03948bba240.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/checkout-7657d03948bba240.js), [activation-b3a80283c36c848d.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/activation-b3a80283c36c848d.js), [affiliate-830c5c02a2067da1.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/affiliate-830c5c02a2067da1.js) bằng trang chuyển hướng về `/`.
- **Huy hiệu Pro, Avatar, Nội dung khóa & Giới hạn Free/Pro**:
  - Vô hiệu hóa `ProBadge` (`return null`) ở các chunk `2323`, `6069`, `7714`, `8450`, `9193`, `9751`, `5247`, `pages/vocabulary`; tắt vương miện Pro trên `UserAvatar` ở [3288.50b343afd6b55f89.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/3288.50b343afd6b55f89.js) và [9951-0438c4df723a4fcf.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/9951-0438c4df723a4fcf.js).
  - Gỡ kiểm tra `is_pro` / `isPro` / `is_free`, viền vàng Pro và nút `duo-pro` trong `1934`, `2323` (bài thi IELTS/TOEIC), `5247` (tạo bài học YouTube), `5554`, `6069`, `7714`, `9193` (mini-game từ vựng), `9751`, `pages/lessons/dictation/[lessonSlug]`, `pages/stories/[slug]`, `pages/vocabulary`, `pages/shorts`.
  - Hợp nhất hạn mức trong `getVocabularyLimits` và `Ub` (`10` bộ, `250` nhóm, `8e3` thẻ, `5e3` mục); xóa tooltip Free/Pro trong [6974-0a132f4da287f64b.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/6974-0a132f4da287f64b.js) và banner `saveLimit` / `reviewLimit` kèm nút nâng cấp trong [my-notes-a618637cebd679e2.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/my-notes-a618637cebd679e2.js) và [my-vocabulary-8b194174d7f50f96.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/pages/my-vocabulary-8b194174d7f50f96.js).

## 5. Trạng thái kiểm thử & lưu ý cho phiên sau

- **Kiểm tra cú pháp JS & quét toàn site**: Tất cả file JS/MJS đã sửa đều vượt qua `node --check`; quét toàn bộ HTML và JSON trong `public/` qua `rewriteBody()` cho `0` kết quả `href="/pricing"`, `href="/affiliate"`, `bg-gradient-pro`, `"is_pro":true`, `"is_free":false`, `border-yellow-300`, `lucide-crown`.
- **Kiểm tra HTTP & trình duyệt thực tế** (trên `http://127.0.0.1:4173`):
  - `/pricing`, `/checkout`, `/activation`, `/affiliate` (và bản `/vi/...`) trả `302 Location: /`; `/api/prices` và `/api/promo/active` trả `{"data":[]}`; `/dictation`, `/vocabulary`, `/stories`, `/exams` tải với `?v=tuandat7` không còn UI/dữ liệu Pro hay thanh toán.
  - Người dùng đã kiểm tra trực tiếp trên server cục bộ và xác nhận đạt yêu cầu; các thay đổi đã được merge vào `main` (`1c36584`).
- **Trạng thái hiện tại**: Server đã tắt sau khi kiểm tra, cổng `4173` đã được giải phóng.
- **Gợi ý việc có thể làm tiếp ở phiên sau (nếu cần)**:
  - Kiểm tra thêm các trang phụ ít truy cập như `/practice-english-speaking`, `/topics` (liên quan dọn link tải app ở bước trước).

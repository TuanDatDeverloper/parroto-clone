# Tiến Độ Dự Án TuanDat (Clone từ Parroto)

Cập nhật lần cuối: `2026-11-13`

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
  - Gỡ bỏ các rule chèn `.js?v=...` vào từng tên file JS (vốn làm sai lệch `_buildManifest.js`) và dùng regex trong `rewriteBody` để gắn `?v=tuandat6` cho mọi thuộc tính `src="/_next/static/...js"` và `href="/_next/static/...css"`.
- [public/_next/static/chunks/main-0f4aa6f53e4508ff.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/main-0f4aa6f53e4508ff.js): Cập nhật `getDeploymentIdQueryOrEmptyString()` trả về `"?v=tuandat6"` để Next.js route loader tải các chunk kèm query string mới, bỏ qua `immutable` cache cũ trong trình duyệt.
- [public/_next/static/chunks/webpack-54d8d60c88d47f24.js](file:///D:/Rea/parroto-clone/public/_next/static/chunks/webpack-54d8d60c88d47f24.js): Cập nhật `__webpack_require__.u` nối thêm `"?v=tuandat6"` cho mọi dynamic chunk (`1594`, `5220`, `6197`, v.v.).
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
  - Nâng toàn bộ cache-busting `/_next/static/*` và favicon/logo lên `?v=tuandat6`.

## 4. Trạng thái kiểm thử & lưu ý cho phiên sau

- **Kiểm tra cú pháp JS & quét toàn site**: Tất cả file JS chỉnh sửa đều vượt qua `node --check`; quét 6.317 file HTML sau `rewriteBody` ghi nhận `0` thẻ `<a href=...>` tới Facebook/LinkedIn/TikTok/Threads/App Store/Google Play, `0` nút `Facebook Community`, `0` `apple-download.svg`/`android-download.svg`/`qrcode-parroto`/`YouTubeEmbed`/`Parroto`.
- **Kiểm tra trình duyệt thực tế** (trên `http://127.0.0.1:4173/vi/community` desktop & mobile, `/vi`, `/vi/link`):
  - Thương hiệu `TuanDat` và mascot chim cánh cụt `/assets/images/penguin-mascot.png` hiển thị đúng; không còn chữ `Parroto` hay chim xanh cũ.
  - Không còn banner tải app trên đầu trang, không còn nút `Facebook Community`, không còn video trang chủ hay khối đội ngũ cố vấn chuyên môn, không còn link tải app hay mạng xã hội ở footer/link.
  - Toàn bộ script Next.js tải với `?v=tuandat6` (HTTP 200 OK).
- **Trạng thái hiện tại**: Server đang chạy tại `http://127.0.0.1:4173`.
- **Gợi ý việc có thể làm tiếp ở phiên sau (nếu cần)**:
  - Kiểm tra thêm các trang phụ ít truy cập như `/practice-english-speaking`, `/topics`, `/vocabulary` (vẫn còn chuỗi `apps.apple.com` / `play.google.com` trong chunk JS nếu có modal/nút gợi ý tải app riêng).
  - Kiểm tra các đường dẫn `/vi`, `/pricing`, `/blog/` trên trình duyệt sau khi khởi động lại server.

# Parroto Clone

Bản sao tĩnh 1:1 của [https://parroto.app](https://parroto.app) — dựng lại toàn bộ website (đa ngôn ngữ, blog, khoá học, trò chơi, đề thi) thành một site tự chạy được trên máy, không cần build lại mã nguồn Next.js.

## Kiến trúc

```
parroto-clone/
├── public/              # toàn bộ site đã mirror (HTML, JS, CSS, ảnh, font, dữ liệu)
│   ├── _next/           # bundle Next.js + data payload từng trang/ngôn ngữ
│   ├── blog/            # site Astro độc lập (bài viết, asset _astro)
│   ├── assets/          # ảnh lấy từ assets.parroto.app
│   ├── api/             # fixture JSON của API (kèm mã trạng thái gốc)
│   └── **/*.html        # từng route của site
├── server.mjs           # HTTP server, rewrite origin và phục vụ fixture
├── lib/
│   ├── rewrite.mjs      # đổi URL tuyệt đối của parroto.app về đường dẫn nội bộ
│   ├── api-fixtures.mjs # tra fixture theo method + path + query
│   ├── origin-fallback.mjs # tải và cache route chưa mirror từ origin
│   └── mime.mjs         # content-type
├── scripts/
│   ├── inventory.mjs    # lập danh mục route từ sitemap + _buildManifest
│   ├── mirror.mjs       # mirror HTML và tài nguyên
│   ├── mirror-data.mjs  # tải _next/data payload thật cho từng route/ngôn ngữ
│   └── verify.mjs       # kiểm tra toàn bộ route trên server nội bộ
└── data/                # danh mục route, báo cáo mirror, kết quả kiểm tra
```

## Chạy

```
node server.mjs --port=4173
```

Mở http://127.0.0.1:4173.

## Quy mô bản mirror

| Hạng mục | Số lượng |
| --- | --- |
| Route HTML | 6.441 (static 680, app 289, sitemap 3.910, blog 1.562) |
| Ngôn ngữ | 17 (en, ar, de, el, es, id, ja, ko, ms, pt, ru, th, tr, uk, vi, zh-CN, zh-TW) |
| Data payload Next.js | 4.882 file |
| Dung lượng `public/` | ~2,3 GB |
| Fixture API | 37 endpoint (GET/POST, giữ nguyên mã trạng thái gốc) |

## Cách hoạt động

1. **Rewrite khi phục vụ.** Tài nguyên lưu trên đĩa vẫn giữ URL gốc (`https://assets.parroto.app/...`); server thay bằng đường dẫn nội bộ (`/assets/...`, `/api/...`, `/podcast/...`) khi trả về, nên đổi cổng hay tên miền không phải sửa dữ liệu.
2. **Nav phía client.** Mỗi trang có `__NEXT_DATA__` rỗng từ SSR, nên `_next/data/<buildId>/<locale>/<route>.json` được tải từ origin và phục vụ nội bộ; router Next lấy props và bản dịch từ đây.
3. **API.** Các endpoint app gọi được phục vụ từ fixture JSON. Endpoint chưa chụp trả `404 {"error":"endpoint not captured"}` để app giữ nguyên dữ liệu SSR (giống hành vi lỗi 401 của origin), thay vì thay bằng trạng thái rỗng.
4. **Route ngoài danh mục** (từ điển, bài học động, trang mới) được tải từ origin ở lần truy cập đầu rồi cache vào `public/`, nên site vẫn đầy đủ với mọi URL hợp lệ.

## Kiểm chứng độ giống

- So sánh pixel 15 trang (chụp bằng REA, Chrome 1280×720, cùng kịch bản, chờ ổn định): trang chủ, pricing, games, vocabulary/cards/word-match, topic, blog post, `/vi`, `/zh-CN/vocabulary/common-1000` trùng khít 0 pixel; các trang còn lại lệch 0,0002–0,024 do số liệu sống (lượt làm bài, bảng xếp hạng), khung hình mascot động, hoặc ảnh minh hoạ bị resample dưới 1 pixel. Riêng `/community-lessons` lệch 0,12 vì danh sách bài học trên origin đã thay đổi so với lúc chụp fixture.
- Điều hướng client-side (click sidebar sang `/topics`, `/vocabulary`, `/games`, `/stories`) đổi trang đúng, tiêu đề và nội dung đúng, không lỗi console.
- Audit 47 trang đại diện: 0 tài nguyên lỗi; 3 request API trả 401 giống hệt origin (các endpoint yêu cầu đăng nhập).
- `npm run verify`: 6.415/6.441 route trả 200; 26 route còn lại là URL chết trong sitemap gốc (origin cũng trả 404).

## Hạn chế

- Nội dung động (bảng xếp hạng, bài cộng đồng, số lượt học) là ảnh chụp tại thời điểm mirror.
- Các trang cần đăng nhập chỉ có trạng thái chưa đăng nhập; đăng nhập, thanh toán, ghi dữ liệu không hoạt động vì không có backend thật.
- Route ngoài danh mục cần Internet cho lần tải đầu; sau đó chạy offline.
- Âm thanh, video YouTube và quảng cáo vẫn lấy từ dịch vụ bên thứ ba.

## Làm mới dữ liệu

```
npm run inventory      # cập nhật danh mục route từ sitemap
npm run mirror         # mirror HTML + tài nguyên
npm run data           # tải lại data payload Next.js
npm run verify         # kiểm tra lại toàn bộ route
```

## Nguồn và bản quyền

Toàn bộ nội dung, hình ảnh, mã và nhãn hiệu thuộc PARROTO COMPANY LIMITED. Bản mirror này chỉ dùng cho mục đích học tập và nghiên cứu kỹ thuật.

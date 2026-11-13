const ORIGIN_REWRITES = [
  ["https://assets.parroto.app", "/assets"],
  ["https://podcast.parroto.app", "/podcast"],
  ["https://api.parroto.app", ""],
  ["https://www.parroto.app", ""],
  ["https://parroto.app", ""]
];

const TEXT_REWRITES = [
  ["PARROTO COMPANY LIMITED", "TuanDat"],
  ["PARROTO CO., LTD.", "TuanDat"],
  ["Parroto", "TuanDat"],
  ["/favicon/96x96.png\"", "/favicon/96x96.png?v=tuandat7\""],
  ["/assets/images/favicon/logo.png\"", "/assets/images/favicon/logo.png?v=tuandat7\""]
];

const NEW_LOGO_IMAGE_MARKUP =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="48" height="48" style="width:48px;height:48px;display:block;flex-shrink:0">' +
  '<image href="/assets/images/favicon/logo.png" width="512" height="512" preserveAspectRatio="xMidYMid meet"/></svg>';

function replaceInlineLogoSvg(text) {
  if (!text.includes("M28 84C28 53.0721")) {
    return text;
  }
  return text.replace(/<svg\b[^>]*>[\s\S]*?M28 84C28 53\.0721[\s\S]*?<\/svg>/g, NEW_LOGO_IMAGE_MARKUP);
}

function stripExternalHtmlBlocks(text) {
  let result = text;
  if (result.includes('class="footer-social"')) {
    result = result.replace(/<div class="footer-social"[^>]*>[\s\S]*?<\/div>/g, "");
  }
  if (result.includes("https://www.facebook.com/groups/parroto")) {
    result = result.replace(/<a\b[^>]*href="https:\/\/www\.facebook\.com\/groups\/parroto"[^>]*>[\s\S]*?<\/a>/g, "");
  }
  if (result.includes("apple-download.svg") || result.includes("android-download.svg")) {
    result = result.replace(
      /<div class="sm\+:py-16 py-8 bg-background"><div class="mx-auto container"><div class="relative rounded-2xl shadow-xl overflow-hidden bg-muted">[\s\S]*?android-download\.svg"[^>]*><\/button><\/div><\/div><\/div><\/div><\/div>/g,
      ""
    );
    result = result.replace(
      /<div class="mb-6"><h4 class="text-white font-medium mb-3">[\s\S]*?android-download\.svg"[^>]*><\/a><\/div><\/div>/g,
      ""
    );
    result = result.replace(/<a\b[^>]*href="https:\/\/(?:apps\.apple\.com|play\.google\.com)[^"]*"[^>]*>[\s\S]*?<\/a>/g, "");
  }
  if (result.includes('<div class="flex items-center gap-3 ml-4 flex-wrap">')) {
    result = result.replace(
      /<div class="flex items-center gap-3 ml-4 flex-wrap">[\s\S]*?<\/a><\/div>(?=<\/div><div class="flex items-center gap-x-2 text-sm text-stone-400">)/g,
      ""
    );
  }
  if (result.includes('class="flex items-center gap-2 group/item mt-1"')) {
    result = result.replace(/<div class="flex items-center gap-2 group\/item mt-1">[\s\S]*?<\/a><\/div>/g, "");
  }
  if (result.includes("https://www.facebook.com/parroto.english") && result.includes("grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4")) {
    result = result.replace(
      /<section><h2 class="text-2xl font-semibold mb-4">[^<]*<\/h2><p class="text-muted-foreground mb-6">[^<]*<\/p><div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">[\s\S]*?<\/section>/g,
      ""
    );
  }
  if (result.includes("https://apps.apple.com/")) {
    result = result.replace(/<a\b[^>]*href="https:\/\/apps\.apple\.com\/[^"]*"[^>]*>[\s\S]*?<\/a>/g, "");
  }
  if (result.includes('data-ntpc="YouTubeEmbed"')) {
    result = result.replace(
      /<div class="mt-12"><div class="mx-auto max-w-4xl"><div class="rounded-xl overflow-hidden shadow-lg[^>]*><div[^>]*data-ntpc="YouTubeEmbed">[\s\S]*?<\/lite-youtube><\/div><\/div><\/div><\/div>/g,
      ""
    );
  }
  if (result.includes('/about-us/advisors"')) {
    result = result.replace(
      /<section class="w-full sm\+:py-16 py-8 bg-background relative overflow-hidden"><div class="absolute inset-0 bg-grid-neutral-100\/50[\s\S]*?\/about-us\/advisors"[\s\S]*?<\/a><\/div><\/div><\/section>/g,
      ""
    );
  }
  if (result.includes("Facebook Community")) {
    result = result.replace(
      /<button class="w-full flex items-center px-3 py-2\.5 rounded-duo border-2 border-\[#1877F2\]\/30[^>]*>[\s\S]*?Facebook Community<\/button>/g,
      ""
    );
  }
  if (result.includes('class="flex items-center gap-2 group/item"')) {
    result = result.replace(
      /<div class="flex items-center gap-2 group\/item"><svg[^>]*lucide-facebook[\s\S]*?<\/a><\/div>/g,
      ""
    );
  }
  if (result.includes("https://www.linkedin.com/")) {
    result = result.replace(
      /<a\b[^>]*href="https:\/\/www\.linkedin\.com\/[^"]*"[^>]*>[\s\S]*?<\/a>/g,
      ""
    );
  }
  if (result.includes("qrcode-parroto.png")) {
    result = result.replace(
      /<p class="font-semibold text-xl">[^<]*<\/p><img src="https:\/\/assets\.parroto\.app\/images\/qrcode-parroto\.png"[^>]*\/><div class="space-y-4"><div class="flex justify-center space-x-4 md:space-x-5">[\s\S]*?android-download\.svg"[^>]*\/><\/div><\/div>/g,
      ""
    );
  }
  if (result.includes("/pricing") || result.includes("/affiliate")) {
    result = result.replace(/<a[^>]*href="\/(?:[a-z]{2}\/)?(?:pricing|affiliate)"[^>]*>[\s\S]*?<\/a>/g, "");
  }
  if (result.includes("bg-gradient-pro")) {
    result = result.replace(/<span[^>]*bg-gradient-pro[^>]*>[\s\S]*?<\/span>/g, "");
  }
  if (result.includes("border-yellow-300")) {
    result = result.replace(/<span data-slot="badge"[^>]*border-yellow-300[^>]*>[\s\S]*?<\/span><\/span><\/span>/g, "");
  }
  if (result.includes("border-yellow-400")) {
    result = result.replace(
      /border-yellow-400 dark:border-yellow-500 shadow-\[0_4px_0_0_rgb\(161,98,7\)\] dark:shadow-\[0_4px_0_0_rgb\(120,53,15\)\] bg-gradient-to-br from-yellow-50 via-orange-50 to-yellow-50 dark:from-yellow-950 dark:via-orange-950 dark:to-yellow-950/g,
      "border-border shadow-duo bg-card hover:border-primary/40"
    );
  }
  if (result.includes("text-yellow-700")) {
    result = result.replace(
      /text-yellow-700 dark:text-yellow-300 group-hover:text-yellow-800 dark:group-hover:text-yellow-200/g,
      "text-foreground group-hover:text-primary"
    );
  }
  return result;
}

export function rewriteBody(bodyText) {
  let result = bodyText;
  result = stripExternalHtmlBlocks(result);
  result = replaceInlineLogoSvg(result);
  result = result.replaceAll('"is_pro":true', '"is_pro":false');
  result = result.replaceAll('"is_free":false', '"is_free":true');
  for (const [from, to] of ORIGIN_REWRITES) {
    if (result.includes(from)) {
      result = result.split(from).join(to);
    }
  }
  for (const [from, to] of TEXT_REWRITES) {
    if (result.includes(from)) {
      result = result.split(from).join(to);
    }
  }
  if (result.includes("/_next/static/")) {
    result = result.replace(/(src|href)="(\/_next\/static\/[^"?]+\.(?:js|css))(?:\?v=[^"]*)?"/g, '$1="$2?v=tuandat7"');
  }
  return result;
}

import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createAnonClient, createUserClient } from "./supabase.mjs";
import { rewriteBody } from "./rewrite.mjs";

const DEFAULT_AVATAR = "/assets/images/favicon/logo.png";
const DAILY_CHECKIN_REWARD = 50;
const FREEZE_PRICE_DIAMOND = 5000;
const FREEZE_MAX_OWNED = 7;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STREAK_MILESTONES_CONFIG = [
  { days: 3, badge_code: "streak_3d", diamonds: 20, freeze_gift: 0, emit_feed: false },
  { days: 7, badge_code: "streak_7d", diamonds: 50, freeze_gift: 0, emit_feed: false },
  { days: 14, badge_code: "streak_14d", diamonds: 100, freeze_gift: 0, emit_feed: false },
  { days: 30, badge_code: "streak_30d", diamonds: 200, freeze_gift: 1, frame_code: "frame_30d", emit_feed: true },
  { days: 60, badge_code: "streak_60d", diamonds: 350, freeze_gift: 1, emit_feed: true },
  { days: 90, badge_code: "streak_90d", diamonds: 500, freeze_gift: 1, background_code: "bg_streak_90d", emit_feed: true },
  { days: 120, badge_code: "streak_120d", diamonds: 700, freeze_gift: 2, emit_feed: true },
  { days: 180, badge_code: "streak_180d", diamonds: 1000, freeze_gift: 2, background_code: "bg_streak_180d", emit_feed: true },
  { days: 270, badge_code: "streak_270d", diamonds: 1800, freeze_gift: 2, frame_code: "frame_270d", emit_feed: true },
  { days: 365, badge_code: "streak_365d", diamonds: 3000, freeze_gift: 3, frame_code: "frame_year_dragon", background_code: "bg_year_dragon", emit_feed: true }
];

const LEVEL_MILESTONES_CONFIG = [
  { level: 1, title: "Newcomer", min_xp: 0, reward_diamonds: 0 },
  { level: 2, title: "Learner", min_xp: 250, reward_diamonds: 30 },
  { level: 3, title: "Explorer", min_xp: 600, reward_diamonds: 50 },
  { level: 5, title: "Speaker", min_xp: 1000, reward_diamonds: 100 },
  { level: 10, title: "Master", min_xp: 3000, reward_diamonds: 300 }
];

function isoDateInTimezone(timeZone = "Asia/Ho_Chi_Minh", offsetDays = 0) {
  const target = new Date(Date.now() + offsetDays * 86400000);
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(target);
  } catch {
    return target.toISOString().slice(0, 10);
  }
}

function getTimezone(req, body) {
  return (body && typeof body.timezone === "string" && body.timezone) ||
    req.headers["x-user-timezone"] ||
    "Asia/Ho_Chi_Minh";
}

function createDefaultMissions(dateStr) {
  return {
    date: dateStr,
    items: [
      {
        _id: "mission_shadowing",
        type: "shadowing",
        status: "in_progress",
        reward_diamonds: 30,
        attempts: 0,
        score: null,
        target: {
          text: "Practice makes progress every single day.",
          translations: {
            vi: "Luyện tập tạo nên sự tiến bộ mỗi ngày.",
            en: "Practice makes progress every single day."
          },
          lesson_url: null,
          lesson_type: "audio",
          start_ms: 0,
          end_ms: 4000,
          lesson_slug: null
        }
      },
      {
        _id: "mission_vocabulary",
        type: "vocabulary",
        status: "in_progress",
        reward_diamonds: 30,
        target: {
          vocab_id: null,
          word: "consistent",
          explanation: {
            vi: "Kiên định, nhất quán trong hành động hoặc thói quen.",
            en: "Acting or done in the same way over time."
          },
          translation: {
            vi: "kiên trì, nhất quán",
            en: "consistent"
          },
          example: {
            en: "Consistent practice is the key to mastering English.",
            vi: "Luyện tập kiên trì là chìa khóa để làm chủ tiếng Anh."
          },
          phonetic: {
            text: "kənˈsɪstənt",
            audio: { female: "", male: "" }
          }
        }
      },
      {
        _id: "mission_dictation",
        type: "dictation",
        status: "in_progress",
        reward_diamonds: 30,
        target: {
          text: "Learning a new language opens many doors.",
          translations: {
            vi: "Học một ngôn ngữ mới mở ra nhiều cánh cửa.",
            en: "Learning a new language opens many doors."
          },
          lesson_url: null,
          lesson_type: "audio",
          start_ms: 0,
          end_ms: 4000,
          lesson_slug: null
        }
      }
    ]
  };
}

function isValidMissionsPayload(missions, dateStr) {
  if (!missions || missions.date !== dateStr || !Array.isArray(missions.items)) return false;
  const requiredTypes = ["shadowing", "vocabulary", "dictation"];
  return requiredTypes.every((t) =>
    missions.items.some((item) => item && item.type === t && item.target && typeof item.target === "object")
  );
}

function extractLessonProgressEntry(item, defaultProgress) {
  if (!item) return null;
  if (typeof item === "string" || typeof item === "number") {
    return { lesson_id: String(item), progress: defaultProgress };
  }
  const lid =
    typeof item.lesson_id === "object" && item.lesson_id
      ? item.lesson_id._id || item.lesson_id.id
      : item.lesson_id || item._id || item.id;
  if (!lid) return null;
  return {
    ...item,
    lesson_id: String(lid),
    progress: Number.isFinite(Number(item.progress)) ? Number(item.progress) : defaultProgress
  };
}

function buildLessonProgressArray(lp, requestedIds = null) {
  const map = new Map();
  if (Array.isArray(lp)) {
    for (const raw of lp) {
      const entry = extractLessonProgressEntry(raw, 0);
      if (entry) map.set(entry.lesson_id, entry);
    }
  } else {
    for (const raw of Array.isArray(lp?.in_progress) ? lp.in_progress : []) {
      const entry = extractLessonProgressEntry(raw, 50);
      if (entry) map.set(entry.lesson_id, entry);
    }
    for (const raw of Array.isArray(lp?.completed) ? lp.completed : []) {
      const entry = extractLessonProgressEntry(raw, 100);
      if (entry) map.set(entry.lesson_id, entry);
    }
    for (const raw of Array.isArray(lp?.items) ? lp.items : []) {
      const entry = extractLessonProgressEntry(raw, 50);
      if (entry) map.set(entry.lesson_id, entry);
    }
  }
  if (Array.isArray(requestedIds) && requestedIds.length) {
    return requestedIds.map((id) => map.get(String(id))).filter(Boolean);
  }
  return Array.from(map.values());
}

function defaultStats() {
  return {
    overall_stats: {
      total_sentences: 0,
      current_level: 0,
      average_score: 0,
      total_lessons: 0,
      total_time: 0
    },
    shadowing_stats: {
      total_sentences: 0,
      current_level: 0,
      average_score: 0,
      total_lessons: 0,
      total_time: 0
    }
  };
}

function sendJson(req, res, statusCode, payload, extraHeaders = {}) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": body.length,
    "cache-control": "no-store, no-cache, must-revalidate",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization, X-User-Timezone",
    ...extraHeaders
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(body);
}

async function readRawBody(req, maxBytes = 10 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new Error("Payload too large");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function parseJsonBody(req) {
  const buf = await readRawBody(req);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return null;
  }
}

function splitBuffer(buf, delimiter) {
  const parts = [];
  let start = 0;
  while (true) {
    const idx = buf.indexOf(delimiter, start);
    if (idx === -1) {
      parts.push(buf.subarray(start));
      break;
    }
    parts.push(buf.subarray(start, idx));
    start = idx + delimiter.length;
  }
  return parts;
}

function parseMultipartFormData(contentType, bodyBuffer) {
  const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType || "");
  if (!match) return { fields: {}, files: {} };
  const boundary = match[1] || match[2];
  const boundaryBuf = Buffer.from(`--${boundary}`, "utf8");
  const headerSep = Buffer.from("\r\n\r\n", "utf8");
  const rawParts = splitBuffer(bodyBuffer, boundaryBuf);
  const fields = {};
  const files = {};

  for (const part of rawParts) {
    let chunk = part;
    if (chunk.length >= 2 && chunk[0] === 13 && chunk[1] === 10) {
      chunk = chunk.subarray(2);
    }
    if (!chunk.length || (chunk.length >= 2 && chunk[0] === 45 && chunk[1] === 45)) {
      continue;
    }
    const sepIdx = chunk.indexOf(headerSep);
    if (sepIdx === -1) continue;
    const rawHeaders = chunk.subarray(0, sepIdx).toString("utf8");
    let content = chunk.subarray(sepIdx + 4);
    if (content.length >= 2 && content[content.length - 2] === 13 && content[content.length - 1] === 10) {
      content = content.subarray(0, content.length - 2);
    }
    const dispMatch = /name="([^"]+)"/i.exec(rawHeaders);
    if (!dispMatch) continue;
    const fieldName = dispMatch[1];
    const fileMatch = /filename="([^"]*)"/i.exec(rawHeaders);
    if (fileMatch) {
      const mimeMatch = /content-type:\s*([^\r\n;]+)/i.exec(rawHeaders);
      const mimeType = mimeMatch ? mimeMatch[1].trim() : "application/octet-stream";
      files[fieldName] = {
        filename: fileMatch[1],
        mimeType,
        size: content.length,
        dataUrl: `data:${mimeType};base64,${content.toString("base64")}`
      };
    } else {
      fields[fieldName] = content.toString("utf8");
    }
  }
  return { fields, files };
}

function parseCookies(req) {
  const raw = req.headers.cookie;
  const out = {};
  if (!raw) return out;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

function extractTokens(req) {
  const cookies = parseCookies(req);
  const auth = req.headers.authorization || req.headers.Authorization;
  let accessToken = null;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    accessToken = auth.slice(7).trim();
  }
  if (!accessToken) {
    accessToken = cookies.access_token || cookies.token || null;
  }
  return {
    accessToken,
    refreshToken: cookies.refresh_token || null
  };
}

function buildAuthCookies(accessToken, refreshToken, maxAgeSeconds = 30 * 24 * 60 * 60) {
  const cookies = [
    `access_token=${encodeURIComponent(accessToken || "")}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`
  ];
  if (refreshToken !== undefined) {
    cookies.push(
      `refresh_token=${encodeURIComponent(refreshToken || "")}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`
    );
  }
  return cookies;
}

function deriveDisplayName(email, explicitName) {
  if (explicitName && String(explicitName).trim()) {
    return String(explicitName).trim().slice(0, 50);
  }
  const local = String(email || "").split("@")[0] || "Learner";
  const words = local.replace(/[._-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "TuanDat Learner";
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ").slice(0, 50);
}

async function generateUniqueUsername(client, seed) {
  let base = String(seed || "user").toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  if (base.length < 3) base = (base + "user").slice(0, 10);
  base = base.slice(0, 14);
  for (let i = 0; i < 8; i += 1) {
    const candidate = i === 0 ? base : `${base.slice(0, 12)}_${crypto.randomBytes(2).toString("hex")}`;
    const { data } = await client.from("usernames").select("username").eq("username", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${base.slice(0, 10)}_${crypto.randomBytes(3).toString("hex")}`;
}

function resolveSiteOrigin(req) {
  const origin = req.headers.origin;
  if (typeof origin === "string" && /^https?:\/\//i.test(origin)) {
    return origin.replace(/\/+$/, "");
  }
  const host = req.headers.host;
  if (typeof host === "string" && host) {
    return `http://${host}`;
  }
  return (process.env.SITE_URL || "http://127.0.0.1:4173").replace(/\/+$/, "");
}

function normalizeProfileRow(row) {
  const todayStr = isoDateInTimezone();
  return {
    id: row.id,
    uid: row.id,
    _id: row.id,
    email: row.email || "",
    username: row.username || "",
    displayName: row.display_name || "Learner",
    photoURL: row.photo_url || DEFAULT_AVATAR,
    backgroundURL: row.background_url ?? null,
    description: row.description || "",
    isPrivate: Boolean(row.is_private),
    birthday: row.birthday || null,
    gender: row.gender || null,
    role: row.role || "user",
    provider: row.provider || "email",
    diamonds: Number(row.diamonds ?? 0),
    freeze_count: Number(row.freeze_count ?? 0),
    current_streak: Number(row.current_streak ?? 0),
    longest_streak: Number(row.longest_streak ?? 0),
    last_streak_date: row.last_streak_date ? Number(row.last_streak_date) : null,
    last_streak_day: row.last_streak_day ?? null,
    checkin_dates: Array.isArray(row.checkin_dates) ? row.checkin_dates : [],
    claimed_streak_milestones: Array.isArray(row.claimed_streak_milestones) ? row.claimed_streak_milestones : [],
    claimed_level_milestones: Array.isArray(row.claimed_level_milestones) ? row.claimed_level_milestones : [],
    level: Number(row.level ?? 1),
    xp: Number(row.xp ?? 0),
    level_xp: Number(row.level_xp ?? 0),
    next_level_xp: Number(row.next_level_xp ?? 500),
    premium: row.premium || { status: "active", is_lifetime: true, expires_at: null },
    selected_avatar_frame: row.selected_avatar_frame ?? null,
    selected_background: row.selected_background ?? null,
    selected_name_color: row.selected_name_color ?? null,
    selected_badge: row.selected_badge ?? null,
    active_avatar_frames: Array.isArray(row.active_avatar_frames) ? row.active_avatar_frames : [],
    stats: row.stats && typeof row.stats === "object" ? row.stats : defaultStats(),
    ranking_history: Array.isArray(row.ranking_history) ? row.ranking_history : [],
    lesson_progress: row.lesson_progress && typeof row.lesson_progress === "object"
      ? {
          completed: Array.isArray(row.lesson_progress.completed) ? row.lesson_progress.completed : [],
          in_progress: Array.isArray(row.lesson_progress.in_progress) ? row.lesson_progress.in_progress : []
        }
      : { completed: [], in_progress: [] },
    completed_sentences: row.completed_sentences && typeof row.completed_sentences === "object" ? row.completed_sentences : {},
    missions: isValidMissionsPayload(row.missions, todayStr) ? row.missions : createDefaultMissions(todayStr),
    learning_sessions: row.learning_sessions && typeof row.learning_sessions === "object"
      ? row.learning_sessions
      : { total_seconds: 0, active_session_id: null, last_heartbeat: null },
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function ensureProfile(userClient, authUser, extra = {}) {
  const { data: existing, error: fetchError } = await userClient
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }
  if (existing) {
    return normalizeProfileRow(existing);
  }

  const email = String(authUser.email || "").trim().toLowerCase();
  const local = email.split("@")[0] || "learner";
  const username = await generateUniqueUsername(userClient, local);
  const displayName = deriveDisplayName(email, extra.displayName || authUser.user_metadata?.full_name || authUser.user_metadata?.name);
  const todayStr = isoDateInTimezone();

  const row = {
    id: authUser.id,
    email,
    username,
    display_name: displayName,
    photo_url: extra.photoURL || authUser.user_metadata?.avatar_url || DEFAULT_AVATAR,
    background_url: null,
    description: "",
    is_private: false,
    birthday: "2000-01-01",
    gender: "other",
    role: "user",
    provider: authUser.app_metadata?.provider || "email",
    diamonds: 500,
    freeze_count: 1,
    current_streak: 0,
    longest_streak: 0,
    last_streak_date: null,
    last_streak_day: null,
    checkin_dates: [],
    claimed_streak_milestones: [],
    claimed_level_milestones: [],
    level: 1,
    xp: 0,
    level_xp: 0,
    next_level_xp: 500,
    premium: { status: "active", is_lifetime: true, expires_at: null },
    stats: defaultStats(),
    ranking_history: [],
    lesson_progress: { completed: [], in_progress: [] },
    completed_sentences: {},
    missions: createDefaultMissions(todayStr),
    learning_sessions: { total_seconds: 0, active_session_id: null, last_heartbeat: null }
  };

  const { data: inserted, error: insertError } = await userClient
    .from("profiles")
    .insert(row)
    .select("*")
    .single();

  if (insertError) {
    const { data: retryRow } = await userClient
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();
    if (retryRow) return normalizeProfileRow(retryRow);
    throw new Error(insertError.message);
  }
  return normalizeProfileRow(inserted);
}

async function resolveSession(req) {
  const { accessToken, refreshToken } = extractTokens(req);
  if (!accessToken && !refreshToken) return null;

  const anon = createAnonClient();

  if (accessToken) {
    const { data, error } = await anon.auth.getUser(accessToken);
    if (!error && data?.user) {
      const userClient = createUserClient(accessToken);
      const profile = await ensureProfile(userClient, data.user);
      return {
        authUser: data.user,
        userClient,
        profile,
        token: accessToken,
        refreshedCookies: null
      };
    }
  }

  if (refreshToken) {
    const { data, error } = await anon.auth.refreshSession({ refresh_token: refreshToken });
    if (!error && data?.session?.access_token && data?.user) {
      const newToken = data.session.access_token;
      const newRefresh = data.session.refresh_token || refreshToken;
      const userClient = createUserClient(newToken);
      const profile = await ensureProfile(userClient, data.user);
      return {
        authUser: data.user,
        userClient,
        profile,
        token: newToken,
        refreshedCookies: buildAuthCookies(newToken, newRefresh)
      };
    }
  }

  return null;
}

async function requireAuth(req, res) {
  try {
    const resolved = await resolveSession(req);
    if (!resolved) {
      sendJson(req, res, 401, { status: "error", message: "Unauthorized: No token provided", data: null });
      return null;
    }
    return resolved;
  } catch (err) {
    sendJson(req, res, 401, { status: "error", message: err?.message || "Unauthorized", data: null });
    return null;
  }
}

function toAuthUser(profile, token) {
  return {
    uid: profile.uid,
    _id: profile._id,
    email: profile.email,
    displayName: profile.displayName,
    photoURL: profile.photoURL || DEFAULT_AVATAR,
    emailVerified: true,
    isAnonymous: false,
    providerData: [
      {
        providerId: "password",
        uid: profile.uid,
        displayName: profile.displayName,
        email: profile.email,
        photoURL: profile.photoURL || DEFAULT_AVATAR
      }
    ],
    stsTokenManager: {
      refreshToken: token,
      accessToken: token,
      expirationTime: Date.now() + SESSION_TTL_MS
    },
    accessToken: token
  };
}

function toUserInfo(profile) {
  return {
    _id: profile._id,
    id: profile.id,
    uid: profile.uid,
    email: profile.email,
    username: profile.username,
    displayName: profile.displayName,
    photoURL: profile.photoURL || DEFAULT_AVATAR,
    backgroundURL: profile.backgroundURL ?? null,
    description: profile.description || "",
    isPrivate: Boolean(profile.isPrivate),
    birthday: profile.birthday || null,
    gender: profile.gender || null,
    role: profile.role || "user",
    diamonds: profile.diamonds,
    freeze_count: profile.freeze_count,
    current_streak: profile.current_streak,
    longest_streak: profile.longest_streak,
    last_streak_date: profile.last_streak_date,
    level: profile.level,
    xp: profile.xp,
    premium: profile.premium,
    selected_avatar_frame: profile.selected_avatar_frame ?? null,
    selected_background: profile.selected_background ?? null,
    selected_name_color: profile.selected_name_color ?? null,
    selected_badge: profile.selected_badge ?? null,
    active_avatar_frames: profile.active_avatar_frames || [],
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
}

function buildStreakState(profile, timeZone) {
  const todayStr = isoDateInTimezone(timeZone);
  const checkedInToday =
    profile.last_streak_day === todayStr ||
    (Array.isArray(profile.checkin_dates) && profile.checkin_dates.includes(todayStr));
  return {
    current_streak: profile.current_streak || 0,
    longest_streak: profile.longest_streak || 0,
    freeze_count: profile.freeze_count || 0,
    last_activity_date: profile.last_streak_date,
    last_streak_date: profile.last_streak_date,
    has_checked_in_today: checkedInToday,
    checkin_dates: profile.checkin_dates || [],
    claimed_milestones: profile.claimed_streak_milestones || []
  };
}

function buildLevelState(profile) {
  const currentXp = profile.level_xp ?? (profile.xp % 500);
  const nextLevelXp = profile.next_level_xp || 500;
  return {
    level: profile.level || 1,
    level_number: profile.level || 1,
    xp: profile.xp || 0,
    current_xp: currentXp,
    next_level_xp: nextLevelXp,
    total_xp: profile.xp || 0,
    progress_percent: Math.min(100, Math.round((currentXp / nextLevelXp) * 100))
  };
}

function mapSupabaseAuthError(error) {
  const code = error?.code || "";
  const msg = error?.message || "Authentication failed";
  if (code === "email_address_not_authorized" || msg.includes("email_address_not_authorized")) {
    return {
      status: 400,
      message: "Supabase built-in email only sends to organization members. Configure Custom SMTP in Supabase Dashboard to send OTP to any email."
    };
  }
  if (code === "over_email_send_rate_limit" || error?.status === 429) {
    return {
      status: 429,
      message: "Email rate limit exceeded. Please wait before requesting another code."
    };
  }
  return {
    status: error?.status || 400,
    message: msg
  };
}

async function lookupPublicProfile(identifier) {
  const anon = createAnonClient();
  let query = anon.from("public_profiles").select("*");
  if (UUID_RE.test(identifier)) {
    query = query.eq("id", identifier);
  } else {
    query = query.eq("username", identifier.toLowerCase());
  }
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return normalizeProfileRow(data);
}

function formatPurchasedEntry(row) {
  return {
    _id: row.id,
    id: row.id,
    itemId: row.item_id,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    item: row.item || { _id: row.item_id, type: row.item_type }
  };
}

async function loadShopCatalog(publicDir) {
  const filePath = path.join(publicDir, "api", "shop", "items.2b02713429.json");
  const raw = await fsp.readFile(filePath, "utf8");
  const parsed = JSON.parse(rewriteBody(raw));
  return Array.isArray(parsed?.data?.items) ? parsed.data.items : [];
}

function getEffectiveItemPrice(item) {
  if (typeof item.finalPrice === "number") return item.finalPrice;
  if (item.discount?.isActive && typeof item.discount.percentage === "number" && item.discount.percentage > 0) {
    return Math.round(item.price * (1 - item.discount.percentage / 100));
  }
  return Number(item.price || 0);
}

function cookieHeaders(resolved) {
  return resolved?.refreshedCookies ? { "set-cookie": resolved.refreshedCookies } : {};
}

function parseVerificationInput(rawInput) {
  const text = String(rawInput || "").trim();
  if (!text) return { kind: "empty" };
  if (/^https?:\/\//i.test(text) || text.includes("token=") || text.includes("token_hash=") || text.includes("access_token=") || text.includes("code=")) {
    let currentUrl = text;
    for (let depth = 0; depth < 3; depth += 1) {
      try {
        const parsedUrl = currentUrl.startsWith("http")
          ? new URL(currentUrl)
          : new URL(currentUrl.startsWith("?") || currentUrl.startsWith("#") ? `http://local/${currentUrl}` : `http://local/?${currentUrl}`);
        const nestedUrl = parsedUrl.searchParams.get("q") || parsedUrl.searchParams.get("url");
        if (nestedUrl && /^https?:\/\//i.test(nestedUrl) && nestedUrl !== currentUrl) {
          currentUrl = nestedUrl;
          continue;
        }
        const hashParams = new URLSearchParams(parsedUrl.hash ? parsedUrl.hash.slice(1) : "");
        const accessToken = hashParams.get("access_token") || parsedUrl.searchParams.get("access_token");
        if (accessToken) {
          return {
            kind: "access_token",
            accessToken: accessToken.trim(),
            refreshToken: (hashParams.get("refresh_token") || parsedUrl.searchParams.get("refresh_token") || "").trim()
          };
        }
        const tokenHash = parsedUrl.searchParams.get("token_hash") || parsedUrl.searchParams.get("token") || hashParams.get("token_hash") || hashParams.get("token");
        const linkType = parsedUrl.searchParams.get("type") || hashParams.get("type") || "";
        if (tokenHash) {
          return {
            kind: "token_hash",
            tokenHash: tokenHash.trim(),
            type: linkType.trim()
          };
        }
        const code = parsedUrl.searchParams.get("code") || hashParams.get("code");
        if (code) {
          return { kind: "code", code: code.trim() };
        }
      } catch {
        break;
      }
      break;
    }
  }
  if (/^[a-f0-9]{32,}$/i.test(text)) {
    return { kind: "token_hash", tokenHash: text, type: "" };
  }
  return { kind: "otp", token: text.replace(/\s+/g, "") };
}

async function verifySupabaseEmailAuth(anon, { email = "", rawInput = "", preferredType = "" } = {}) {
  const parsed = parseVerificationInput(rawInput);
  if (parsed.kind === "empty") {
    return { ok: false, status: 400, message: "Verification code or link is required" };
  }
  if (parsed.kind === "access_token") {
    const { data, error } = await anon.auth.getUser(parsed.accessToken);
    if (error || !data?.user) {
      return { ok: false, status: 401, message: error?.message || "Invalid session link" };
    }
    return {
      ok: true,
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken || "",
      user: data.user
    };
  }
  if (parsed.kind === "code") {
    const { data, error } = await anon.auth.exchangeCodeForSession(parsed.code);
    if (error || !data?.session?.access_token || !data?.user) {
      return { ok: false, status: 401, message: error?.message || "Invalid or expired verification code" };
    }
    return {
      ok: true,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token || "",
      user: data.user
    };
  }
  if (parsed.kind === "token_hash") {
    const candidateTypes = Array.from(new Set([parsed.type, preferredType, "magiclink", "signup", "email"].filter(Boolean)));
    let lastError = null;
    for (const candidateType of candidateTypes) {
      const { data, error } = await anon.auth.verifyOtp({
        token_hash: parsed.tokenHash,
        type: candidateType
      });
      if (!error && data?.session?.access_token && data?.user) {
        return {
          ok: true,
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token || "",
          user: data.user
        };
      }
      lastError = error;
    }
    return { ok: false, status: 401, message: lastError?.message || "Invalid or expired verification link" };
  }
  if (!email) {
    return { ok: false, status: 400, message: "Email and verification code are required" };
  }
  const candidateTypes = Array.from(new Set([preferredType, "email", "magiclink", "signup"].filter(Boolean)));
  let lastError = null;
  for (const candidateType of candidateTypes) {
    const { data, error } = await anon.auth.verifyOtp({
      email,
      token: parsed.token,
      type: candidateType
    });
    if (!error && data?.session?.access_token && data?.user) {
      return {
        ok: true,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token || "",
        user: data.user
      };
    }
    lastError = error;
  }
  return { ok: false, status: 401, message: lastError?.message || "Invalid or expired verification code" };
}

async function sendSignedInEmailResponse(req, res, accessToken, refreshToken, authUser) {
  const userClient = createUserClient(accessToken);
  const profile = await ensureProfile(userClient, authUser);
  sendJson(
    req,
    res,
    200,
    {
      status: "success",
      message: "Signed in",
      data: {
        token: accessToken,
        refreshToken,
        user: toAuthUser(profile, accessToken),
        userData: toUserInfo(profile)
      }
    },
    { "set-cookie": buildAuthCookies(accessToken, refreshToken) }
  );
}

export async function handleAuthAndUserApi(req, res, url, dataDir, publicDir) {
  const method = req.method || "GET";
  const pathname = url.pathname;

  if (method === "OPTIONS" && pathname.startsWith("/api/")) {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization, X-User-Timezone",
      "access-control-max-age": "86400"
    });
    res.end();
    return true;
  }

  if ((pathname === "/api/auth/email/send-otp" || pathname === "/api/auth/email") && method === "POST") {
    const body = await parseJsonBody(req);
    if (!body) {
      sendJson(req, res, 400, { status: "error", message: "Invalid JSON body", data: null });
      return true;
    }
    const email = String(body.email || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendJson(req, res, 400, { status: "error", message: "Valid email is required", data: null });
      return true;
    }
    const anon = createAnonClient();
    const redirectBase = resolveSiteOrigin(req);
    const emailRedirectTo = typeof body.redirectTo === "string" && body.redirectTo.startsWith("http")
      ? body.redirectTo
      : `${redirectBase}/login`;
    const { error } = await anon.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo
      }
    });
    if (error) {
      const mapped = mapSupabaseAuthError(error);
      sendJson(req, res, mapped.status, { status: "error", message: mapped.message, data: null });
      return true;
    }
    sendJson(req, res, 200, {
      status: "success",
      message: "Verification code sent to your email",
      data: { otpSent: true, email }
    });
    return true;
  }

  if (pathname === "/api/auth/email/verify-otp" && method === "POST") {
    const body = await parseJsonBody(req);
    if (!body) {
      sendJson(req, res, 400, { status: "error", message: "Invalid JSON body", data: null });
      return true;
    }
    const email = String(body.email || "").trim().toLowerCase();
    const rawInput = String(body.token || body.otp || body.link || "").trim();
    const preferredType = String(body.type || "").trim();
    if (!rawInput) {
      sendJson(req, res, 400, { status: "error", message: "Email and verification code are required", data: null });
      return true;
    }
    const anon = createAnonClient();
    const result = await verifySupabaseEmailAuth(anon, { email, rawInput, preferredType });
    if (!result.ok) {
      sendJson(req, res, result.status, { status: "error", message: result.message, data: null });
      return true;
    }
    await sendSignedInEmailResponse(req, res, result.accessToken, result.refreshToken, result.user);
    return true;
  }

  if (pathname === "/api/auth/email/verify-link" && method === "POST") {
    const body = await parseJsonBody(req);
    if (!body) {
      sendJson(req, res, 400, { status: "error", message: "Invalid JSON body", data: null });
      return true;
    }
    const anon = createAnonClient();
    let accessToken = typeof body.access_token === "string" ? body.access_token.trim() : "";
    let refreshToken = typeof body.refresh_token === "string" ? body.refresh_token.trim() : "";
    let authUser = null;

    if (accessToken) {
      const { data, error } = await anon.auth.getUser(accessToken);
      if (error || !data?.user) {
        sendJson(req, res, 401, { status: "error", message: error?.message || "Invalid session link", data: null });
        return true;
      }
      authUser = data.user;
    } else if (typeof body.token_hash === "string" && body.token_hash.trim()) {
      const result = await verifySupabaseEmailAuth(anon, {
        email: String(body.email || "").trim().toLowerCase(),
        rawInput: body.token_hash.trim(),
        preferredType: typeof body.type === "string" ? body.type.trim() : ""
      });
      if (!result.ok) {
        sendJson(req, res, result.status, { status: "error", message: result.message, data: null });
        return true;
      }
      accessToken = result.accessToken;
      refreshToken = result.refreshToken;
      authUser = result.user;
    } else if (typeof body.code === "string" && body.code.trim()) {
      const { data, error } = await anon.auth.exchangeCodeForSession(body.code.trim());
      if (error || !data?.session?.access_token || !data?.user) {
        sendJson(req, res, 401, { status: "error", message: error?.message || "Invalid or expired verification code", data: null });
        return true;
      }
      accessToken = data.session.access_token;
      refreshToken = data.session.refresh_token || "";
      authUser = data.user;
    } else {
      sendJson(req, res, 400, { status: "error", message: "Missing verification parameters", data: null });
      return true;
    }

    await sendSignedInEmailResponse(req, res, accessToken, refreshToken, authUser);
    return true;
  }

  if (pathname === "/api/auth/google" && method === "POST") {
    sendJson(req, res, 400, {
      status: "error",
      message: "Google OAuth is not configured. Please sign in with your email.",
      data: null
    });
    return true;
  }

  if (pathname === "/api/auth/logout" && method === "POST") {
    const { accessToken } = extractTokens(req);
    if (accessToken) {
      try {
        const userClient = createUserClient(accessToken);
        await userClient.auth.signOut();
      } catch {}
    }
    sendJson(
      req,
      res,
      200,
      { status: "success", message: "Logged out", data: null },
      { "set-cookie": buildAuthCookies("", "", 0) }
    );
    return true;
  }

  if ((pathname === "/api/auth/session" || pathname === "/api/auth/me") && method === "GET") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    sendJson(
      req,
      res,
      200,
      {
        status: "success",
        message: "OK",
        data: {
          token: resolved.token,
          user: toAuthUser(resolved.profile, resolved.token),
          userData: toUserInfo(resolved.profile)
        }
      },
      cookieHeaders(resolved)
    );
    return true;
  }

  if (pathname === "/api/user/info" && method === "GET") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    sendJson(
      req,
      res,
      200,
      {
        status: "success",
        message: "OK",
        data: { user: toUserInfo(resolved.profile) }
      },
      cookieHeaders(resolved)
    );
    return true;
  }

  if (pathname === "/api/user/info" && method === "PUT") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const contentType = String(req.headers["content-type"] || "");
    let updates = {};
    let files = {};
    if (contentType.toLowerCase().includes("multipart/form-data")) {
      const raw = await readRawBody(req);
      const parsed = parseMultipartFormData(contentType, raw);
      updates = parsed.fields;
      files = parsed.files;
    } else {
      const body = await parseJsonBody(req);
      if (!body) {
        sendJson(req, res, 400, { status: "error", message: "Invalid JSON body", data: null });
        return true;
      }
      updates = body;
    }

    const patch = { updated_at: new Date().toISOString() };
    if (typeof updates.displayName === "string" && updates.displayName.trim()) {
      patch.display_name = updates.displayName.trim().slice(0, 50);
    }
    if (typeof updates.description === "string") {
      patch.description = updates.description.trim().slice(0, 500);
    }
    if (updates.isPrivate !== undefined) {
      patch.is_private = updates.isPrivate === true || updates.isPrivate === "true";
    }
    if (files.avatar && files.avatar.dataUrl) {
      patch.photo_url = files.avatar.dataUrl;
    } else if (typeof updates.photoURL === "string" && updates.photoURL) {
      patch.photo_url = updates.photoURL;
    }
    if (updates.removeBackground === true || updates.removeBackground === "true") {
      patch.background_url = null;
      patch.selected_background = null;
    } else if (files.background && files.background.dataUrl) {
      patch.background_url = files.background.dataUrl;
    } else if (typeof updates.backgroundURL === "string") {
      patch.background_url = updates.backgroundURL || null;
    }

    const { data, error } = await resolved.userClient
      .from("profiles")
      .update(patch)
      .eq("id", resolved.profile.id)
      .select("*")
      .single();

    if (error) {
      sendJson(req, res, 400, { status: "error", message: error.message, data: null });
      return true;
    }
    sendJson(
      req,
      res,
      200,
      {
        status: "success",
        message: "Profile updated",
        data: { user: toUserInfo(normalizeProfileRow(data)) }
      },
      cookieHeaders(resolved)
    );
    return true;
  }

  if (pathname.startsWith("/api/user/info/") && method === "GET") {
    const targetId = decodeURIComponent(pathname.slice("/api/user/info/".length));
    const resolved = await resolveSession(req);
    if (resolved && (resolved.profile.id === targetId || resolved.profile.username === targetId)) {
      const info = toUserInfo(resolved.profile);
      delete info.email;
      sendJson(req, res, 200, { status: "success", message: "OK", data: info });
      return true;
    }
    const target = await lookupPublicProfile(targetId);
    if (!target) {
      sendJson(req, res, 404, { status: "error", message: "User not found", data: null });
      return true;
    }
    if (target.isPrivate) {
      sendJson(req, res, 403, { status: "error", message: "Profile is private", data: null });
      return true;
    }
    const info = toUserInfo(target);
    delete info.email;
    sendJson(req, res, 200, { status: "success", message: "OK", data: info });
    return true;
  }

  if (pathname === "/api/user/username/check" && method === "GET") {
    const username = String(url.searchParams.get("username") || "").trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      sendJson(req, res, 200, { status: "success", message: "OK", data: { available: false, reason: "invalid" } });
      return true;
    }
    const resolved = await resolveSession(req);
    const anon = createAnonClient();
    const { data } = await anon.from("usernames").select("user_id").eq("username", username).maybeSingle();
    const taken = Boolean(data && (!resolved || data.user_id !== resolved.profile.id));
    sendJson(req, res, 200, { status: "success", message: "OK", data: { available: !taken } });
    return true;
  }

  if (pathname === "/api/user/username" && method === "PUT") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const body = await parseJsonBody(req);
    if (!body) {
      sendJson(req, res, 400, { status: "error", message: "Invalid JSON body", data: null });
      return true;
    }
    const username = String(body.username || "").trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      sendJson(req, res, 400, { status: "error", message: "Invalid username format", data: null });
      return true;
    }
    const { data: existing } = await resolved.userClient
      .from("usernames")
      .select("user_id")
      .eq("username", username)
      .maybeSingle();
    if (existing && existing.user_id !== resolved.profile.id) {
      sendJson(req, res, 409, { status: "error", message: "Username already taken", data: null });
      return true;
    }
    const { error } = await resolved.userClient
      .from("profiles")
      .update({ username, updated_at: new Date().toISOString() })
      .eq("id", resolved.profile.id);
    if (error) {
      const isConflict = error.code === "23505";
      sendJson(req, res, isConflict ? 409 : 400, {
        status: "error",
        message: isConflict ? "Username already taken" : error.message,
        data: null
      });
      return true;
    }
    sendJson(req, res, 200, { status: "success", message: "OK", data: { username } }, cookieHeaders(resolved));
    return true;
  }

  if (pathname === "/api/user/birthday" && method === "PUT") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const body = await parseJsonBody(req);
    if (!body) {
      sendJson(req, res, 400, { status: "error", message: "Invalid JSON body", data: null });
      return true;
    }
    const patch = { updated_at: new Date().toISOString() };
    if (typeof body.birthday === "string" && body.birthday.trim()) {
      patch.birthday = body.birthday.trim();
    }
    if (typeof body.gender === "string" && body.gender.trim()) {
      patch.gender = body.gender.trim();
    }
    const { data, error } = await resolved.userClient
      .from("profiles")
      .update(patch)
      .eq("id", resolved.profile.id)
      .select("birthday, gender")
      .single();
    if (error) {
      sendJson(req, res, 400, { status: "error", message: error.message, data: null });
      return true;
    }
    sendJson(req, res, 200, { status: "success", message: "OK", data }, cookieHeaders(resolved));
    return true;
  }

  if (pathname === "/api/user/selected-item" && method === "PUT") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const body = await parseJsonBody(req);
    if (!body) {
      sendJson(req, res, 400, { status: "error", message: "Invalid JSON body", data: null });
      return true;
    }
    const itemType = String(body.selected_item_type || "");
    const itemId = String(body.selected_item_id || "");
    let value = null;
    if (itemId) {
      const { data: row } = await resolved.userClient
        .from("purchased_items")
        .select("item")
        .eq("user_id", resolved.profile.id)
        .eq("item_id", itemId)
        .maybeSingle();
      value = row?.item
        ? {
            _id: itemId,
            image_url: row.item.imageUrl || row.item.image_url || body.image_url || "",
            name: row.item.name || ""
          }
        : { _id: itemId, image_url: body.image_url || "" };
    }
    const columnMap = {
      avatar_frame: "selected_avatar_frame",
      background: "selected_background",
      name_color: "selected_name_color",
      badge: "selected_badge"
    };
    const column = columnMap[itemType];
    if (!column) {
      sendJson(req, res, 400, { status: "error", message: "Invalid item type", data: null });
      return true;
    }
    const { data, error } = await resolved.userClient
      .from("profiles")
      .update({ [column]: value, updated_at: new Date().toISOString() })
      .eq("id", resolved.profile.id)
      .select("*")
      .single();
    if (error) {
      sendJson(req, res, 400, { status: "error", message: error.message, data: null });
      return true;
    }
    sendJson(
      req,
      res,
      200,
      { status: "success", message: "OK", data: { user: toUserInfo(normalizeProfileRow(data)) } },
      cookieHeaders(resolved)
    );
    return true;
  }

  if (pathname === "/api/user/stats" && method === "GET") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    sendJson(req, res, 200, { status: "success", message: "OK", data: resolved.profile.stats }, cookieHeaders(resolved));
    return true;
  }

  if (pathname.startsWith("/api/user/stats/") && method === "GET") {
    const targetId = decodeURIComponent(pathname.slice("/api/user/stats/".length));
    const target = await lookupPublicProfile(targetId);
    if (!target) {
      sendJson(req, res, 404, { status: "error", message: "User not found", data: null });
      return true;
    }
    sendJson(req, res, 200, { status: "success", message: "OK", data: target.stats });
    return true;
  }

  if (pathname === "/api/user/ranking-history" && method === "GET") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    sendJson(req, res, 200, { status: "success", message: "OK", data: resolved.profile.ranking_history || [] }, cookieHeaders(resolved));
    return true;
  }

  if (pathname.startsWith("/api/user/ranking-history/") && method === "GET") {
    const targetId = decodeURIComponent(pathname.slice("/api/user/ranking-history/".length));
    const target = await lookupPublicProfile(targetId);
    sendJson(req, res, 200, { status: "success", message: "OK", data: target ? target.ranking_history || [] : [] });
    return true;
  }

  if (pathname === "/api/user/lesson-progress" && method === "GET") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    sendJson(
      req,
      res,
      200,
      { status: "success", message: "OK", data: { lesson_progress: resolved.profile.lesson_progress } },
      cookieHeaders(resolved)
    );
    return true;
  }

  if (pathname === "/api/user/lesson-progress" && method === "POST") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const body = await parseJsonBody(req);
    const lessonIds = Array.isArray(body?.lessonIds) ? body.lessonIds : null;
    const lp = resolved.profile.lesson_progress || { completed: [], in_progress: [] };
    sendJson(
      req,
      res,
      200,
      { status: "success", message: "OK", data: { lesson_progress: buildLessonProgressArray(lp, lessonIds) } },
      cookieHeaders(resolved)
    );
    return true;
  }

  if (pathname.startsWith("/api/user/lesson-progress/") && method === "GET") {
    const targetId = decodeURIComponent(pathname.slice("/api/user/lesson-progress/".length));
    const target = await lookupPublicProfile(targetId);
    sendJson(req, res, 200, {
      status: "success",
      message: "OK",
      data: {
        lesson_progress: target ? target.lesson_progress : { completed: [], in_progress: [] }
      }
    });
    return true;
  }

  if (pathname.startsWith("/api/user/completed-sentences/") && method === "GET") {
    const lessonId = decodeURIComponent(pathname.slice("/api/user/completed-sentences/".length));
    const resolved = await resolveSession(req);
    const items = resolved?.profile?.completed_sentences?.[lessonId] || [];
    sendJson(req, res, 200, { status: "success", message: "OK", data: items }, cookieHeaders(resolved));
    return true;
  }

  if (pathname === "/api/lessons/progress" && method === "GET") {
    const resolved = await resolveSession(req);
    const topicId = url.searchParams.get("topic_id");
    const lp = resolved?.profile?.lesson_progress || { completed: [], in_progress: [] };
    if (!topicId) {
      sendJson(req, res, 200, { status: "success", message: "OK", data: lp }, cookieHeaders(resolved));
      return true;
    }
    const byTopic = (list) =>
      (list || []).filter((item) => String(item?.lesson_id?.topic_id || item?.topic_id || "") === topicId);
    sendJson(
      req,
      res,
      200,
      {
        status: "success",
        message: "OK",
        data: {
          in_progress: byTopic(lp.in_progress),
          completed: byTopic(lp.completed)
        }
      },
      cookieHeaders(resolved)
    );
    return true;
  }

  if ((pathname === "/api/user/vocabulary-review" || pathname === "/api/user/vocabulary-reviews") && method === "GET") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = Math.max(1, Number(url.searchParams.get("limit") || 20));
    const start = (page - 1) * limit;
    const { data, count, error } = await resolved.userClient
      .from("vocabulary_reviews")
      .select("*", { count: "exact" })
      .eq("user_id", resolved.profile.id)
      .order("created_at", { ascending: false })
      .range(start, start + limit - 1);
    if (error) {
      sendJson(req, res, 500, { status: "error", message: error.message, data: null });
      return true;
    }
    const total = count || 0;
    const words = (data || []).map((row) => ({
      ...(row.payload || {}),
      _id: row.id,
      word: row.word || row.payload?.word || "",
      createdAt: row.created_at
    }));
    sendJson(
      req,
      res,
      200,
      {
        status: "success",
        message: "OK",
        data: {
          words,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit))
          }
        }
      },
      cookieHeaders(resolved)
    );
    return true;
  }

  if (pathname === "/api/user/vocabulary-review" && method === "POST") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const body = await parseJsonBody(req);
    if (!body) {
      sendJson(req, res, 400, { status: "error", message: "Invalid JSON body", data: null });
      return true;
    }
    const id = "vr_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const word = body.word || body.dictionary?.word || body.vocabularyCard?.word || "";
    const { data, error } = await resolved.userClient
      .from("vocabulary_reviews")
      .insert({
        id,
        user_id: resolved.profile.id,
        word,
        payload: body
      })
      .select("*")
      .single();
    if (error) {
      sendJson(req, res, 400, { status: "error", message: error.message, data: null });
      return true;
    }
    sendJson(
      req,
      res,
      200,
      {
        status: "success",
        message: "Added",
        data: { ...(data.payload || {}), _id: data.id, word: data.word, createdAt: data.created_at }
      },
      cookieHeaders(resolved)
    );
    return true;
  }

  if (pathname.startsWith("/api/user/vocabulary-review/") && method === "DELETE") {
    const targetId = decodeURIComponent(pathname.slice("/api/user/vocabulary-review/".length));
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const { error } = await resolved.userClient
      .from("vocabulary_reviews")
      .delete()
      .eq("id", targetId)
      .eq("user_id", resolved.profile.id);
    if (error) {
      sendJson(req, res, 400, { status: "error", message: error.message, data: null });
      return true;
    }
    sendJson(req, res, 200, { status: "success", message: "Deleted", data: { deleted: true, _id: targetId } }, cookieHeaders(resolved));
    return true;
  }

  if (pathname === "/api/user/vocabulary/decks" && method === "GET") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const { data, error } = await resolved.userClient
      .from("vocabulary_decks")
      .select("*")
      .eq("user_id", resolved.profile.id)
      .order("created_at", { ascending: false });
    if (error) {
      sendJson(req, res, 500, { status: "error", message: error.message, data: null });
      return true;
    }
    const decks = (data || []).map((row) => ({
      _id: row.id,
      name: row.name,
      description: row.description,
      is_public: row.is_public,
      groups: row.groups || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    sendJson(req, res, 200, { status: "success", message: "OK", data: { decks, items: decks } }, cookieHeaders(resolved));
    return true;
  }

  if (pathname === "/api/user/vocabulary/decks" && method === "POST") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const body = await parseJsonBody(req);
    if (!body) {
      sendJson(req, res, 400, { status: "error", message: "Invalid JSON body", data: null });
      return true;
    }
    const id = "deck_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const { data, error } = await resolved.userClient
      .from("vocabulary_decks")
      .insert({
        id,
        user_id: resolved.profile.id,
        name: body.name || "Untitled Deck",
        description: body.description || "",
        is_public: false,
        groups: []
      })
      .select("*")
      .single();
    if (error) {
      sendJson(req, res, 400, { status: "error", message: error.message, data: null });
      return true;
    }
    const deck = {
      _id: data.id,
      name: data.name,
      description: data.description,
      is_public: data.is_public,
      groups: data.groups || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
    sendJson(req, res, 200, { status: "success", message: "Created", data: deck }, cookieHeaders(resolved));
    return true;
  }

  if (pathname.startsWith("/api/user/vocabulary/")) {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    sendJson(req, res, 200, { status: "success", message: "OK", data: method === "GET" ? [] : {} }, cookieHeaders(resolved));
    return true;
  }

  if (pathname === "/api/wallet" && method === "GET") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    sendJson(
      req,
      res,
      200,
      {
        status: "success",
        message: "OK",
        data: {
          diamonds: resolved.profile.diamonds || 0,
          freeze_count: resolved.profile.freeze_count || 0
        }
      },
      cookieHeaders(resolved)
    );
    return true;
  }

  if ((pathname === "/api/streak" || pathname === "/api/streak/state") && method === "GET") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const tz = getTimezone(req, null);
    sendJson(req, res, 200, { status: "success", message: "OK", data: buildStreakState(resolved.profile, tz) }, cookieHeaders(resolved));
    return true;
  }

  if (pathname === "/api/streak/checkin" && method === "POST") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const body = await parseJsonBody(req);
    const tz = getTimezone(req, body);
    const profile = resolved.profile;
    const todayStr = isoDateInTimezone(tz);
    const alreadyCheckedIn =
      profile.last_streak_day === todayStr ||
      (Array.isArray(profile.checkin_dates) && profile.checkin_dates.includes(todayStr));

    if (alreadyCheckedIn) {
      sendJson(
        req,
        res,
        200,
        {
          status: "success",
          message: "Already checked in today",
          data: {
            already_counted_today: true,
            daily_reward_diamonds: 0,
            freeze_used: false,
            milestone_reached: null,
            ...buildStreakState(profile, tz),
            diamonds: profile.diamonds
          }
        },
        cookieHeaders(resolved)
      );
      return true;
    }

    const yesterdayStr = isoDateInTimezone(tz, -1);
    const prevYesterdayStr = isoDateInTimezone(tz, -2);
    let freezeUsed = false;
    let currentStreak = profile.current_streak || 0;
    let freezeCount = profile.freeze_count || 0;

    if (profile.last_streak_day === yesterdayStr) {
      currentStreak += 1;
    } else if (profile.last_streak_day === prevYesterdayStr && freezeCount > 0) {
      freezeCount -= 1;
      currentStreak += 1;
      freezeUsed = true;
    } else {
      currentStreak = 1;
    }

    const longestStreak = Math.max(profile.longest_streak || 0, currentStreak);
    const checkinDates = Array.isArray(profile.checkin_dates) ? [...profile.checkin_dates] : [];
    if (!checkinDates.includes(todayStr)) checkinDates.push(todayStr);

    const claimedMilestones = Array.isArray(profile.claimed_streak_milestones)
      ? [...profile.claimed_streak_milestones]
      : [];
    let bonusDiamonds = 0;
    const milestone = STREAK_MILESTONES_CONFIG.find((m) => m.days === currentStreak) || null;
    if (milestone && !claimedMilestones.includes(milestone.days)) {
      claimedMilestones.push(milestone.days);
      bonusDiamonds += milestone.diamonds || 0;
      if (milestone.freeze_gift) {
        freezeCount = Math.min(FREEZE_MAX_OWNED, freezeCount + milestone.freeze_gift);
      }
    }

    const newDiamonds = (profile.diamonds || 0) + DAILY_CHECKIN_REWARD + bonusDiamonds;
    const nowMs = Date.now();
    const { data: updated, error } = await resolved.userClient
      .from("profiles")
      .update({
        current_streak: currentStreak,
        longest_streak: longestStreak,
        freeze_count: freezeCount,
        last_streak_day: todayStr,
        last_streak_date: nowMs,
        checkin_dates: checkinDates,
        claimed_streak_milestones: claimedMilestones,
        diamonds: newDiamonds,
        updated_at: new Date(nowMs).toISOString()
      })
      .eq("id", profile.id)
      .select("*")
      .single();

    if (error) {
      sendJson(req, res, 400, { status: "error", message: error.message, data: null });
      return true;
    }
    const nextProfile = normalizeProfileRow(updated);
    sendJson(
      req,
      res,
      200,
      {
        status: "success",
        message: "Check-in successful",
        data: {
          already_counted_today: false,
          daily_reward_diamonds: DAILY_CHECKIN_REWARD,
          freeze_used: freezeUsed,
          milestone_reached: milestone,
          ...buildStreakState(nextProfile, tz),
          diamonds: nextProfile.diamonds
        }
      },
      cookieHeaders(resolved)
    );
    return true;
  }

  if (pathname === "/api/streak/freeze/buy" && method === "POST") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const body = await parseJsonBody(req);
    const count = Math.max(1, Number(body?.count || 1));
    const profile = resolved.profile;
    const cost = count * FREEZE_PRICE_DIAMOND;
    if ((profile.freeze_count || 0) + count > FREEZE_MAX_OWNED) {
      sendJson(req, res, 400, { status: "error", message: "Maximum freeze count reached", data: null });
      return true;
    }
    if ((profile.diamonds || 0) < cost) {
      sendJson(req, res, 400, { status: "error", message: "Insufficient diamonds", data: null });
      return true;
    }
    const newDiamonds = profile.diamonds - cost;
    const newFreeze = (profile.freeze_count || 0) + count;
    const { error } = await resolved.userClient
      .from("profiles")
      .update({
        diamonds: newDiamonds,
        freeze_count: newFreeze,
        updated_at: new Date().toISOString()
      })
      .eq("id", profile.id);
    if (error) {
      sendJson(req, res, 400, { status: "error", message: error.message, data: null });
      return true;
    }
    sendJson(
      req,
      res,
      200,
      { status: "success", message: "Freeze purchased", data: { diamonds: newDiamonds, freeze_count: newFreeze } },
      cookieHeaders(resolved)
    );
    return true;
  }

  if (pathname === "/api/streak/calendar" && method === "GET") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const dates = (resolved.profile.checkin_dates || []).filter((d) => (!from || d >= from) && (!to || d <= to));
    sendJson(req, res, 200, { status: "success", message: "OK", data: { dates, checkin_dates: dates } }, cookieHeaders(resolved));
    return true;
  }

  if (pathname === "/api/streak/milestones" && method === "GET") {
    const resolved = await resolveSession(req);
    const claimed = new Set(resolved?.profile?.claimed_streak_milestones || []);
    const current = resolved?.profile?.current_streak || 0;
    sendJson(
      req,
      res,
      200,
      {
        status: "success",
        message: "OK",
        data: STREAK_MILESTONES_CONFIG.map((m) => ({
          ...m,
          reached: current >= m.days,
          claimed: claimed.has(m.days)
        }))
      },
      cookieHeaders(resolved)
    );
    return true;
  }

  if (/^\/api\/streak\/milestones\/\d+\/claim$/.test(pathname) && method === "POST") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const days = Number(pathname.split("/")[4]);
    const milestone = STREAK_MILESTONES_CONFIG.find((m) => m.days === days);
    if (!milestone) {
      sendJson(req, res, 404, { status: "error", message: "Milestone not found", data: null });
      return true;
    }
    const profile = resolved.profile;
    const claimed = Array.isArray(profile.claimed_streak_milestones) ? [...profile.claimed_streak_milestones] : [];
    let diamonds = profile.diamonds || 0;
    let freezeCount = profile.freeze_count || 0;
    if (!claimed.includes(days)) {
      claimed.push(days);
      diamonds += milestone.diamonds || 0;
      if (milestone.freeze_gift) {
        freezeCount = Math.min(FREEZE_MAX_OWNED, freezeCount + milestone.freeze_gift);
      }
      await resolved.userClient
        .from("profiles")
        .update({
          claimed_streak_milestones: claimed,
          diamonds,
          freeze_count: freezeCount,
          updated_at: new Date().toISOString()
        })
        .eq("id", profile.id);
    }
    sendJson(req, res, 200, { status: "success", message: "Claimed", data: { diamonds, freeze_count: freezeCount, milestone } }, cookieHeaders(resolved));
    return true;
  }

  if (pathname === "/api/level" && method === "GET") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    sendJson(req, res, 200, { status: "success", message: "OK", data: buildLevelState(resolved.profile) }, cookieHeaders(resolved));
    return true;
  }

  if (pathname === "/api/level/config" && method === "GET") {
    sendJson(req, res, 200, { status: "success", message: "OK", data: { levels: LEVEL_MILESTONES_CONFIG } });
    return true;
  }

  if (pathname === "/api/level/milestones" && method === "GET") {
    const resolved = await resolveSession(req);
    const claimed = new Set(resolved?.profile?.claimed_level_milestones || []);
    const level = resolved?.profile?.level || 1;
    sendJson(
      req,
      res,
      200,
      {
        status: "success",
        message: "OK",
        data: LEVEL_MILESTONES_CONFIG.map((m) => ({
          ...m,
          reached: level >= m.level,
          claimed: claimed.has(m.level)
        }))
      },
      cookieHeaders(resolved)
    );
    return true;
  }

  if (/^\/api\/level\/milestones\/\d+\/claim$/.test(pathname) && method === "POST") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const lv = Number(pathname.split("/")[4]);
    const milestone = LEVEL_MILESTONES_CONFIG.find((m) => m.level === lv);
    if (!milestone) {
      sendJson(req, res, 404, { status: "error", message: "Milestone not found", data: null });
      return true;
    }
    const profile = resolved.profile;
    const claimed = Array.isArray(profile.claimed_level_milestones) ? [...profile.claimed_level_milestones] : [];
    let diamonds = profile.diamonds || 0;
    if (!claimed.includes(lv)) {
      claimed.push(lv);
      diamonds += milestone.reward_diamonds || 0;
      await resolved.userClient
        .from("profiles")
        .update({
          claimed_level_milestones: claimed,
          diamonds,
          updated_at: new Date().toISOString()
        })
        .eq("id", profile.id);
    }
    sendJson(req, res, 200, { status: "success", message: "Claimed", data: { diamonds, milestone } }, cookieHeaders(resolved));
    return true;
  }

  if (pathname === "/api/missions/today" && method === "GET") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const todayStr = isoDateInTimezone(getTimezone(req, null));
    let missions = resolved.profile.missions;
    if (!isValidMissionsPayload(missions, todayStr)) {
      missions = createDefaultMissions(todayStr);
      await resolved.userClient
        .from("profiles")
        .update({ missions, updated_at: new Date().toISOString() })
        .eq("id", resolved.profile.id);
    }
    sendJson(
      req,
      res,
      200,
      {
        status: "success",
        message: "OK",
        data: { date: missions.date, missions: missions.items }
      },
      cookieHeaders(resolved)
    );
    return true;
  }

  if (/^\/api\/missions\/(shadowing|vocabulary|dictation)\/submit$/.test(pathname) && method === "POST") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const missionType = pathname.split("/")[3];
    const todayStr = isoDateInTimezone(getTimezone(req, null));
    const missions = isValidMissionsPayload(resolved.profile.missions, todayStr)
      ? resolved.profile.missions
      : createDefaultMissions(todayStr);
    const items = missions.items.map((item) => {
      if (item.type !== missionType) return item;
      const nextStatus = item.status === "claimed" ? "claimed" : "completed";
      return {
        ...item,
        status: nextStatus,
        attempts: typeof item.attempts === "number" ? item.attempts + 1 : item.attempts
      };
    });
    const nextMissions = { date: todayStr, items };
    await resolved.userClient
      .from("profiles")
      .update({ missions: nextMissions, updated_at: new Date().toISOString() })
      .eq("id", resolved.profile.id);
    const updatedMission = items.find((item) => item.type === missionType) || null;
    sendJson(req, res, 200, { status: "success", message: "OK", data: { mission: updatedMission } }, cookieHeaders(resolved));
    return true;
  }

  if (/^\/api\/missions\/(shadowing|vocabulary|dictation)\/claim$/.test(pathname) && method === "POST") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const missionType = pathname.split("/")[3];
    const todayStr = isoDateInTimezone(getTimezone(req, null));
    const missions = isValidMissionsPayload(resolved.profile.missions, todayStr)
      ? resolved.profile.missions
      : createDefaultMissions(todayStr);
    const current = missions.items.find((item) => item.type === missionType);
    if (!current) {
      sendJson(req, res, 404, { status: "error", message: "Mission not found", data: null });
      return true;
    }
    if (current.status === "claimed") {
      sendJson(req, res, 400, { status: "error", message: "mission_already_claimed", data: null });
      return true;
    }
    const reward = Number(current.reward_diamonds || 30);
    const newDiamonds = (resolved.profile.diamonds || 0) + reward;
    const items = missions.items.map((item) => (item.type === missionType ? { ...item, status: "claimed" } : item));
    const nextMissions = { date: todayStr, items };
    await resolved.userClient
      .from("profiles")
      .update({
        missions: nextMissions,
        diamonds: newDiamonds,
        updated_at: new Date().toISOString()
      })
      .eq("id", resolved.profile.id);
    const updatedMission = items.find((item) => item.type === missionType);
    sendJson(
      req,
      res,
      200,
      { status: "success", message: "Claimed", data: { diamonds_granted: reward, diamonds: newDiamonds, mission: updatedMission } },
      cookieHeaders(resolved)
    );
    return true;
  }

  if (pathname === "/api/notifications/stats" && method === "GET") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const { count } = await resolved.userClient
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", resolved.profile.id)
      .eq("is_read", false);
    sendJson(req, res, 200, { status: "success", message: "OK", data: { total_unread: count || 0 } }, cookieHeaders(resolved));
    return true;
  }

  if (pathname === "/api/notifications" && method === "GET") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = Math.max(1, Number(url.searchParams.get("limit") || 5));
    const start = (page - 1) * limit;
    const { data } = await resolved.userClient
      .from("notifications")
      .select("*")
      .eq("user_id", resolved.profile.id)
      .order("created_at", { ascending: false })
      .range(start, start + limit - 1);
    const list = (data || []).map((n) => ({
      ...(n.payload || {}),
      _id: n.id,
      type: n.type,
      read: n.is_read,
      createdAt: n.created_at
    }));
    sendJson(req, res, 200, { status: "success", message: "OK", data: list }, cookieHeaders(resolved));
    return true;
  }

  if (pathname === "/api/notifications/read-all" && method === "DELETE") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    await resolved.userClient.from("notifications").delete().eq("user_id", resolved.profile.id);
    sendJson(req, res, 200, { status: "success", message: "Cleared", data: null }, cookieHeaders(resolved));
    return true;
  }

  if (pathname.startsWith("/api/notifications/") && method === "DELETE") {
    const notifId = decodeURIComponent(pathname.slice("/api/notifications/".length));
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    await resolved.userClient
      .from("notifications")
      .delete()
      .eq("id", notifId)
      .eq("user_id", resolved.profile.id);
    sendJson(req, res, 200, { status: "success", message: "Deleted", data: null }, cookieHeaders(resolved));
    return true;
  }

  if (pathname === "/api/learning-time/start" && method === "POST") {
    const resolved = await resolveSession(req);
    const sessionId = "lt_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    if (resolved) {
      const nextSessions = {
        ...(resolved.profile.learning_sessions || { total_seconds: 0 }),
        active_session_id: sessionId,
        last_heartbeat: Date.now()
      };
      await resolved.userClient
        .from("profiles")
        .update({ learning_sessions: nextSessions, updated_at: new Date().toISOString() })
        .eq("id", resolved.profile.id);
    }
    sendJson(req, res, 200, { status: "success", message: "OK", data: { session_id: sessionId } }, cookieHeaders(resolved));
    return true;
  }

  if (pathname === "/api/learning-time/heartbeat" && method === "POST") {
    const resolved = await resolveSession(req);
    if (resolved) {
      const now = Date.now();
      const ls = resolved.profile.learning_sessions || { total_seconds: 0, active_session_id: null, last_heartbeat: now };
      const prev = ls.last_heartbeat || now;
      const delta = Math.max(0, Math.min(300, Math.round((now - prev) / 1000)));
      const totalSeconds = (ls.total_seconds || 0) + delta;
      const nextSessions = { ...ls, total_seconds: totalSeconds, last_heartbeat: now };
      const nextStats = {
        ...resolved.profile.stats,
        overall_stats: {
          ...(resolved.profile.stats?.overall_stats || {}),
          total_time: totalSeconds
        }
      };
      await resolved.userClient
        .from("profiles")
        .update({ learning_sessions: nextSessions, stats: nextStats, updated_at: new Date(now).toISOString() })
        .eq("id", resolved.profile.id);
    }
    sendJson(req, res, 200, { status: "success", message: "OK", data: { ok: true } }, cookieHeaders(resolved));
    return true;
  }

  if (pathname === "/api/learning-time/end" && method === "POST") {
    const resolved = await resolveSession(req);
    if (resolved) {
      const nextSessions = {
        ...(resolved.profile.learning_sessions || { total_seconds: 0 }),
        active_session_id: null
      };
      await resolved.userClient
        .from("profiles")
        .update({ learning_sessions: nextSessions, updated_at: new Date().toISOString() })
        .eq("id", resolved.profile.id);
    }
    sendJson(req, res, 200, { status: "success", message: "OK", data: { ended: true } }, cookieHeaders(resolved));
    return true;
  }

  if (pathname.startsWith("/api/sentences/review") && method === "GET") {
    if (pathname.endsWith("/count")) {
      sendJson(req, res, 200, { status: "success", message: "OK", data: { count: 0 } });
      return true;
    }
    sendJson(req, res, 200, {
      status: "success",
      message: "OK",
      data: {
        total_count: 0,
        normal_sentences: [],
        shadowing_sentences: []
      }
    });
    return true;
  }

  if (pathname === "/api/learning-vocabulary/stats" && method === "GET") {
    sendJson(req, res, 200, {
      status: "success",
      message: "OK",
      data: {
        total_cards: 0,
        new_cards: 0,
        learning_cards: 0,
        reviewing_cards: 0,
        review_cards: 0,
        mastered_cards: 0,
        due_cards: 0,
        due_today: 0,
        total_reviews: 0,
        accuracy: 0,
        today_learned: 0,
        today_reviewed: 0,
        streak_days: 0
      }
    });
    return true;
  }

  if (pathname === "/api/learning-vocabulary/session/current" && method === "GET") {
    sendJson(req, res, 200, {
      status: "success",
      message: "OK",
      data: null
    });
    return true;
  }

  if (pathname === "/api/learning-vocabulary/session/history" && method === "GET") {
    sendJson(req, res, 200, {
      status: "success",
      message: "OK",
      data: { sessions: [] }
    });
    return true;
  }

  if (pathname.startsWith("/api/learning-vocabulary/groups-progress/") && method === "GET") {
    sendJson(req, res, 200, {
      status: "success",
      message: "OK",
      data: { groups: [] }
    });
    return true;
  }

  if ((pathname === "/api/learning-vocabulary/cards/new" || pathname === "/api/learning-vocabulary/cards" || pathname === "/api/learning-vocabulary/enc/new") && method === "GET") {
    sendJson(req, res, 200, {
      status: "success",
      message: "OK",
      data: { cards: [], words: [], items: [], total: 0, pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } }
    });
    return true;
  }

  if ((pathname === "/api/learning-vocabulary/cards/due" || pathname === "/api/learning-vocabulary/enc/due") && method === "GET") {
    sendJson(req, res, 200, {
      status: "success",
      message: "OK",
      data: { cards: [], total: 0, items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } }
    });
    return true;
  }

  if (pathname === "/api/learning-vocabulary/session/start" && method === "POST") {
    sendJson(req, res, 200, {
      status: "success",
      message: "OK",
      data: { session: { _id: "session_default", cards: [], status: "completed" } }
    });
    return true;
  }

  if (pathname === "/api/learning-vocabulary/submit" && method === "POST") {
    sendJson(req, res, 200, {
      status: "success",
      message: "OK",
      data: { success: true }
    });
    return true;
  }

  if (pathname === "/api/sentence-notes") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    if (method === "GET") {
      const lessonId = url.searchParams.get("lesson_id");
      let query = resolved.userClient
        .from("sentence_notes")
        .select("*")
        .eq("user_id", resolved.profile.id)
        .order("created_at", { ascending: false });
      if (lessonId) query = query.eq("lesson_id", lessonId);
      const { data } = await query;
      const notes = (data || []).map((n) => ({
        ...(n.payload || {}),
        _id: n.id,
        lesson_id: n.lesson_id,
        createdAt: n.created_at,
        updatedAt: n.updated_at
      }));
      sendJson(req, res, 200, { status: "success", message: "OK", data: notes }, cookieHeaders(resolved));
      return true;
    }
    if (method === "POST") {
      const body = await parseJsonBody(req);
      if (!body) {
        sendJson(req, res, 400, { status: "error", message: "Invalid JSON body", data: null });
        return true;
      }
      const id = "note_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const { data, error } = await resolved.userClient
        .from("sentence_notes")
        .insert({
          id,
          user_id: resolved.profile.id,
          lesson_id: body.lesson_id || null,
          payload: body
        })
        .select("*")
        .single();
      if (error) {
        sendJson(req, res, 400, { status: "error", message: error.message, data: null });
        return true;
      }
      sendJson(
        req,
        res,
        200,
        {
          status: "success",
          message: "Saved",
          data: { ...(data.payload || {}), _id: data.id, createdAt: data.created_at, updatedAt: data.updated_at }
        },
        cookieHeaders(resolved)
      );
      return true;
    }
  }

  if (pathname.startsWith("/api/sentence-notes/")) {
    const noteId = decodeURIComponent(pathname.slice("/api/sentence-notes/".length));
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    if (method === "PUT") {
      const body = await parseJsonBody(req);
      const { data: existing } = await resolved.userClient
        .from("sentence_notes")
        .select("*")
        .eq("id", noteId)
        .eq("user_id", resolved.profile.id)
        .maybeSingle();
      if (!existing) {
        sendJson(req, res, 404, { status: "error", message: "Note not found", data: null });
        return true;
      }
      const mergedPayload = { ...(existing.payload || {}), ...(body || {}) };
      const { data, error } = await resolved.userClient
        .from("sentence_notes")
        .update({ payload: mergedPayload, updated_at: new Date().toISOString() })
        .eq("id", noteId)
        .eq("user_id", resolved.profile.id)
        .select("*")
        .single();
      if (error) {
        sendJson(req, res, 400, { status: "error", message: error.message, data: null });
        return true;
      }
      sendJson(
        req,
        res,
        200,
        {
          status: "success",
          message: "Updated",
          data: { ...(data.payload || {}), _id: data.id, createdAt: data.created_at, updatedAt: data.updated_at }
        },
        cookieHeaders(resolved)
      );
      return true;
    }
    if (method === "DELETE") {
      await resolved.userClient
        .from("sentence_notes")
        .delete()
        .eq("id", noteId)
        .eq("user_id", resolved.profile.id);
      sendJson(req, res, 200, { status: "success", message: "Deleted", data: null }, cookieHeaders(resolved));
      return true;
    }
  }

  if (pathname === "/api/private-chat/unread-count" && method === "GET") {
    sendJson(req, res, 200, { status: "success", message: "OK", data: { count: 0, unread_count: 0 } });
    return true;
  }

  if (pathname === "/api/private-chat/conversations" && method === "GET") {
    sendJson(req, res, 200, {
      status: "success",
      message: "OK",
      data: [],
      pagination: { current_page: 1, total_pages: 1, total: 0 }
    });
    return true;
  }

  if (pathname === "/api/private-chat/block" && method === "GET") {
    sendJson(req, res, 200, { status: "success", message: "OK", data: [] });
    return true;
  }

  if (pathname === "/api/community-lessons/quota" && method === "GET") {
    sendJson(req, res, 200, {
      status: "success",
      message: "OK",
      data: {
        used: 0,
        limit: 999,
        remaining: 999,
        resets_at: new Date(Date.now() + 86400000).toISOString()
      }
    });
    return true;
  }

  if (pathname === "/api/community-stats/my-stats" && method === "GET") {
    sendJson(req, res, 200, {
      status: "success",
      message: "OK",
      data: {
        total_posts_created: 0,
        total_comments_created: 0,
        total_votes_received: 0
      }
    });
    return true;
  }

  if (pathname === "/api/shop/items/purchased" && method === "GET") {
    const resolved = await resolveSession(req);
    if (!resolved) {
      sendJson(req, res, 200, { status: "success", message: "OK", data: [] });
      return true;
    }
    const { data } = await resolved.userClient
      .from("purchased_items")
      .select("*")
      .eq("user_id", resolved.profile.id)
      .order("created_at", { ascending: false });
    sendJson(req, res, 200, { status: "success", message: "OK", data: (data || []).map(formatPurchasedEntry) }, cookieHeaders(resolved));
    return true;
  }

  if (pathname === "/api/shop/items/purchased/by-type" && method === "GET") {
    const resolved = await resolveSession(req);
    if (!resolved) {
      sendJson(req, res, 200, {
        status: "success",
        message: "OK",
        data: { avatar_frame: [], background: [], name_color: [], badge: [] }
      });
      return true;
    }
    const { data } = await resolved.userClient
      .from("purchased_items")
      .select("*")
      .eq("user_id", resolved.profile.id)
      .order("created_at", { ascending: false });
    const entries = (data || []).map(formatPurchasedEntry);
    sendJson(
      req,
      res,
      200,
      {
        status: "success",
        message: "OK",
        data: {
          avatar_frame: entries.filter((it) => it.item?.type === "avatar_frame"),
          background: entries.filter((it) => it.item?.type === "background"),
          name_color: entries.filter((it) => it.item?.type === "name_color"),
          badge: entries.filter((it) => it.item?.type === "badge")
        }
      },
      cookieHeaders(resolved)
    );
    return true;
  }

  if (pathname === "/api/shop/items/purchase" && method === "POST") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const body = await parseJsonBody(req);
    const itemId = String(body?.itemId || "").trim();
    if (!itemId) {
      sendJson(req, res, 400, { status: "error", message: "itemId is required", data: null });
      return true;
    }
    const catalog = await loadShopCatalog(publicDir);
    const item = catalog.find((it) => it._id === itemId);
    if (!item) {
      sendJson(req, res, 404, { status: "error", message: "Item not found", data: null });
      return true;
    }
    const { data: existing } = await resolved.userClient
      .from("purchased_items")
      .select("id")
      .eq("user_id", resolved.profile.id)
      .eq("item_id", itemId)
      .maybeSingle();
    if (existing) {
      sendJson(req, res, 400, { status: "error", message: "Item already purchased", data: null });
      return true;
    }
    const price = getEffectiveItemPrice(item);
    if ((resolved.profile.diamonds || 0) < price) {
      sendJson(req, res, 400, { status: "error", message: "Insufficient diamonds", data: null });
      return true;
    }
    const newDiamonds = (resolved.profile.diamonds || 0) - price;
    const { error: balanceError } = await resolved.userClient
      .from("profiles")
      .update({ diamonds: newDiamonds, updated_at: new Date().toISOString() })
      .eq("id", resolved.profile.id);
    if (balanceError) {
      sendJson(req, res, 400, { status: "error", message: balanceError.message, data: null });
      return true;
    }
    const id = "pi_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const { data: inserted, error: insertError } = await resolved.userClient
      .from("purchased_items")
      .insert({
        id,
        user_id: resolved.profile.id,
        item_id: itemId,
        item_type: item.type || "avatar_frame",
        item,
        is_active: false
      })
      .select("*")
      .single();
    if (insertError) {
      sendJson(req, res, 400, { status: "error", message: insertError.message, data: null });
      return true;
    }
    sendJson(
      req,
      res,
      200,
      {
        status: "success",
        message: "Purchased",
        data: {
          purchased: formatPurchasedEntry(inserted),
          balance: { diamonds: newDiamonds }
        }
      },
      cookieHeaders(resolved)
    );
    return true;
  }

  if (/^\/api\/shop\/items\/purchased\/[^/]+\/toggle$/.test(pathname) && method === "PATCH") {
    const resolved = await requireAuth(req, res);
    if (!resolved) return true;
    const itemId = decodeURIComponent(pathname.split("/")[5]);
    const { data: target } = await resolved.userClient
      .from("purchased_items")
      .select("*")
      .eq("user_id", resolved.profile.id)
      .eq("item_id", itemId)
      .maybeSingle();
    if (!target) {
      sendJson(req, res, 404, { status: "error", message: "Purchased item not found", data: null });
      return true;
    }
    const nextActive = !target.is_active;
    if (nextActive) {
      await resolved.userClient
        .from("purchased_items")
        .update({ is_active: false })
        .eq("user_id", resolved.profile.id)
        .eq("item_type", target.item_type);
    }
    await resolved.userClient
      .from("purchased_items")
      .update({ is_active: nextActive })
      .eq("id", target.id)
      .eq("user_id", resolved.profile.id);

    const columnMap = {
      avatar_frame: "selected_avatar_frame",
      background: "selected_background",
      name_color: "selected_name_color",
      badge: "selected_badge"
    };
    const col = columnMap[target.item_type];
    if (col) {
      const value = nextActive
        ? {
            _id: target.item_id,
            image_url: target.item?.imageUrl || target.item?.image_url || "",
            name: target.item?.name || "",
            config: target.item?.properties?.config || target.item?.config || undefined
          }
        : null;
      const profileUpdate = { [col]: value, updated_at: new Date().toISOString() };
      if (target.item_type === "background") {
        profileUpdate.background_url = nextActive ? target.item?.imageUrl || target.item?.image_url || null : null;
      }
      await resolved.userClient.from("profiles").update(profileUpdate).eq("id", resolved.profile.id);
    }

    sendJson(req, res, 200, { status: "success", message: "Updated", data: { itemId, isActive: nextActive } }, cookieHeaders(resolved));
    return true;
  }

  return false;
}

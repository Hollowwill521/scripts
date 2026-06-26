WidgetMetadata = {
  id: "forward.zhizhen.baidu",
  title: "百度网盘",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  description: "搜索至臻[盘]影视资源，解析百度网盘分享并返回可播放源。",
  author: "TG@Hollowwill",
  site: "https://t.me/Hollowwill_Q",
  detailCacheDuration: 3600,
  globalParams: [
    { name: "baidu_cookie", title: "百度 Cookie", type: "input", value: "" }
  ],
  modules: [
    {
      id: "loadResource",
      title: "百度网盘",
      description: "按当前影片详情自动搜索至臻[盘]并返回百度网盘播放源",
      functionName: "loadResource",
      type: "stream",
      cacheDuration: 3600,
      params: []
    }
  ],
  search: {
    title: "搜索至臻[盘]",
    functionName: "search",
    params: [
      { name: "keyword", title: "关键词", type: "input", value: "" },
      { name: "page", title: "页码", type: "page", value: "1" }
    ]
  }
};

var ZZ_RUNTIME_PARAMS = {};
var ZZ_SEARCH_CACHE = {};
var ZZ_DETAIL_CACHE = {};
var ZZ_RESOURCE_CACHE = {};
var ZZ_RESOLVE_SCHEME = "zzresolve://";
var ZZ_PRIMARY_HOST = "https://www.miqk.cc";
var ZZ_DEFAULT_PAN_HOSTS = ["https://mihdr.top", "https://www.2xiaopan.top"];
var ZZ_BUILTIN_LOAD_SPEED_MODE = "fast";
var ZZ_BUILTIN_BAIDU_MAX_FILES = 2;
var ZZ_BUILTIN_SEARCH_EXTRA_AFTER_HIT = 3;
var ZZ_BUILTIN_CANDIDATE_SCAN_LIMIT = 40;
var ZZ_BUILTIN_QUALITY_TAG = "8k";
var ZZ_CACHE_TTL_MS = 3600 * 1000;
var ZZ_RESOURCE_SEARCH_TIMEOUT_MS = 6000;
var BAIDU_DIRECT_CONCURRENCY_FULL = 4;
var BAIDU_UID_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
var BAIDU_SHARE_CACHE = {};
var BAIDU_UID_CACHE = {};
var BAIDU_UID_PENDING_CACHE = {};
var BAIDU_VIDEO_LIST_CACHE = {};
var BAIDU_DIRECT_CACHE = {};
var BAIDU_UZ_DEVUID = "73CED981D0F186D12BC18CAE1684FFD5|VSRCQTF6W";

var ZZ_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
};

function zzText(v) {
  return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
}

function zzCacheGetWithTtl(cache, key, ttlMs) {
  var entry = cache && cache[key];
  if (!entry) return null;
  if (Date.now() - entry.time > ttlMs) {
    delete cache[key];
    return null;
  }
  return entry.value;
}

function zzCacheGet(cache, key) {
  return zzCacheGetWithTtl(cache, key, ZZ_CACHE_TTL_MS);
}

function zzCacheSet(cache, key, value) {
  cache[key] = { time: Date.now(), value: value };
  return value;
}

function zzStorageGet(key, ttlMs) {
  try {
    if (typeof Widget === "undefined" || !Widget.storage || typeof Widget.storage.get !== "function") return null;
    var raw = Widget.storage.get(key);
    if (!raw) return null;
    var entry = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!entry || typeof entry !== "object" || !entry.time) return null;
    if (Date.now() - Number(entry.time || 0) > ttlMs) return null;
    return entry.value == null ? null : entry.value;
  } catch (e) {
    return null;
  }
}

function zzStorageSet(key, value) {
  try {
    if (typeof Widget === "undefined" || !Widget.storage || typeof Widget.storage.set !== "function") return false;
    Widget.storage.set(key, JSON.stringify({ time: Date.now(), value: value }));
    return true;
  } catch (e) {
    return false;
  }
}

function zzHost(params) {
  return ZZ_PRIMARY_HOST;
}

function zzOrigin(url) {
  try {
    return new URL(String(url || "")).origin;
  } catch (e) {
    return "";
  }
}

function zzSplitHosts(text) {
  var out = [];
  String(text || "").split(/[,，\s]+/).forEach(function (host) {
    host = zzText(host).replace(/\/+$/, "");
    if (!host) return;
    if (!/^https?:\/\//i.test(host)) host = "https://" + host;
    if (out.indexOf(host) < 0) out.push(host);
  });
  return out;
}

function zzPanHosts(params) {
  var out = [];
  function add(host) {
    host = String(host || "").replace(/\/+$/, "");
    if (host && out.indexOf(host) < 0) out.push(host);
  }
  add(zzHost(params));
  for (var i = 0; i < ZZ_DEFAULT_PAN_HOSTS.length; i++) add(ZZ_DEFAULT_PAN_HOSTS[i]);
  return out;
}

function loadSpeedMode(params) {
  var value = ZZ_BUILTIN_LOAD_SPEED_MODE;
  return /^(full|complete|all|slow|off)$/i.test(value) ? "full" : "fast";
}

function fastLoadEnabled(params) {
  return loadSpeedMode(params) === "fast";
}

function fastResourceSearchEnabled(params) {
  return !!(params && params._zzResourceLoad);
}

function zzParamsForHost(params, host) {
  var next = Object.assign({}, params || {});
  next.host = String(host || "").replace(/\/+$/, "") || zzHost(params);
  return next;
}

function zzSyncParams(params) {
  params = params || {};
  for (var k in params) {
    if (Object.prototype.hasOwnProperty.call(params, k)) ZZ_RUNTIME_PARAMS[k] = params[k];
  }
  ensureEnvShim();
}

function ensureEnvShim() {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  if (!g.ENV) {
    g.ENV = {
      get: function (key) {
        return ZZ_RUNTIME_PARAMS[key] || "";
      }
    };
  }
}

function zzAbsUrl(url, params) {
  if (!url) return "";
  url = String(url);
  if (/^https?:\/\//i.test(url)) return url;
  if (url.indexOf("//") === 0) return "https:" + url;
  if (url.charAt(0) !== "/") url = "/" + url;
  return zzHost(params) + url;
}

function zzCleanTitle(title) {
  return zzText(title)
    .replace(/^立刻播放/, "")
    .replace(/^下载/, "")
    .replace(/\s*-\s*第\d+集$/, "")
    .replace(/第[一二三四五六七八九十0-9]+季/g, "")
    .replace(/\bS\d{1,2}\b/ig, "")
    .trim();
}

function zzNorm(text) {
  return zzCleanTitle(text).toLowerCase()
    .replace(/[\s·•・:：\-–—_!！?？.,，。、"'`~()（）\[\]【】]/g, "");
}

function zzYear(text) {
  var m = String(text || "").match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : "";
}

function zzToInt(v, defVal) {
  var n = parseInt(String(v == null ? "" : v).trim(), 10);
  return Number.isFinite(n) ? n : (defVal || 0);
}

function zzBoundInt(v, defVal, minVal, maxVal) {
  var n = zzToInt(v, defVal);
  if (minVal != null && n < minVal) n = minVal;
  if (maxVal != null && n > maxVal) n = maxVal;
  return n;
}

function zzSleep(ms) {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  var timer = g && g.setTimeout;
  if (typeof timer === "function") {
    return new Promise(function (resolve) { timer.call(g, resolve, ms || 0); });
  }
  var end = Date.now() + Math.max(0, ms || 0);
  while (Date.now() < end) {}
  return Promise.resolve();
}

function zzHttpTimeout(params, defVal) {
  return zzBoundInt(params && params._zzHttpTimeoutMs, defVal || 20000, 2000, 30000);
}

function zzSizeText(bytes) {
  var n = Number(bytes || 0);
  if (!n || !Number.isFinite(n)) return "";
  var units = ["B", "KB", "MB", "GB", "TB", "PB"];
  var i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n = n / 1024;
    i++;
  }
  return (i ? n.toFixed(2) : String(Math.round(n))) + " " + units[i];
}

function zzCompactSizeText(text) {
  return zzText(text).replace(/\s+(B|KB|MB|GB|TB|PB)$/i, "$1");
}

function zzExtractEpisode(text) {
  var s = String(text || "");
  var m = s.match(/第\s*(\d{1,4})\s*[集话期]/);
  if (m) return zzValidEpisodeNumber(m[1]);
  m = s.match(/\bS\d{1,2}E(\d{1,4})\b/i);
  if (m) return zzValidEpisodeNumber(m[1]);
  m = s.match(/\bEP?\s*(\d{1,4})\b/i);
  if (m) return zzValidEpisodeNumber(m[1]);
  var base = s.split(/[\\/]/).pop().replace(/\.(?:mp4|mkv|avi|mov|m4v|ts|m2ts|flv|wmv|webm|rmvb)$/i, "");
  m = base.match(/(?:^|[\s._\-\[\(])0*(\d{1,4})(?=$|[\s._\-\]\)集话期])/);
  if (m) return zzValidEpisodeNumber(m[1]);
  m = base.match(/(?:^|[\s._\-\[\(])0*(\d{1,4})x$/i);
  if (m) return zzValidEpisodeNumber(m[1]);
  m = base.match(/^0*(\d{1,4})x$/i);
  if (m) return zzValidEpisodeNumber(m[1]);
  m = base.match(/[\u4e00-\u9fa5][^\d]{0,12}0*(\d{1,4})(?=$|[^\d])/);
  if (m) return zzValidEpisodeNumber(m[1]);
  return 0;
}

function zzValidEpisodeNumber(v) {
  var n = zzToInt(v, 0);
  if (!n) return 0;
  if (n >= 1900 && n <= 2099) return 0;
  return n;
}

function zzWantedEpisode(params) {
  params = params || {};
  var keys = [
    "episode", "episodeNumber", "episode_number", "episodeNo", "episode_no",
    "episodeNum", "episode_num", "episodeIndex", "episode_index",
    "episodeSort", "episode_sort", "episodeOrder", "episode_order",
    "currentEpisode", "current_episode", "currentEp", "current_ep",
    "playEpisode", "play_episode", "playIndex", "play_index",
    "ep", "sort", "serial", "serialNumber", "serial_number"
  ];
  for (var i = 0; i < keys.length; i++) {
    var n = zzToInt(params[keys[i]], 0);
    if (n > 0) return n;
  }
  var textKeys = [
    "episodeName", "episodeTitle", "episode_name", "episode_title",
    "subtitle", "remark", "description", "name", "title",
    "link", "url", "videoUrl", "id"
  ];
  for (var ti = 0; ti < textKeys.length; ti++) {
    var ep = zzExtractEpisode(params[textKeys[ti]]);
    if (ep > 0) return ep;
  }
  return zzWantedEpisodeNested(params, 0);
}

function zzWantedEpisodeNested(value, depth) {
  if (!value || depth > 3) return 0;
  if (Array.isArray(value)) {
    for (var ai = 0; ai < value.length; ai++) {
      var arrEp = zzWantedEpisodeNested(value[ai], depth + 1);
      if (arrEp) return arrEp;
    }
    return 0;
  }
  if (typeof value !== "object") return 0;
  var numericKey = /(?:^|_)(?:episode|episodeNumber|episodeNo|episodeNum|episodeIndex|episodeSort|currentEpisode|playEpisode|ep|sort|serial|serialNumber)(?:$|_)/i;
  var textKey = /(?:episode|title|name|subtitle|remark|description|link|url|id)$/i;
  for (var k in value) {
    if (!Object.prototype.hasOwnProperty.call(value, k) || /cookie|token|header|auth|ut/i.test(k)) continue;
    var v = value[k];
    if (numericKey.test(k)) {
      var n = zzValidEpisodeNumber(v);
      if (n > 0) return n;
    }
    if (textKey.test(k) && typeof v !== "object") {
      var ep = zzExtractEpisode(v);
      if (ep > 0) return ep;
    }
  }
  var preferred = ["tmdbInfo", "mediaInfo", "item", "video", "currentItem", "episodeInfo", "selectedEpisode", "vod", "source", "context", "metadata"];
  for (var pi = 0; pi < preferred.length; pi++) {
    var child = value[preferred[pi]];
    var childEp = zzWantedEpisodeNested(child, depth + 1);
    if (childEp) return childEp;
  }
  return 0;
}

async function zzGetHtml(url, params) {
  var referer = zzOrigin(url) || zzHost(params);
  var resp = await Widget.http.get(url, {
    headers: Object.assign({}, ZZ_HEADERS, { Referer: referer + "/" }),
    timeout: zzHttpTimeout(params, 20000)
  });
  return String(resp && resp.data || "");
}

function zzSearchUrl(keyword, page, params) {
  return zzHost(params) + "/index.php/vod/search/page/" + (page || 1) + "/wd/" + encodeURIComponent(keyword) + ".html";
}

function zzIsMaintenanceHtml(html) {
  var head = String(html || "").slice(0, 6000);
  return /<title>\s*站点维护中\s*<\/title>/i.test(head)
    || /SITE UNDER MAINTENANCE/i.test(head)
    || /<h1[^>]*>\s*站点维护中\s*<\/h1>/i.test(head);
}

function zzParseSearch(html, params) {
  if (zzIsMaintenanceHtml(html)) return [];
  var $ = Widget.html.load(html);
  var out = [];
  var seen = {};
  $(".module-search-item, .module-items .module-item").each(function (_, el) {
    var card = $(el);
    var linkNode = card.find("h3 a[href*='/index.php/vod/detail/'], .module-item-title[href*='/index.php/vod/detail/'], a[href*='/index.php/vod/detail/']").first();
    var href = zzAbsUrl(linkNode.attr("href") || "", params);
    if (!href || seen[href]) return;
    var img = card.find("img").first();
    var title = zzCleanTitle(linkNode.attr("title") || linkNode.text() || img.attr("alt") || "");
    if (!title) return;
    var poster = zzAbsUrl(img.attr("data-src") || img.attr("data-original") || img.attr("src") || "", params);
    var remark = zzText(card.find(".video-serial, .module-item-text").first().text());
    var desc = zzText(card.find(".video-info-item, .module-item-style.video-text").last().text());
    seen[href] = true;
    out.push({
      id: href,
      type: "url",
      mediaType: "movie",
      title: title,
      posterPath: poster,
      backdropPath: poster,
      description: [remark, desc].filter(Boolean).join("\n"),
      link: href
    });
  });
  if (!out.length) {
    var blockRe = /<div[^>]+class=["'][^"']*module-search-item[^"']*["'][\s\S]*?(?=<div[^>]+class=["'][^"']*module-search-item[^"']*["']|<\/div>\s*<\/div>\s*<\/main>|<footer|$)/ig;
    var blocks = String(html || "").match(blockRe) || [];
    for (var bi = 0; bi < blocks.length; bi++) {
      var block = blocks[bi];
      var hrefMatch = block.match(/href=["']([^"']*\/index\.php\/vod\/detail\/[^"']+)["'][^>]*(?:title=["']([^"']*)["'])?/i);
      if (!hrefMatch) continue;
      var href = zzAbsUrl(hrefMatch[1].replace(/&amp;/g, "&"), params);
      if (!href || seen[href]) continue;
      var titleMatch = block.match(/<h3[^>]*>\s*<a[^>]*title=["']([^"']+)["']/i)
        || block.match(/<a[^>]*class=["'][^"']*video-serial[^"']*["'][^>]*title=["']([^"']+)["']/i)
        || block.match(/<img[^>]*alt=["']([^"']+)["']/i);
      var imgMatch = block.match(/<img[^>]*(?:data-src|data-original|src)=["']([^"']+)["']/i);
      var descMatch = block.match(/<div[^>]+class=["'][^"']*video-info-item[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
      var title = zzCleanTitle(titleMatch && titleMatch[1] || hrefMatch[2] || "");
      if (!title) continue;
      seen[href] = true;
      out.push({
        id: href,
        type: "url",
        mediaType: "movie",
        title: title,
        posterPath: zzAbsUrl(imgMatch && imgMatch[1] || "", params),
        backdropPath: zzAbsUrl(imgMatch && imgMatch[1] || "", params),
        description: zzText(descMatch && descMatch[1] || "").replace(/<[^>]+>/g, ""),
        link: href
      });
    }
  }
  return out;
}

async function zzSearch(keyword, params) {
  keyword = zzText(keyword);
  if (!keyword) return [];
  var page = zzToInt(params && params.page, 1) || 1;
  var key = zzHost(params) + "::" + keyword + "::" + page;
  var cached = zzCacheGet(ZZ_SEARCH_CACHE, key);
  if (cached) return cached;
  var promise = zzGetHtml(zzSearchUrl(keyword, page, params), params)
    .then(function (html) { return zzParseSearch(html, params); })
    .catch(function (e) {
      delete ZZ_SEARCH_CACHE[key];
      throw e;
    });
  return zzCacheSet(ZZ_SEARCH_CACHE, key, promise);
}

function zzDedupeSearchItems(groups) {
  var out = [];
  var seen = {};
  for (var gi = 0; gi < groups.length; gi++) {
    var items = groups[gi] || [];
    for (var ii = 0; ii < items.length; ii++) {
      var item = items[ii] || {};
      var key = item.link || item.id || item.title;
      if (!key || seen[key]) continue;
      seen[key] = true;
      out.push(item);
    }
  }
  return out;
}

function zzSearchItemsLookUseful(items, params, keyword) {
  items = Array.isArray(items) ? items : [];
  if (!items.length) return false;
  var wantNorm = zzNorm((params && (params.seriesName || params.title || params.name)) || keyword || "");
  if (!wantNorm) return true;
  for (var i = 0; i < items.length; i++) {
    var itemNorm = zzNorm(items[i] && items[i].title || "");
    if (itemNorm && (itemNorm === wantNorm || itemNorm.indexOf(wantNorm) >= 0 || wantNorm.indexOf(itemNorm) >= 0)) return true;
  }
  return false;
}

async function zzSearchFastHosts(keyword, params, hosts) {
  hosts = Array.isArray(hosts) ? hosts : [];
  if (!hosts.length) return [];
  return new Promise(function (resolve) {
    var done = false;
    var pending = hosts.length;
    var groups = [];
    function finish(items) {
      if (done) return;
      done = true;
      resolve(items || []);
    }
    for (var hi = 0; hi < hosts.length; hi++) {
      (function (index, host) {
        zzSearch(keyword, zzParamsForHost(params, host)).then(function (items) {
          items = items || [];
          groups[index] = items;
          if (items.length && zzSearchItemsLookUseful(items, params, keyword) && !done) {
            console.log("[zhizhen] fast search host hit", { host: zzOrigin(host) || host, count: items.length });
            finish(items);
          }
        }).catch(function (e) {
          groups[index] = [];
          if (!done) console.warn("[zhizhen] pan host search failed:", host, e && e.message || e);
        }).then(function () {
          pending--;
          if (pending <= 0 && !done) finish(zzDedupeSearchItems(groups));
        });
      })(hi, hosts[hi]);
    }
  });
}

async function zzSearchAll(keyword, params) {
  var hosts = zzPanHosts(params);
  if (fastResourceSearchEnabled(params)) return zzSearchFastHosts(keyword, params, hosts);
  var tasks = hosts.map(function (host) {
    return zzSearch(keyword, zzParamsForHost(params, host)).catch(function (e) {
      console.warn("[zhizhen] pan host search failed:", host, e && e.message || e);
      return [];
    });
  });
  return zzDedupeSearchItems(await Promise.all(tasks));
}

function zzScoreItem(item, params, keyword) {
  var wantTitle = params.seriesName || params.title || params.name || keyword || "";
  var wantNorm = zzNorm(wantTitle);
  var itemNorm = zzNorm(item.title);
  var score = 0;
  if (wantNorm && itemNorm === wantNorm) score += 100;
  if (wantNorm && (itemNorm.indexOf(wantNorm) >= 0 || wantNorm.indexOf(itemNorm) >= 0)) score += 40;
  var wantYear = String(params.premiereDate || params.releaseDate || params.year || "").slice(0, 4) || zzYear(wantTitle);
  if (wantYear && item.description && item.description.indexOf(wantYear) >= 0) score += 10;
  if (/解说|速看|合集|全集/.test(item.title)) score -= 50;
  return score;
}

function zzPickBest(items, params, keyword) {
  items = Array.isArray(items) ? items : [];
  if (!items.length) return null;
  return zzRankItems(items, params, keyword)[0] || null;
}

function zzRankItems(items, params, keyword) {
  items = Array.isArray(items) ? items : [];
  return items.map(function (item) {
    return { item: item, score: zzScoreItem(item, params || {}, keyword) };
  }).sort(function (a, b) { return b.score - a.score; }).map(function (ranked) {
    return ranked.item;
  });
}

function zzExtractDetail(html, link, params) {
  if (zzIsMaintenanceHtml(html)) {
    return {
      id: link,
      type: "url",
      mediaType: "movie",
      title: "至臻[盘]",
      posterPath: "",
      backdropPath: "",
      description: "",
      link: link,
      lines: []
    };
  }
  var $ = Widget.html.load(html);
  var title = zzCleanTitle($(".video-info h1, h1").first().text() || $("meta[property='og:title']").attr("content") || "");
  var poster = zzAbsUrl($(".lazyload, .lazyloaded, .module-item-pic img, img").first().attr("data-original")
    || $(".lazyload, .lazyloaded, .module-item-pic img, img").first().attr("data-src")
    || $(".lazyload, .lazyloaded, .module-item-pic img, img").first().attr("src")
    || $("meta[property='og:image']").attr("content") || "", params);
  var description = zzText($(".sqjj_a").first().text() || $(".zkjj_a").first().text() || $("meta[name='description']").attr("content") || "");
  var lines = [];
  var seen = {};

  $(".module-row-info").each(function (_, el) {
    var row = $(el);
    var lineTitle = zzText(row.find(".module-row-title h4").first().text());
    var share = zzText(row.find(".module-row-title p").first().text())
      || zzText(row.find("[data-clipboard-text]").first().attr("data-clipboard-text"))
      || zzText(row.find("a.btn-down").first().attr("href"));
    if (!share || seen[share] || detectPanType(share) !== "百度") return;
    seen[share] = true;
    lines.push({ title: lineTitle || title || "至臻[盘]", shareUrl: share, panType: detectPanType(share) });
  });

  if (!lines.length) {
    var linkRe = /(https?:\/\/pan\.baidu\.com\/[^\s"'<>]+)/ig;
    var m;
    while ((m = linkRe.exec(html))) {
      var shareUrl = m[1].replace(/&amp;/g, "&");
      if (seen[shareUrl]) continue;
      seen[shareUrl] = true;
      lines.push({ title: title || "至臻[盘]", shareUrl: shareUrl, panType: detectPanType(shareUrl) });
    }
  }

  return {
    id: link,
    type: "url",
    mediaType: "movie",
    title: title || "至臻[盘]",
    posterPath: poster,
    backdropPath: poster,
    description: description,
    link: link,
    lines: lines
  };
}

async function zzLoadDetailObject(link, params) {
  link = zzAbsUrl(link, params);
  var detailParams = zzParamsForHost(params, zzOrigin(link) || zzHost(params));
  var cached = zzCacheGet(ZZ_DETAIL_CACHE, link);
  if (cached) return cached;
  var promise = zzGetHtml(link, detailParams).then(function (html) {
    return zzExtractDetail(html, link, detailParams);
  }).catch(function (e) {
    delete ZZ_DETAIL_CACHE[link];
    throw e;
  });
  return zzCacheSet(ZZ_DETAIL_CACHE, link, promise);
}

function detectPanType(url) {
  var u = String(url || "").toLowerCase();
  if (u.indexOf("pan.baidu.com") >= 0) return "百度";
  return "网盘";
}

function zzResolveLink(line, extra) {
  var data = Object.assign({}, extra || {}, {
    title: line && line.title || "",
    shareUrl: line && line.shareUrl || "",
    panType: line && line.panType || detectPanType(line && line.shareUrl || "")
  });
  return ZZ_RESOLVE_SCHEME + encodeURIComponent(JSON.stringify(data));
}

function zzParseResolveLink(link) {
  link = String(link || "");
  if (link.indexOf(ZZ_RESOLVE_SCHEME) !== 0) return null;
  var raw = link.slice(ZZ_RESOLVE_SCHEME.length);
  if (raw.indexOf("data=") === 0) raw = raw.slice(5);
  try {
    var data = JSON.parse(decodeURIComponent(raw));
    if (!data || !data.shareUrl) return null;
    return {
      title: data.title || data.detailTitle || "至臻[盘]",
      shareUrl: data.shareUrl,
      panType: data.panType || detectPanType(data.shareUrl),
      detailTitle: data.detailTitle || "",
      keyword: data.keyword || ""
    };
  } catch (e) {
    console.warn("[zhizhen] resolve link parse failed:", e && e.message || e);
    return null;
  }
}

function deferredSourceFromLine(line, context) {
  var title = "至臻[盘] " + (line.panType || detectPanType(line.shareUrl)) + " " + zzText(line.title || "");
  var link = zzResolveLink(line, context || {});
  return {
    id: link,
    type: "url",
    name: title,
    title: title,
    url: link,
    link: link,
    mediaType: "movie",
    description: [
      context && context.keyword ? "搜索词: " + context.keyword : "",
      context && context.detailTitle ? "命中: " + context.detailTitle : "",
      line.title || "",
      line.shareUrl || ""
    ].filter(Boolean).join("\n")
  };
}

var ZZ_VIDEO_EXT_RE = /\.(mp4|mkv|webm|avi|wmv|flv|mov|mpeg|mpg|m4v|ts|m2ts|3gp|rm|rmvb)$/i;
var ZZ_NON_VIDEO_EXT_RE = /\.(mp3|m4a|aac|flac|wav|ogg|opus|ape|wma|alac|cue|lrc|jpg|jpeg|png|gif|webp|bmp|txt|pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|tar|gz|ass|srt|ssa|vtt)$/i;

function isPlayableVideoName(name) {
  var s = String(name || "").trim();
  if (!s) return true;
  if (ZZ_VIDEO_EXT_RE.test(s)) return true;
  if (ZZ_NON_VIDEO_EXT_RE.test(s)) return false;
  return !/\.[A-Za-z0-9]{1,6}(?:$|[?#])/i.test(s);
}

function isPlayableVideoItem(item) {
  var name = helperItemName(item);
  if (!isPlayableVideoName(name)) return false;
  return item && (item.obj_category === "video" || item.category === "video" || item.category === 1 || item.mediaType === 3 || item.media_type === 3 || ZZ_VIDEO_EXT_RE.test(name));
}

function zzEncodeQueryPart(part) {
  return String(part == null ? "" : part)
    .replace(/%(?![0-9A-Fa-f]{2})/g, "%25")
    .replace(/\+/g, "%2B")
    .replace(/ /g, "%20")
    .replace(/"/g, "%22")
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E")
    .replace(/`/g, "%60");
}

function normalizePlaybackUrl(url) {
  var s = String(url || "").trim();
  if (!s) return "";
  var hash = "";
  var hashIndex = s.indexOf("#");
  if (hashIndex >= 0) {
    hash = s.slice(hashIndex);
    s = s.slice(0, hashIndex);
  }
  var qIndex = s.indexOf("?");
  if (qIndex < 0) return s.replace(/ /g, "%20") + hash;
  var base = s.slice(0, qIndex).replace(/ /g, "%20");
  var query = s.slice(qIndex + 1).split("&").map(function (part) {
    var eq = part.indexOf("=");
    if (eq < 0) return zzEncodeQueryPart(part);
    return zzEncodeQueryPart(part.slice(0, eq)) + "=" + zzEncodeQueryPart(part.slice(eq + 1));
  }).join("&");
  return base + "?" + query + hash;
}

function zzUrlHost(url) {
  try {
    return new URL(String(url || "")).host || "";
  } catch (e) {
    return "";
  }
}

function appendQueryParam(url, key, value) {
  var s = String(url || "").trim();
  value = zzText(value);
  if (!s || !key || !value) return s;
  var hash = "";
  var hashIndex = s.indexOf("#");
  if (hashIndex >= 0) {
    hash = s.slice(hashIndex);
    s = s.slice(0, hashIndex);
  }
  var re = new RegExp("([?&])" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=", "i");
  if (re.test(s)) return s + hash;
  return s + (s.indexOf("?") >= 0 ? "&" : "?") + encodeURIComponent(key) + "=" + encodeURIComponent(value) + hash;
}

function sourceDisplayName(name) {
  var s = zzText(name)
    .replace(/^至臻\[盘\]\s*/, "")
    .replace(/\s+\d+(?:\.\d+)?\s*(?:B|KB|MB|GB|TB|PB)$/i, "")
    .trim();
  var pan = sourcePanLabel(s);
  return pan || s;
}

function sourceSizeText(name, description, meta) {
  if (meta && Number(meta.size || 0) > 0) return zzSizeText(meta.size);
  var text = [description, name].filter(Boolean).join("\n");
  var m = text.match(/大小[:：]\s*([0-9.]+\s*(?:B|KB|MB|GB|TB|PB))/i);
  if (m) return zzText(m[1]);
  m = zzText(name).match(/\s([0-9.]+\s*(?:B|KB|MB|GB|TB|PB))$/i);
  return m ? zzText(m[1]) : "";
}

function sourcePanLabel(name) {
  var s = zzText(name);
  if (/百度/.test(s)) return "百度";
  return "网盘";
}

function sourceEpisodeNumber(name, description, meta) {
  var cfgParams = meta && meta.params || ZZ_RUNTIME_PARAMS || {};
  if (zzText(cfgParams && cfgParams.type).toLowerCase() === "movie") return 0;
  var wantedEp = zzWantedEpisode(cfgParams);
  if (wantedEp > 0) return wantedEp;
  if (meta && Number(meta.episode || 0) > 0) return Number(meta.episode || 0);
  var text = [
    meta && meta.name || "",
    meta && meta.group || "",
    description || "",
    name || ""
  ].filter(Boolean).join(" ");
  text = text
    .replace(/https?:\/\/\S+/ig, " ")
    .replace(/大小[:：]\s*[0-9.]+\s*(?:B|KB|MB|GB|TB|PB)/ig, " ")
    .replace(/\b[0-9.]+\s*(?:B|KB|MB|GB|TB|PB)\b/ig, " ")
    .replace(/\.(?:mp4|mkv|avi|mov|m4v|ts|m2ts|flv|wmv|webm|rmvb)\b/ig, " ")
    .replace(/\bH\.?26[45]\b/ig, " ");
  return zzExtractEpisode(text);
}

function sourceEpisodeText(name, description, meta) {
  var ep = sourceEpisodeNumber(name, description, meta);
  return ep > 0 ? "第" + ep + "集" : "";
}

function sourceQualityConfig(params) {
  var value = ZZ_BUILTIN_QUALITY_TAG;
  if (value === "4k") {
    return { value: "4k", label: "4K", tag: "4k", resolutionId: "4k", resolution: "3840x2160", width: 3840, height: 2160 };
  }
  if (value === "1080p" || value === "1080" || value === "fhd") {
    return { value: "1080p", label: "1080P", tag: "1080p", resolutionId: "1080p", resolution: "1920x1080", width: 1920, height: 1080 };
  }
  if (value === "other" || value === "others" || value === "其他" || value === "其它") {
    return { value: "other", label: "其他", tag: "", resolutionId: "other", resolution: "", width: 0, height: 0 };
  }
  return { value: "8k", label: "8K", tag: "8k", resolutionId: "8k", resolution: "7680x4320", width: 7680, height: 4320 };
}

function sourceActualQualityConfig(name, description, meta) {
  var text = [
    meta && (meta.fileName || meta.filename || meta.file_name || meta.server_filename || meta.name) || "",
    name || "",
    description || ""
  ].filter(Boolean).join(" ").toLowerCase();
  if (/4320p|\b8k\b|7680\s*[x×]\s*4320/.test(text)) {
    return { value: "8k", label: "8K", tag: "8k", resolutionId: "8k", resolution: "7680x4320", width: 7680, height: 4320 };
  }
  if (/2160p|\b4k\b|\buhd\b|3840\s*[x×]\s*2160/.test(text)) {
    return { value: "4k", label: "4K", tag: "4k", resolutionId: "4k", resolution: "3840x2160", width: 3840, height: 2160 };
  }
  if (/1080p|\bfhd\b|1920\s*[x×]\s*1080/.test(text)) {
    return { value: "1080p", label: "1080P", tag: "1080p", resolutionId: "1080p", resolution: "1920x1080", width: 1920, height: 1080 };
  }
  if (/720p|1280\s*[x×]\s*720/.test(text)) {
    return { value: "720p", label: "720P", tag: "720p", resolutionId: "720p", resolution: "1280x720", width: 1280, height: 720 };
  }
  if (/480p|854\s*[x×]\s*480/.test(text)) {
    return { value: "480p", label: "480P", tag: "480p", resolutionId: "480p", resolution: "854x480", width: 854, height: 480 };
  }
  return { value: "", label: "", tag: "", resolutionId: "", resolution: "", width: 0, height: 0 };
}

function sourceQualityText(name, description, meta) {
  return sourceQualityConfig(meta && meta.params || ZZ_RUNTIME_PARAMS).label;
}

function sourceDurationSecondsFromValue(value, key) {
  if (value == null || value === "") return 0;
  key = String(key || "").toLowerCase();
  if (typeof value === "number" && Number.isFinite(value)) {
    if (/minute|min|runtime/.test(key)) return value > 0 ? Math.round(value * 60) : 0;
    if (/second|sec/.test(key)) return value > 0 ? Math.round(value) : 0;
    return value > 600 ? Math.round(value) : 0;
  }
  var text = zzText(value);
  if (!text) return 0;
  var m = text.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) {
    var h = m[3] ? zzToInt(m[1], 0) : 0;
    var min = m[3] ? zzToInt(m[2], 0) : zzToInt(m[1], 0);
    var sec = zzToInt(m[3] || m[2], 0);
    return h * 3600 + min * 60 + sec;
  }
  m = text.match(/(\d+(?:\.\d+)?)\s*(?:小时|hour|hr|h)\s*(?:(\d+(?:\.\d+)?)\s*(?:分钟|minute|min|m))?/i);
  if (m) return Math.round(Number(m[1]) * 3600 + Number(m[2] || 0) * 60);
  m = text.match(/(\d+(?:\.\d+)?)\s*(?:分钟|minute|min|m)/i);
  if (m) return Math.round(Number(m[1]) * 60);
  m = text.match(/(\d+(?:\.\d+)?)\s*(?:秒|second|sec|s)/i);
  if (m) return Math.round(Number(m[1]));
  return 0;
}

function sourceDurationSeconds(params) {
  params = params || {};
  var keys = ["durationSeconds", "duration_seconds", "runtimeSeconds", "runtime_seconds", "duration", "durationText", "duration_text", "runtime", "runtimeMinutes", "runtime_minutes"];
  for (var i = 0; i < keys.length; i++) {
    var seconds = sourceDurationSecondsFromValue(params[keys[i]], keys[i]);
    if (seconds > 60) return seconds;
  }
  var parents = ["tmdbInfo", "mediaInfo", "item", "video", "currentItem", "episodeInfo", "selectedEpisode", "metadata"];
  for (var pi = 0; pi < parents.length; pi++) {
    var child = params[parents[pi]];
    if (!child || typeof child !== "object") continue;
    for (var ki = 0; ki < keys.length; ki++) {
      var childSeconds = sourceDurationSecondsFromValue(child[keys[ki]], keys[ki]);
      if (childSeconds > 60) return childSeconds;
    }
  }
  return 0;
}

function sourceBitrateBitsPerSecond(size, params) {
  size = Number(size || 0);
  var seconds = sourceDurationSeconds(params);
  if (!size || !seconds) return 0;
  return Math.round(size * 8 / seconds);
}

function estimatedSourceDurationSeconds(params) {
  var seconds = sourceDurationSeconds(params);
  if (seconds > 60) return seconds;
  var type = zzText(params && (params.type || params.mediaType || params.contentType)).toLowerCase();
  if (type === "movie") return 120 * 60;
  return 45 * 60;
}

function sourceBitrateForMediaInfo(size, params) {
  size = Number(size || 0);
  if (!size) return 0;
  var seconds = sourceDurationSeconds(params || {});
  return seconds > 0 ? Math.round(size * 8 / seconds) : 0;
}

function sourceRealSize(meta, item) {
  meta = meta || {};
  item = item || {};
  return Number(
    meta.realSize || meta.actualSize || meta.actualFileSize || meta.fileRealSize || meta.size ||
    item.realSize || item.RealSize || item.actualSize || item.ActualSize ||
    item.actualFileSize || item.fileRealSize || item.fileRealSizeBytes ||
    item.sourceSize || item.originalSize || item.size
  ) || 0;
}

function sourceDataSize(meta, item) {
  return sourceRealSize(meta, item);
}

function sourceDataSizeText(size) {
  size = Number(size || 0);
  if (!size) return "";
  return zzSizeText(size);
}

function sourceRuntimeTicks(params) {
  var seconds = sourceDurationSeconds(params || {});
  return seconds > 60 ? Math.round(seconds * 10000000) : 0;
}

function sourceFrameRate(params) {
  var keys = ["frameRate", "framerate", "fps", "videoFrameRate"];
  for (var i = 0; i < keys.length; i++) {
    var n = Number(params && params[keys[i]] || 0);
    if (n > 0) return n;
  }
  return 0;
}

function sourceContainerName(name, url) {
  var text = [name, url].filter(Boolean).join(" ");
  var m = text.match(/\.([a-z0-9]{2,5})(?:$|[?#\s])/i);
  return (m && m[1] || "").toLowerCase();
}

function playbackFileName(name, meta) {
  meta = meta || {};
  var raw = zzText(meta.name || meta.fileName || meta.filename || meta.file_name || name || "baidu-video.mkv");
  raw = raw.split(/[\\/]/).pop();
  raw = raw.replace(/^至臻\[盘\]\s*百度\s*/i, "").replace(/\s+\d+(?:\.\d+)?\s*(?:KB|MB|GB|TB)$/i, "");
  raw = raw.replace(/[\u0000-\u001f]+/g, " ").trim();
  if (!raw) raw = "baidu-video.mkv";
  if (!/\.(?:mp4|mkv|avi|mov|m4v|ts|m2ts|flv|wmv|webm|rmvb)$/i.test(raw)) raw += ".mkv";
  return raw;
}

function sourceCodecName(name) {
  var text = zzText(name).toLowerCase();
  if (/av1/.test(text)) return "av1";
  if (/h\.?265|hevc|x265/.test(text)) return "hevc";
  if (/h\.?264|avc|x264/.test(text)) return "h264";
  return "";
}

function sourceCodecDisplayName(codec) {
  codec = zzText(codec).toLowerCase();
  if (codec === "h264") return "H.264";
  if (codec === "hevc") return "HEVC";
  if (codec === "av1") return "AV1";
  return "";
}

function videoResourceTags(name) {
  var codec = sourceCodecName(name);
  return {
    codec: sourceCodecDisplayName(codec),
    dynamicRange: /dolby\s*vision|dovi|\bdv\b/i.test(name || "") ? "DV" : (/hdr/i.test(name || "") ? "HDR" : ""),
    bitDepth: /10bit|10-bit|main\s*10|hdr|dolby\s*vision|\bdv\b/i.test(name || "") ? 10 : 8,
    source: /blu-?ray|remux|bdremux/i.test(name || "") ? "BluRay" : "WEB-DL",
    immersive: /3d|vr|180|360/i.test(name || "")
  };
}

function audioResourceTags(name) {
  var text = zzText(name).toLowerCase();
  var codec = /truehd/.test(text) ? "TrueHD" : (/dts/.test(text) ? "DTS" : (/eac3|ddp|dd\+/.test(text) ? "EAC3" : (/aac/.test(text) ? "AAC" : (/ac3|dd5/.test(text) ? "AC3" : ""))));
  var channels = /7[._ ]?1/.test(text) ? 8 : (/5[._ ]?1/.test(text) ? 6 : (/2[._ ]?0|stereo/.test(text) ? 2 : 0));
  return {
    codec: codec,
    channels: channels,
    source: /blu-?ray|remux|bdremux/i.test(name || "") ? "BluRay" : "WEB-DL"
  };
}

function mediaTagLine(name, meta) {
  var text = zzText(name).toLowerCase();
  var video = videoResourceTags(name);
  var audio = audioResourceTags(name);
  var quality = sourceActualQualityConfig(name, "", meta);
  var range = /dolby\s*vision|dovi|\bdv\b/i.test(name || "") ? "DV" : video.dynamicRange;
  var channelText = audio.channels >= 8 ? "7.1" : (audio.channels >= 6 ? "5.1" : (audio.channels >= 2 ? "2.0" : ""));
  var tags = [quality.tag, range, video.codec, audio.codec];
  if (/atmos/.test(text)) tags.push("atmos");
  tags.push(channelText);
  return tags.filter(Boolean).join("|");
}

function withMediaTagsFirst(source, lines) {
  source = source || {};
  var tagLine = mediaTagLine(source.fileName || source.filename || source.file_name || source.server_filename || source.name || "");
  var body = String(source.description || "");
  if (body.indexOf(tagLine) === 0) body = body.slice(tagLine.length).replace(/^\n+/, "");
  return [tagLine].concat(lines || [], [body]).filter(Boolean).join("\n");
}

function buildSyntheticMediaStreams(item, name, meta, params) {
  meta = meta || {};
  params = params || {};
  var quality = sourceActualQualityConfig(name, "", meta);
  var realSize = sourceRealSize(meta, item);
  var dataSize = sourceDataSize(meta, item, params);
  var bitrate = sourceBitrateForMediaInfo(dataSize, params);
  var fps = sourceFrameRate(params);
  var codec = sourceCodecName(name);
  var video = videoResourceTags(name);
  var audio = audioResourceTags(name);
  var videoTitle = [quality.label, video.codec].filter(Boolean).join(" ") || "Video";
  var streams = [{
    Index: 0,
    index: 0,
    Type: "Video",
    type: "Video",
    Codec: codec || undefined,
    codec: codec || undefined,
    DisplayTitle: videoTitle,
    displayTitle: videoTitle,
    Title: videoTitle,
    title: videoTitle,
    Width: quality.width || undefined,
    width: quality.width || undefined,
    Height: quality.height || undefined,
    height: quality.height || undefined,
    Size: dataSize,
    size: dataSize,
    RealSize: realSize,
    realSize: realSize,
    BitRate: bitrate,
    Bitrate: bitrate,
    bitrate: bitrate,
    AverageFrameRate: fps,
    averageFrameRate: fps,
    RealFrameRate: fps,
    realFrameRate: fps,
    IsInterlaced: false,
    isInterlaced: false,
    Profile: codec ? (codec === "hevc" ? "Main 10" : "High") : undefined,
    profile: codec ? (codec === "hevc" ? "Main 10" : "High") : undefined,
    PixelFormat: codec ? (codec === "hevc" ? "yuv420p10le" : "yuv420p") : undefined,
    pixelFormat: codec ? (codec === "hevc" ? "yuv420p10le" : "yuv420p") : undefined,
    VideoRange: video.dynamicRange || undefined,
    videoRange: video.dynamicRange || undefined,
    VideoRangeType: video.dynamicRange || undefined,
    videoRangeType: video.dynamicRange || undefined,
    ColorSpace: undefined,
    colorSpace: undefined,
    ColorTransfer: undefined,
    colorTransfer: undefined,
    ColorPrimaries: undefined,
    colorPrimaries: undefined
  }];
  if (audio.codec || audio.channels) {
    var audioTitle = [audio.codec, audio.channels >= 8 ? "7.1" : (audio.channels >= 6 ? "5.1" : (audio.channels >= 2 ? "2.0" : ""))].filter(Boolean).join(" ") || "Audio";
    streams.push({
      Index: 1,
      index: 1,
      Type: "Audio",
      type: "Audio",
      Codec: audio.codec ? audio.codec.toLowerCase() : undefined,
      codec: audio.codec ? audio.codec.toLowerCase() : undefined,
      DisplayTitle: audioTitle,
      displayTitle: audioTitle,
      Title: audioTitle,
      title: audioTitle,
      Language: "und",
      language: "und",
      Channels: audio.channels || undefined,
      channels: audio.channels || undefined,
      ChannelLayout: audio.channels >= 8 ? "7.1" : (audio.channels >= 6 ? "5.1" : (audio.channels >= 2 ? "stereo" : undefined)),
      channelLayout: audio.channels >= 8 ? "7.1" : (audio.channels >= 6 ? "5.1" : (audio.channels >= 2 ? "stereo" : undefined)),
      SampleRate: undefined,
      sampleRate: undefined,
      IsDefault: true,
      isDefault: true
    });
  }
  return streams;
}

function applyMediaSourceFields(item, name, meta) {
  if (!item) return item;
  meta = meta || {};
  var params = meta.params || ZZ_RUNTIME_PARAMS || {};
  var realSize = sourceRealSize(meta, item);
  var size = sourceDataSize(meta, item);
  var bitrate = sourceBitrateForMediaInfo(size, params);
  var runtimeTicks = sourceRuntimeTicks(params);
  var container = sourceContainerName(name, item.url || item.videoUrl || "");
  var quality = sourceActualQualityConfig(name, "", meta);
  var video = videoResourceTags(name);
  var streams = buildSyntheticMediaStreams(item, name, meta, params);
  var mediaSourceId = item.id || ["baidu", size || "", item.url || ""].join("|");
  var dataSizeText = sourceDataSizeText(size);
  var fileName = playbackFileName(name, meta);
  var mediaSource = {
    Id: mediaSourceId,
    id: mediaSourceId,
    Name: item.displayName || sourceDisplayName(name) || "百度网盘",
    name: item.displayName || sourceDisplayName(name) || "百度网盘",
    FileName: fileName,
    fileName: fileName,
    filename: fileName,
    ServerFileName: fileName,
    server_filename: fileName,
    Path: item.url || item.videoUrl || "",
    path: item.url || item.videoUrl || "",
    Protocol: "Http",
    protocol: "Http",
    Type: "Default",
    type: "Default",
    Container: container,
    container: container,
    Size: size,
    size: size,
    FileSize: size,
    fileSize: size,
    file_size: size,
    VideoFileSize: size,
    videoFileSize: size,
    ResolutionVideoFileSize: size,
    resolutionVideoFileSize: size,
    MaxFileSize: size,
    maxFileSize: size,
    RealSize: realSize,
    realSize: realSize,
    ActualSize: realSize,
    actualSize: realSize,
    ActualFileSize: realSize,
    actualFileSize: realSize,
    FileRealSize: realSize,
    fileRealSize: realSize,
    SourceSize: realSize,
    sourceSize: realSize,
    Bitrate: bitrate,
    BitRate: bitrate,
    bitrate: bitrate,
    RunTimeTicks: runtimeTicks,
    runTimeTicks: runtimeTicks,
    SupportsDirectPlay: true,
    supportsDirectPlay: true,
    SupportsDirectStream: true,
    supportsDirectStream: true,
    SupportsTranscoding: false,
    supportsTranscoding: false,
    IsRemote: true,
    isRemote: true,
    MediaStreams: streams,
    mediaStreams: streams
  };
  item.dataSize = size;
  item.realSize = realSize;
  item.RealSize = realSize;
  item.actualSize = realSize;
  item.ActualSize = realSize;
  item.actualFileSize = realSize;
  item.fileRealSize = realSize;
  item.sourceSize = realSize;
  item.originalSize = realSize;
  item.size = size;
  item.fileSize = size;
  item.file_size = size;
  item.mediaSourceId = mediaSourceId;
  item.MediaSourceId = mediaSourceId;
  item.mediaSource = mediaSource;
  item.MediaSource = mediaSource;
  item.mediaSources = [mediaSource];
  item.MediaSources = [mediaSource];
  item.mediaStreams = streams;
  item.MediaStreams = streams;
  item.fileName = fileName;
  item.FileName = fileName;
  item.filename = fileName;
  item.file_name = fileName;
  item.server_filename = fileName;
  item.originalFileName = fileName;
  item.serverFileName = fileName;
  item.RunTimeTicks = runtimeTicks;
  item.runTimeTicks = runtimeTicks;
  item.Bitrate = bitrate;
  item.BitRate = bitrate;
  item.bitrate = bitrate;
  item.bitRate = bitrate;
  item.videoBitRate = bitrate;
  item.videoBitrate = bitrate;
  item.videoBitRateText = bitrate > 0 ? (bitrate / 1000000).toFixed(2) + "Mbps" : "";
  item.videoFileSize = size;
  item.VideoFileSize = size;
  item.videoFileSizeText = dataSizeText;
  item.resolutionVideoFileSize = size;
  item.maxFileSize = size;
  item.videoPixelSize = quality.resolution || "";
  item.videoTitle = [quality.label, video.codec].filter(Boolean).join(" ");
  item.videoRange = video.dynamicRange || "";
  item.VideoRange = video.dynamicRange || "";
  if (video.dynamicRange) item.videoRangeScore = 999999;
  item.resolutionId = quality.resolutionId;
  item.providerId = "baidu";
  item.sourceId = "baidu";
  item.sourceType = "stream";
  return item;
}

function fastPlayConfigForName(name, params) {
  return null;
}

function applyFastPlayFields(item, name, meta) {
  var cfg = fastPlayConfigForName(name, meta && meta.params || ZZ_RUNTIME_PARAMS || {});
  if (!cfg) return item;
  item.fastPlayMode = true;
  item.fastplay = true;
  item.speedup = true;
  item.speedupEnabled = true;
  item.multiThread = true;
  item.multiThreadMode = true;
  item.isMulti = true;
  item.isVideo = true;
  item.threads = cfg.threads;
  item.thread = cfg.threads;
  item.threadCount = cfg.threads;
  item.threadNum = cfg.threads;
  item.downloadThreads = cfg.threads;
  item.downloadThreadCount = cfg.threads;
  item.maxThreadCount = cfg.threads;
  item.poolSize = cfg.threads;
  item.chunkSize = cfg.chunkSize;
  item.chunk_size = cfg.chunkSize;
  item.chunk = cfg.chunkSize;
  item.segmentSize = cfg.chunkSize;
  item.downloadChunkSize = cfg.chunkSize;
  item.rangeSize = cfg.chunkSize;
  return item;
}

function decorateSourceItem(item, name, description, meta) {
  meta = meta || {};
  var cfgParams = meta.params || ZZ_RUNTIME_PARAMS || {};
  var realSize = sourceRealSize(meta, item);
  var dataSize = sourceDataSize(meta, item);
  var displayName = sourceDisplayName(name) || zzText(name) || sourcePanLabel(name);
  var fileName = playbackFileName(name, meta);
  var sizeText = sourceSizeText(name, description, meta);
  var dataSizeText = sourceDataSizeText(dataSize);
  var displaySizeText = dataSizeText || sizeText;
  var panLabel = sourcePanLabel(displayName || name);
  var episodeText = sourceEpisodeText(name, description, meta);
  var displayQuality = sourceQualityConfig(cfgParams);
  var actualQuality = sourceActualQualityConfig(fileName || name, description, meta);
  var qualityText = sourceQualityText(name, description, meta);
  var cardName = [qualityText || displayQuality.label, episodeText, displaySizeText ? zzCompactSizeText(displaySizeText) : ""].filter(Boolean).join(" ");
  item.name = cardName;
  item.title = cardName;
  item.displayName = displayName;
  item.video = videoResourceTags(fileName || name);
  item.audio = audioResourceTags(fileName || name);
  item.fileName = fileName;
  item.FileName = fileName;
  item.filename = fileName;
  item.file_name = fileName;
  item.server_filename = fileName;
  item.originalFileName = fileName;
  item.serverFileName = fileName;
  item.quality = "BD";
  item.qualityName = actualQuality.label;
  item.qualityLabel = actualQuality.label;
  item.qualityTitle = actualQuality.label;
  item.label = actualQuality.label;
  item.format = actualQuality.label;
  item.resolution = actualQuality.resolution;
  item.resolutionText = actualQuality.label;
  item.renderSize = actualQuality.resolution;
  item.renderSizeText = actualQuality.label;
  item.width = actualQuality.width || undefined;
  item.height = actualQuality.height || undefined;
  item.panType = panLabel;
  item.source = panLabel;
  item.sourceName = panLabel;
  item.group = panLabel;
  item.groupName = panLabel;
  item.subTitle = displaySizeText;
  item.subtitle = displaySizeText;
  item.remark = displaySizeText;
  item.sizeText = displaySizeText;
  item.fileSizeText = displaySizeText;
  item.realSizeText = sizeText;
  item.actualFileSizeText = sizeText;
  item.episodeText = episodeText;
  item.episode = sourceEpisodeNumber(name, description, meta);
  if (realSize > 0) {
    item.realSize = realSize;
    item.RealSize = realSize;
    item.actualSize = realSize;
    item.ActualSize = realSize;
    item.actualFileSize = realSize;
    item.fileRealSize = realSize;
    item.sourceSize = realSize;
    item.originalSize = realSize;
  }
  if (dataSize > 0) {
    item.dataSize = dataSize;
    item.size = dataSize;
    item.fileSize = dataSize;
    item.file_size = dataSize;
    item.videoFileSize = dataSize;
    item.resolutionVideoFileSize = dataSize;
    item.maxFileSize = dataSize;
    item.isFirstFileSize = true;
    var bitrate = sourceBitrateBitsPerSecond(dataSize, cfgParams);
    if (!bitrate) bitrate = sourceBitrateForMediaInfo(dataSize, cfgParams);
    if (bitrate > 0) {
      item.bitrate = bitrate;
      item.bitRate = bitrate;
      item.videoRate = bitrate;
      item.videoBitRate = bitrate;
      item.videoBitrate = bitrate;
      item.bitrateLabel = (bitrate / 1000000).toFixed(2) + "Mbps";
    }
  }
  var descText = description || "";
  item.description = [
    mediaTagLine(fileName || name, meta),
    actualQuality.label ? "清晰度: " + actualQuality.label : "",
    actualQuality.resolution ? "分辨率: " + actualQuality.resolution : "",
    displaySizeText ? "大小: " + displaySizeText : "",
    descText
  ].filter(Boolean).join("\n");
  item.link = item.link || item.url || item.videoUrl || "";
  item.isBest = true;
  item._isBest = true;
  item.isResolutionChecked = true;
  applyFastPlayFields(item, name, meta);
  item.id = [sourcePanLabel(displayName), displayName, sizeText, item.url || ""].filter(Boolean).join("|");
  applyMediaSourceFields(item, name, meta);
  return item;
}

function playbackPlayerTypeForName(name, headers) {
  return "system";
}

function attachPlaybackHeaders(item, headers) {
  if (!headers) return item;
  item.header = headers;
  item.headers = headers;
  item.customHeaders = headers;
  item.httpHeaders = headers;
  item.playHeaders = headers;
  if (headers.Cookie) {
    item.cookie = headers.Cookie;
    item.cookies = headers.Cookie;
  }
  return item;
}

function sourceFromUrl(name, url, description, headers, meta) {
  var safeUrl = normalizePlaybackUrl(url);
  var item = {
    type: "url",
    mediaType: "movie",
    name: name,
    title: name,
    description: description || "",
    url: safeUrl,
    link: safeUrl,
    videoUrl: safeUrl,
    playerType: playbackPlayerTypeForName(name, headers)
  };
  attachPlaybackHeaders(item, headers);
  return decorateSourceItem(item, name, description, meta);
}

function sourceFromRawUrl(name, url, description, headers, meta) {
  var safeUrl = String(url || "").trim().replace(/ /g, "%20");
  var item = {
    type: "url",
    mediaType: "movie",
    name: name,
    title: name,
    description: description || "",
    url: safeUrl,
    link: safeUrl,
    videoUrl: safeUrl,
    playerType: playbackPlayerTypeForName(name, headers)
  };
  attachPlaybackHeaders(item, headers);
  return decorateSourceItem(item, name, description, meta);
}

function baiduPreparePlaybackUrl(url) {
  var s = String(url || "").trim();
  var qIndex = s.indexOf("?");
  if (qIndex < 0) return s;
  var hash = "";
  var hashIndex = s.indexOf("#", qIndex + 1);
  if (hashIndex >= 0) {
    hash = s.slice(hashIndex);
    s = s.slice(0, hashIndex);
  }
  var base = s.slice(0, qIndex);
  var query = s.slice(qIndex + 1).split("&").map(function (part) {
    var eq = part.indexOf("=");
    if (eq < 0) return part;
    var key = part.slice(0, eq);
    var value = part.slice(eq + 1);
    if (key === "sign") {
      try { value = decodeURIComponent(value); } catch (e) {}
    }
    return key + "=" + value;
  }).join("&");
  return base + "?" + query + hash;
}

function panFastPlayValue(params, key, defVal) {
  return Math.max(1, zzToInt(params && params[key], defVal));
}

function playbackFlagsForName(name, params, meta) {
  meta = meta || {};
  var fileName = playbackFileName(name, meta);
  var dataSize = sourceDataSize(meta, null);
  var bitRate = sourceBitrateForMediaInfo(dataSize, params || ZZ_RUNTIME_PARAMS);
  var quality = sourceActualQualityConfig(fileName || name, "", meta);
  var parts = [
    "isVideo=true",
    "filename=" + encodeURIComponent(fileName),
    "fileName=" + encodeURIComponent(fileName),
    "server_filename=" + encodeURIComponent(fileName)
  ];
  if (quality.resolutionId) parts.push("resolutionId=" + encodeURIComponent(quality.resolutionId));
  if (dataSize > 0) {
    parts.push("videoFileSize=" + encodeURIComponent(String(Math.round(dataSize))));
    parts.push("size=" + encodeURIComponent(String(Math.round(dataSize))));
  }
  if (bitRate > 0) {
    parts.push("videoBitRate=" + encodeURIComponent(String(Math.round(bitRate))));
    parts.push("bitrate=" + encodeURIComponent(String(Math.round(bitRate))));
  }
  return "#" + parts.join("&") + "#";
}

function appendPlaybackFlags(url, name, params, meta) {
  var s = String(url || "");
  if (!s) return "";
  return s + (s.indexOf("#") >= 0 ? "" : playbackFlagsForName(name, params, meta));
}

async function probePlaybackUrl(url, headers) {
  try {
    var probeHeaders = Object.assign({}, headers || {}, { "Range": "bytes=0-1023" });
    var resp = await Widget.http.get(String(url || "").split("#")[0], { headers: probeHeaders, timeout: 15000 });
    var status = Number(resp && (resp.status || resp.statusCode || resp.code) || 0);
    var contentType = zzText(getHeaderValue(resp && resp.headers, "content-type")).toLowerCase();
    var contentRange = zzText(getHeaderValue(resp && resp.headers, "content-range")).toLowerCase();
    var body = resp && resp.data;
    var bodyText = typeof body === "string" ? body.slice(0, 80).toLowerCase() : "";
    var okStatus = status === 200 || status === 206 || status === 0;
    var looksBad = /image|text\/html|application\/json|xml/.test(contentType) || /<html|<\\?xml|requestdenied|forbidden/.test(bodyText);
    var looksVideo = /video|matroska|mp4|octet-stream/.test(contentType) || /bytes\s+\d+-\d+\/[1-9]\d{6,}/.test(contentRange);
    return { ok: okStatus && looksVideo && !looksBad, status: status, contentType: contentType, contentRange: contentRange };
  } catch (e) {
    return { ok: false, message: e && e.message || String(e) };
  }
}

async function sourceFromDirect(name, url, description, headers, params, meta) {
  meta = meta || {};
  meta.params = params || meta.params;
  if (/百度/.test(zzText(name))) {
    var rawBaiduUrl = baiduPreparePlaybackUrl(url);
    return sourceFromRawUrl(name, appendPlaybackFlags(rawBaiduUrl, name, params, meta), description, headers || null, meta);
  }
  var targetUrl = normalizePlaybackUrl(url);
  return sourceFromUrl(name, appendPlaybackFlags(targetUrl, name, params, meta), description, headers || null, meta);
}

function sourcesFromLazyResult(prefix, result, description) {
  var out = [];
  if (!result) return out;
  var headers = result.header || result.headers || undefined;
  var url = result.url;
  if (Array.isArray(url)) {
    for (var i = 0; i < url.length; i += 2) {
      if (!url[i + 1]) continue;
      out.push(sourceFromUrl(prefix + " " + zzText(url[i] || ("线路" + (i / 2 + 1))), String(url[i + 1]), description, headers));
    }
  } else if (url) {
    out.push(sourceFromUrl(prefix, String(url), description, headers));
  }
  return out;
}

function helperAvailable(name) {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  return !!g[name];
}

function getHeaderValue(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || headers.get(name.toLowerCase()) || "";
  var lower = name.toLowerCase();
  for (var k in headers) {
    if (Object.prototype.hasOwnProperty.call(headers, k) && String(k).toLowerCase() === lower) return headers[k];
  }
  return "";
}

function filterVideosForEpisode(videos, params) {
  var rawCount = Array.isArray(videos) ? videos.length : 0;
  videos = (Array.isArray(videos) ? videos : []).filter(isPlayableVideoItem).filter(function (video) {
    return itemMatchesWantedTitle(helperItemName(video), video && video.vod_group || "", params);
  });
  videos = filterTinyPlayableItems(videos, params);
  var wantEp = zzWantedEpisode(params);
  var picked;
  if (!wantEp) {
    picked = videos;
  } else {
    var hasEpisodeMarkers = videos.some(function (video) {
      return !!helperEpisodeNumber(video, video && video.vod_group);
    });
    var matched = videos.filter(function (video) {
      var ep = helperEpisodeNumber(video, video && video.vod_group);
      return ep && ep === wantEp;
    });
    picked = matched.length || hasEpisodeMarkers ? matched : videos;
  }
  var unique = dedupeItemsBySize(picked);
  console.log("[zhizhen] baidu size filter", {
    rawCount: rawCount,
    filteredCount: videos.length,
    pickedCount: picked.length,
    uniqueCount: unique.length,
    sizes: itemSizeSummary(unique)
  });
  return unique;
}

function helperItemName(item) {
  return zzText((item && (item.file_name || item.name || item.FileName || item.server_filename || item.path)) || "");
}

function helperItemSize(item) {
  return zzSizeText(item && (item.size || item.Size || item.file_size || item.FileSize));
}

function helperItemSizeNumber(item) {
  return Number(item && (item.size || item.Size || item.file_size || item.FileSize) || 0);
}

function helperEpisodeNumber(item, group) {
  var ep = zzExtractEpisode(helperItemName(item));
  return ep || zzExtractEpisode(group);
}

function sortItemsBySizeDesc(items) {
  return (Array.isArray(items) ? items : []).slice().sort(function (a, b) {
    return helperItemSizeNumber(b) - helperItemSizeNumber(a);
  });
}

function itemSizeDedupeKey(item) {
  var size = helperItemSizeNumber(item);
  return size > 0 ? String(Math.round(size)) : "";
}

function dedupeItemsBySize(items) {
  var out = [];
  var seen = {};
  items = sortItemsBySizeDesc(items);
  for (var i = 0; i < items.length; i++) {
    var key = itemSizeDedupeKey(items[i]);
    if (key && seen[key]) continue;
    if (key) seen[key] = true;
    out.push(items[i]);
  }
  return out;
}

function itemSizeSummary(items) {
  return (Array.isArray(items) ? items : []).slice(0, 8).map(function (item) {
    var size = helperItemSizeNumber(item);
    return size ? zzCompactSizeText(zzSizeText(size)) : "unknown";
  }).join("|");
}

function filterTinyPlayableItems(items, params) {
  if (!zzWantedEpisode(params) && zzText(params && params.type).toLowerCase() !== "movie") return items;
  var minBytes = 20 * 1024 * 1024;
  return (Array.isArray(items) ? items : []).filter(function (item) {
    var size = helperItemSizeNumber(item);
    return !size || size >= minBytes;
  });
}

function helperItemEpisodeText(item, group) {
  return [helperItemName(item), group].filter(Boolean).join(" ");
}

function wantedTitleNorms(params) {
  params = params || {};
  var out = [];
  function add(v) {
    v = zzNorm(v);
    if (v && out.indexOf(v) < 0) out.push(v);
  }
  if (params.tmdbInfo) {
    add(params.tmdbInfo.title || params.tmdbInfo.name);
    add(params.tmdbInfo.originalTitle || params.tmdbInfo.originalName);
  }
  add(params.seriesName);
  add(params.title);
  add(params.name);
  return out;
}

function textMatchesWantedTitle(text, titleNorms) {
  var norm = zzNorm(text);
  if (!norm || !titleNorms.length) return false;
  for (var i = 0; i < titleNorms.length; i++) {
    if (norm.indexOf(titleNorms[i]) >= 0 || titleNorms[i].indexOf(norm) >= 0) return true;
  }
  return false;
}

function itemLooksLikeDifferentTitle(name, titleNorms) {
  if (!titleNorms.length) return false;
  var raw = String(name || "").split(/[\\/]/).pop().replace(/\.(?:mp4|mkv|avi|mov|m4v|ts|m2ts|flv|wmv|webm|rmvb)$/i, "");
  var prefix = raw.split(/\bS\d{1,2}E\d{1,4}\b|第\s*\d{1,4}\s*[集话期]|\bEP?\s*\d{1,4}\b|(?:^|[\s._\-\[\(])0*\d{1,4}(?=$|[\s._\-\]\)集话期])/i)[0] || "";
  prefix = zzText(prefix.replace(/[._\-\[\]【】()（）]/g, " "));
  if (!/[\u4e00-\u9fa5A-Za-z]{2,}/.test(prefix)) return false;
  return !textMatchesWantedTitle(prefix, titleNorms);
}

function itemMatchesWantedTitle(name, group, params) {
  var titleNorms = wantedTitleNorms(params);
  if (!titleNorms.length) return true;
  if (textMatchesWantedTitle(name, titleNorms)) return true;
  if (textMatchesWantedTitle(group, titleNorms)) return true;
  if (itemLooksLikeDifferentTitle(name, titleNorms)) {
    if (!zzWantedEpisode(params) && zzText(params && params.type).toLowerCase() === "movie") return true;
    return false;
  }
  return true;
}

function sortItemsByEpisodeDesc(items, textFn) {
  return (Array.isArray(items) ? items : []).slice().sort(function (a, b) {
    var ea = zzExtractEpisode(textFn(a));
    var eb = zzExtractEpisode(textFn(b));
    if (ea || eb) return (eb || -1) - (ea || -1);
    return 0;
  });
}

function episodeSummary(items, textFn) {
  var list = (Array.isArray(items) ? items : []).slice(0, 8).map(function (item) {
    var text = textFn(item);
    var ep = zzExtractEpisode(text);
    return (ep ? "E" + ep + " " : "") + zzText(text).slice(0, 80);
  });
  return list.join(" | ");
}

function filterHelperItemsForEpisode(items, params, group) {
  var rawCount = Array.isArray(items) ? items.length : 0;
  items = (Array.isArray(items) ? items : []).filter(function (item) {
    return isPlayableVideoName(helperItemName(item));
  }).filter(function (item) {
    return itemMatchesWantedTitle(helperItemName(item), group, params);
  });
  items = filterTinyPlayableItems(items, params);
  var wantEp = zzWantedEpisode(params);
  var picked;
  if (!wantEp) {
    picked = items;
  } else {
    var hasEpisodeMarkers = items.some(function (item) {
      return !!helperEpisodeNumber(item, group);
    });
    var matched = items.filter(function (item) {
      var ep = helperEpisodeNumber(item, group);
      return ep && ep === wantEp;
    });
    picked = matched.length || hasEpisodeMarkers ? matched : items;
  }
  var unique = dedupeItemsBySize(picked);
  console.log("[zhizhen] baidu helper size filter", {
    rawCount: rawCount,
    filteredCount: items.length,
    pickedCount: picked.length,
    uniqueCount: unique.length,
    sizes: itemSizeSummary(unique)
  });
  return unique;
}

function panPriority(type, params) {
  var order = ["百度", "网盘"];
  var idx = order.indexOf(type);
  return idx >= 0 ? idx : order.length;
}

function panEnabled(type, params) {
  return type === "百度";
}

function sourceLimitForPan(type, params) {
  if (type === "百度" && fastLoadEnabled(params)) return 1;
  var limit = type === "百度" ? ZZ_BUILTIN_BAIDU_MAX_FILES : 1;
  return limit;
}

function sortLinesByPan(lines, params) {
  return (Array.isArray(lines) ? lines : []).slice().sort(function (a, b) {
    return panPriority(a && a.panType, params) - panPriority(b && b.panType, params);
  });
}

function panTypesSummary(lines) {
  var seen = {};
  var out = [];
  (Array.isArray(lines) ? lines : []).forEach(function (line) {
    var type = line && (line.panType || detectPanType(line.shareUrl)) || "";
    if (type && !seen[type]) {
      seen[type] = true;
      out.push(type);
    }
  });
  return out.join(",");
}

function candidateScanLimit(params) {
  return ZZ_BUILTIN_CANDIDATE_SCAN_LIMIT;
}

function searchExtraAfterHit(params) {
  if (fastLoadEnabled(params)) return 0;
  return ZZ_BUILTIN_SEARCH_EXTRA_AFTER_HIT;
}

function shouldKeepPanLine(type, params) {
  return type === "百度" && canResolvePanType(type, params);
}

function canResolvePanType(type, params) {
  if (!panEnabled(type, params)) return false;
  if (type === "百度") return !!baiduCookie(params) || helperAvailable("Baidu2") || helperAvailable("Baidu");
  return false;
}

function resolvableTargetPans(params, targetPanType) {
  var base = targetPanType ? [targetPanType] : ["百度"];
  var out = [];
  for (var i = 0; i < base.length; i++) {
    var type = base[i];
    if (panEnabled(type, params) && canResolvePanType(type, params)) out.push(type);
  }
  return out;
}

function panLimitsReached(panCounts, params, targetPanType) {
  var pans = resolvableTargetPans(params, targetPanType);
  if (!pans.length) return false;
  for (var i = 0; i < pans.length; i++) {
    if ((panCounts[pans[i]] || 0) < sourceLimitForPan(pans[i], params)) return false;
  }
  return true;
}

function preferredOnlyLines(lines, params) {
  lines = sortLinesByPan(lines, params);
  var out = [];
  var seenPan = {};
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!line) continue;
    var type = line.panType || detectPanType(line.shareUrl);
    if (!panEnabled(type, params)) continue;
    if (shouldKeepPanLine(type, params)) {
      seenPan[type] = (seenPan[type] || 0) + 1;
      out.push(line);
    }
  }
  return out;
}

function baiduPlaybackHeaders(params) {
  var headers = {
    "User-Agent": "netdisk;P2SP;2.2.91.136;android-android;",
    "Referer": "https://pan.baidu.com/"
  };
  var cookie = baiduCookie(params);
  if (cookie) headers.Cookie = cookie;
  return headers;
}

function baiduCookie(params) {
  return zzText((params && (params.baidu_cookie || params.baiduCookie)) || ZZ_RUNTIME_PARAMS.baidu_cookie || ZZ_RUNTIME_PARAMS.baiduCookie || "");
}

function setBaiduCookie(params, cookie) {
  cookie = zzText(cookie);
  if (!cookie) return;
  ZZ_RUNTIME_PARAMS.baidu_cookie = cookie;
  if (params) params.baidu_cookie = cookie;
}

function baiduApplyRandsk(params, randsk) {
  randsk = zzText(randsk);
  if (!randsk) return;
  var cookie = baiduCookie(params).replace(/BDCLND=[^;]*;?\s*/g, "");
  if (cookie && !/;\s*$/.test(cookie)) cookie += "; ";
  setBaiduCookie(params, cookie + "BDCLND=" + randsk);
}

function baiduBaseHeaders(params) {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Encoding": "gzip",
    "Content-Type": "application/x-www-form-urlencoded",
    "Referer": "https://pan.baidu.com",
    "Cookie": baiduCookie(params)
  };
}

function baiduQuery(data) {
  var out = [];
  data = data || {};
  for (var k in data) {
    if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
    if (data[k] == null) continue;
    out.push(encodeURIComponent(k) + "=" + encodeURIComponent(data[k]));
  }
  return out.join("&");
}

function baiduJson(resp) {
  var data = resp && resp.data;
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch (e) { return {}; }
  }
  return data || {};
}

function baiduStatus(resp) {
  return Number(resp && (resp.status || resp.statusCode || resp.code) || 200);
}

async function baiduApi(path, data, headers, method, params, retry) {
  retry = retry == null ? 3 : retry;
  var fullUrl = /^https?:\/\//i.test(path) ? path : "https://pan.baidu.com/" + path.replace(/^\/+/, "");
  var mergedHeaders = Object.assign({}, baiduBaseHeaders(params), headers || {});
  var resp;
  if (String(method || "post").toLowerCase() === "get") {
    var query = baiduQuery(data);
    resp = await Widget.http.get(fullUrl + (query ? (fullUrl.indexOf("?") >= 0 ? "&" : "?") + query : ""), {
      headers: mergedHeaders,
      timeout: 30000
    });
  } else {
    resp = await Widget.http.post(fullUrl, baiduQuery(data), {
      headers: mergedHeaders,
      timeout: 30000
    });
  }
  var status = baiduStatus(resp);
  if ((status === 429 || status === 503) && retry > 0) {
    await zzSleep((4 - retry) * 1000);
    return baiduApi(path, data, headers, method, params, retry - 1);
  }
  return baiduJson(resp);
}

function baiduParseShare(url) {
  try {
    url = decodeURIComponent(String(url || "")).replace(/\s+/g, "");
  } catch (e) {
    url = String(url || "").replace(/\s+/g, "");
  }
  var m = url.match(/pan\.baidu\.com\/(?:s\/|wap\/init\?surl=)([^?&#]+)/i);
  if (!m) return null;
  var shareId = String(m[1] || "").replace(/^1+/, "").split("?")[0].split("#")[0];
  if (!shareId) return null;
  var pwd = "";
  var pm = url.match(/(?:提取码|密码|pwd)[:=：\s]*([^&\s#]{4})/i);
  if (pm) pwd = pm[1];
  return { shareId: shareId, sharePwd: pwd };
}

function sha1Hex(message) {
  function rotl(n, s) { return (n << s) | (n >>> (32 - s)); }
  function hex(n) {
    var s = "";
    for (var i = 7; i >= 0; i--) s += ((n >>> (i * 4)) & 0x0f).toString(16);
    return s;
  }
  function utf8Bytes(text) {
    var encoded = encodeURIComponent(String(text || ""));
    var out = "";
    for (var bi = 0; bi < encoded.length; bi++) {
      if (encoded.charAt(bi) === "%") {
        out += String.fromCharCode(parseInt(encoded.slice(bi + 1, bi + 3), 16));
        bi += 2;
      } else {
        out += encoded.charAt(bi);
      }
    }
    return out;
  }
  var msg = utf8Bytes(message);
  var words = [];
  for (var i = 0; i < msg.length; i++) {
    words[i >> 2] |= msg.charCodeAt(i) << (24 - (i % 4) * 8);
  }
  words[msg.length >> 2] |= 0x80 << (24 - (msg.length % 4) * 8);
  words[(((msg.length + 8) >> 6) << 4) + 15] = msg.length * 8;
  var h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  for (var block = 0; block < words.length; block += 16) {
    var w = [];
    for (i = 0; i < 80; i++) {
      w[i] = i < 16 ? (words[block + i] || 0) : rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }
    var a = h0, b = h1, c = h2, d = h3, e = h4;
    for (i = 0; i < 80; i++) {
      var f, k;
      if (i < 20) { f = (b & c) | ((~b) & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      var temp = (rotl(a, 5) + f + e + k + w[i]) | 0;
      e = d; d = c; c = rotl(b, 30); b = a; a = temp;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
  }
  return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4);
}

function zzUtf8Bytes(text) {
  var encoded = encodeURIComponent(String(text || ""));
  var out = [];
  for (var i = 0; i < encoded.length; i++) {
    if (encoded.charAt(i) === "%") {
      out.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      out.push(encoded.charCodeAt(i));
    }
  }
  return out;
}

function md5Hex(message) {
  function add32(a, b) { return (a + b) & 0xffffffff; }
  function rol(num, cnt) { return (num << cnt) | (num >>> (32 - cnt)); }
  function cmn(q, a, b, x, s, t) { return add32(rol(add32(add32(a, q), add32(x, t)), s), b); }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
  function rhex(n) {
    var s = "";
    for (var j = 0; j < 4; j++) s += ("0" + ((n >> (j * 8)) & 255).toString(16)).slice(-2);
    return s;
  }
  var bytes = zzUtf8Bytes(message);
  var words = [];
  for (var i = 0; i < bytes.length; i++) words[i >> 2] = (words[i >> 2] || 0) | (bytes[i] << ((i % 4) * 8));
  words[bytes.length >> 2] = (words[bytes.length >> 2] || 0) | (0x80 << ((bytes.length % 4) * 8));
  words[((((bytes.length + 8) >> 6) + 1) * 16) - 2] = bytes.length * 8;
  var a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  for (i = 0; i < words.length; i += 16) {
    var oa = a, ob = b, oc = c, od = d;
    a = ff(a, b, c, d, words[i + 0] || 0, 7, -680876936); d = ff(d, a, b, c, words[i + 1] || 0, 12, -389564586);
    c = ff(c, d, a, b, words[i + 2] || 0, 17, 606105819); b = ff(b, c, d, a, words[i + 3] || 0, 22, -1044525330);
    a = ff(a, b, c, d, words[i + 4] || 0, 7, -176418897); d = ff(d, a, b, c, words[i + 5] || 0, 12, 1200080426);
    c = ff(c, d, a, b, words[i + 6] || 0, 17, -1473231341); b = ff(b, c, d, a, words[i + 7] || 0, 22, -45705983);
    a = ff(a, b, c, d, words[i + 8] || 0, 7, 1770035416); d = ff(d, a, b, c, words[i + 9] || 0, 12, -1958414417);
    c = ff(c, d, a, b, words[i + 10] || 0, 17, -42063); b = ff(b, c, d, a, words[i + 11] || 0, 22, -1990404162);
    a = ff(a, b, c, d, words[i + 12] || 0, 7, 1804603682); d = ff(d, a, b, c, words[i + 13] || 0, 12, -40341101);
    c = ff(c, d, a, b, words[i + 14] || 0, 17, -1502002290); b = ff(b, c, d, a, words[i + 15] || 0, 22, 1236535329);
    a = gg(a, b, c, d, words[i + 1] || 0, 5, -165796510); d = gg(d, a, b, c, words[i + 6] || 0, 9, -1069501632);
    c = gg(c, d, a, b, words[i + 11] || 0, 14, 643717713); b = gg(b, c, d, a, words[i + 0] || 0, 20, -373897302);
    a = gg(a, b, c, d, words[i + 5] || 0, 5, -701558691); d = gg(d, a, b, c, words[i + 10] || 0, 9, 38016083);
    c = gg(c, d, a, b, words[i + 15] || 0, 14, -660478335); b = gg(b, c, d, a, words[i + 4] || 0, 20, -405537848);
    a = gg(a, b, c, d, words[i + 9] || 0, 5, 568446438); d = gg(d, a, b, c, words[i + 14] || 0, 9, -1019803690);
    c = gg(c, d, a, b, words[i + 3] || 0, 14, -187363961); b = gg(b, c, d, a, words[i + 8] || 0, 20, 1163531501);
    a = gg(a, b, c, d, words[i + 13] || 0, 5, -1444681467); d = gg(d, a, b, c, words[i + 2] || 0, 9, -51403784);
    c = gg(c, d, a, b, words[i + 7] || 0, 14, 1735328473); b = gg(b, c, d, a, words[i + 12] || 0, 20, -1926607734);
    a = hh(a, b, c, d, words[i + 5] || 0, 4, -378558); d = hh(d, a, b, c, words[i + 8] || 0, 11, -2022574463);
    c = hh(c, d, a, b, words[i + 11] || 0, 16, 1839030562); b = hh(b, c, d, a, words[i + 14] || 0, 23, -35309556);
    a = hh(a, b, c, d, words[i + 1] || 0, 4, -1530992060); d = hh(d, a, b, c, words[i + 4] || 0, 11, 1272893353);
    c = hh(c, d, a, b, words[i + 7] || 0, 16, -155497632); b = hh(b, c, d, a, words[i + 10] || 0, 23, -1094730640);
    a = hh(a, b, c, d, words[i + 13] || 0, 4, 681279174); d = hh(d, a, b, c, words[i + 0] || 0, 11, -358537222);
    c = hh(c, d, a, b, words[i + 3] || 0, 16, -722521979); b = hh(b, c, d, a, words[i + 6] || 0, 23, 76029189);
    a = hh(a, b, c, d, words[i + 9] || 0, 4, -640364487); d = hh(d, a, b, c, words[i + 12] || 0, 11, -421815835);
    c = hh(c, d, a, b, words[i + 15] || 0, 16, 530742520); b = hh(b, c, d, a, words[i + 2] || 0, 23, -995338651);
    a = ii(a, b, c, d, words[i + 0] || 0, 6, -198630844); d = ii(d, a, b, c, words[i + 7] || 0, 10, 1126891415);
    c = ii(c, d, a, b, words[i + 14] || 0, 15, -1416354905); b = ii(b, c, d, a, words[i + 5] || 0, 21, -57434055);
    a = ii(a, b, c, d, words[i + 12] || 0, 6, 1700485571); d = ii(d, a, b, c, words[i + 3] || 0, 10, -1894986606);
    c = ii(c, d, a, b, words[i + 10] || 0, 15, -1051523); b = ii(b, c, d, a, words[i + 1] || 0, 21, -2054922799);
    a = ii(a, b, c, d, words[i + 8] || 0, 6, 1873313359); d = ii(d, a, b, c, words[i + 15] || 0, 10, -30611744);
    c = ii(c, d, a, b, words[i + 6] || 0, 15, -1560198380); b = ii(b, c, d, a, words[i + 13] || 0, 21, 1309151649);
    a = ii(a, b, c, d, words[i + 4] || 0, 6, -145523070); d = ii(d, a, b, c, words[i + 11] || 0, 10, -1120210379);
    c = ii(c, d, a, b, words[i + 2] || 0, 15, 718787259); b = ii(b, c, d, a, words[i + 9] || 0, 21, -343485551);
    a = add32(a, oa); b = add32(b, ob); c = add32(c, oc); d = add32(d, od);
  }
  return rhex(a) + rhex(b) + rhex(c) + rhex(d);
}

function sha256Hex(message) {
  function rotr(n, x) { return (x >>> n) | (x << (32 - n)); }
  function hex(n) { return ("00000000" + (n >>> 0).toString(16)).slice(-8); }
  var k = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];
  var bytes = zzUtf8Bytes(message);
  var bitLen = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  for (var bi = 7; bi >= 0; bi--) bytes.push((bitLen / Math.pow(2, bi * 8)) & 255);
  var h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  for (var i = 0; i < bytes.length; i += 64) {
    var w = [];
    for (var j = 0; j < 16; j++) w[j] = ((bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) | (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3]) >>> 0;
    for (j = 16; j < 64; j++) {
      var s0 = rotr(7, w[j - 15]) ^ rotr(18, w[j - 15]) ^ (w[j - 15] >>> 3);
      var s1 = rotr(17, w[j - 2]) ^ rotr(19, w[j - 2]) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }
    var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (j = 0; j < 64; j++) {
      var S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      var ch = (e & f) ^ ((~e) & g);
      var temp1 = (hh + S1 + ch + k[j] + w[j]) >>> 0;
      var S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var temp2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  return h.map(hex).join("");
}

function baiduCookieDigest(params) {
  var parts = baiduCookie(params)
    .replace(/BDCLND=[^;]*;?\s*/g, "")
    .split(";")
    .map(function (part) { return zzText(part); })
    .filter(Boolean);
  var cookie = parts.join(";");
  return cookie ? sha256Hex(cookie).slice(0, 32) : "nocookie";
}

async function baiduGetUid(params) {
  var cookie = baiduCookie(params);
  if (!cookie) return "";
  var digest = baiduCookieDigest(params);
  var cacheKey = "uid::" + digest;
  var cached = zzCacheGetWithTtl(BAIDU_UID_CACHE, cacheKey, BAIDU_UID_CACHE_TTL_MS);
  if (cached) {
    console.log("[zhizhen] baidu uid cacheHit", { level: "memory" });
    return cached;
  }
  var storageKey = "zhizhen.baidu.uid." + digest;
  cached = zzStorageGet(storageKey, BAIDU_UID_CACHE_TTL_MS);
  if (cached) {
    zzCacheSet(BAIDU_UID_CACHE, cacheKey, cached);
    console.log("[zhizhen] baidu uid cacheHit", { level: "storage" });
    return cached;
  }
  if (BAIDU_UID_PENDING_CACHE[cacheKey]) {
    console.log("[zhizhen] baidu uid cacheHit", { level: "pending" });
    return BAIDU_UID_PENDING_CACHE[cacheKey];
  }
  console.log("[zhizhen] baidu uid cacheMiss");
  var pending = Widget.http.get("https://mbd.baidu.com/userx/v1/info/get?appname=baiduboxapp&fields=%20%20%20%20%20%20%20%20%5B%22bg_image%22,%22member%22,%22uid%22,%22avatar%22,%20%22avatar_member%22%5D&client&clientfrom&lang=zh-cn&tpl&ttt", {
    headers: {
      "User-Agent": baiduBaseHeaders(params)["User-Agent"],
      "Cookie": cookie
    },
    timeout: 20000
  }).then(function (resp) {
    var data = baiduJson(resp);
    var uid = data && data.data && data.data.fields && data.data.fields.uid || "";
    if (uid) {
      zzCacheSet(BAIDU_UID_CACHE, cacheKey, uid);
      zzStorageSet(storageKey, uid);
    }
    return uid;
  }).then(function (uid) {
    delete BAIDU_UID_PENDING_CACHE[cacheKey];
    return uid;
  }, function (e) {
    delete BAIDU_UID_PENDING_CACHE[cacheKey];
    throw e;
  });
  BAIDU_UID_PENDING_CACHE[cacheKey] = pending;
  return pending;
}

async function baiduShareToken(shareData, params) {
  var cacheKey = shareData.shareId + "::" + (shareData.sharePwd || "") + "::" + baiduCookieDigest(params);
  var cached = zzCacheGet(BAIDU_SHARE_CACHE, cacheKey);
  if (cached) {
    baiduApplyRandsk(params, cached.randsk);
    console.log("[zhizhen] baidu share cacheHit");
    return cached;
  }
  console.log("[zhizhen] baidu share cacheMiss");
  var verifyPromise = baiduApi("share/verify?t=" + Date.now() + "&surl=" + encodeURIComponent(shareData.shareId), {
    pwd: shareData.sharePwd || ""
  }, null, "post", params);
  var listPromise = baiduApi("share/list", {
    shorturl: shareData.shareId,
    root: 1,
    page: 1,
    num: 100
  }, null, "get", params);
  var verify = await verifyPromise;
  if (verify && verify.randsk) {
    baiduApplyRandsk(params, verify.randsk);
  }
  if (verify && verify.errno !== 0) {
    console.warn("[zhizhen] baidu verify failed", { errno: verify.errno });
  }
  var listData = await listPromise;
  if (listData && listData.errno !== 0 && verify && verify.randsk) {
    listData = await baiduApi("share/list", {
      shorturl: shareData.shareId,
      root: 1,
      page: 1,
      num: 100
    }, null, "get", params);
  }
  if (listData && listData.errno !== 0) {
    console.warn("[zhizhen] baidu list failed", { errno: listData.errno });
  }
  var token = {
    list: listData && listData.list || [],
    uk: listData && (listData.uk || listData.share_uk) || "",
    shareid: listData && listData.share_id || verify && verify.share_id || "",
    randsk: verify && verify.randsk || ""
  };
  if (token.shareid && token.uk) zzCacheSet(BAIDU_SHARE_CACHE, cacheKey, token);
  return token;
}

async function baiduListShareVideos(shareUrl, params) {
  var shareData = baiduParseShare(shareUrl);
  if (!shareData) return [];
  var wantEp = zzWantedEpisode(params);
  var fastStop = fastLoadEnabled(params) && wantEp > 0;
  var maxMatches = Math.max(1, sourceLimitForPan("百度", params));
  var cacheKey = [
    shareData.shareId,
    shareData.sharePwd || "",
    baiduCookieDigest(params),
    "ep=" + (wantEp || "all"),
    "mode=" + loadSpeedMode(params),
    "limit=" + maxMatches
  ].join("::");
  var cached = zzCacheGet(BAIDU_VIDEO_LIST_CACHE, cacheKey);
  if (cached) {
    console.log("[zhizhen] baidu video list cacheHit", { count: cached.length, mode: loadSpeedMode(params) });
    return cached;
  }
  console.log("[zhizhen] baidu video list cacheMiss", { mode: loadSpeedMode(params), episode: wantEp || "" });
  var token = await baiduShareToken(shareData, params);
  if (!token || !token.shareid || !token.uk) return [];
  var videos = [];
  var matchedCount = 0;
  var matchedSizes = {};
  var stopped = false;
  function itemEpisodeText(item, group) {
    return [item && item.server_filename || "", group || ""].filter(Boolean).join(" ");
  }
  function itemMatchesWanted(item, group) {
    if (wantEp <= 0) return false;
    var ep = zzExtractEpisode(item && item.server_filename || "");
    if (!ep) ep = zzExtractEpisode(group);
    return ep === wantEp;
  }
  function orderedList(list, group) {
    list = (Array.isArray(list) ? list : []).slice();
    if (!fastStop) return list;
    return list.sort(function (a, b) {
      var matchDelta = (itemMatchesWanted(b, group) ? 1 : 0) - (itemMatchesWanted(a, group) ? 1 : 0);
      if (matchDelta) return matchDelta;
      return helperItemSizeNumber(b) - helperItemSizeNumber(a);
    });
  }
  function addVideo(item, group) {
    var video = {
      fid: item.fs_id,
      file_name: item.server_filename,
      size: item.size,
      vod_group: group || "",
      shareId: shareData.shareId,
      baiduToken: token
    };
    videos.push(video);
    if (fastStop && itemMatchesWanted(item, group)) {
      var sizeKey = itemSizeDedupeKey(video) || ("unknown:" + matchedCount);
      if (!matchedSizes[sizeKey]) {
        matchedSizes[sizeKey] = true;
        matchedCount++;
      }
      if (matchedCount >= maxMatches) {
        stopped = true;
        return true;
      }
    }
    return false;
  }
  async function walk(dirPath, dirFsId, group) {
    if (stopped) return;
    var shareDir = "/sharelink" + token.shareid + "-" + dirFsId + dirPath;
    var data = await baiduApi("share/list", {
      sekey: token.randsk,
      uk: token.uk,
      shareid: token.shareid,
      page: 1,
      num: 100,
      dir: shareDir
    }, null, "get", params);
    var list = orderedList(data && data.list || [], group);
    for (var i = 0; i < list.length; i++) {
      if (stopped) break;
      var item = list[i] || {};
      if (String(item.isdir) === "1") {
        await walk(dirPath + "/" + item.server_filename, item.fs_id, group ? group + "/" + item.server_filename : item.server_filename);
      } else if (isPlayableVideoName(item.server_filename || "")) {
        if (addVideo(item, group)) break;
      }
    }
  }
  var root = orderedList(token.list || [], "");
  for (var i = 0; i < root.length; i++) {
    if (stopped) break;
    var item = root[i] || {};
    if (String(item.isdir) === "1") {
      await walk("/" + item.server_filename, item.fs_id, item.server_filename || "");
    } else if (isPlayableVideoName(item.server_filename || "")) {
      if (addVideo(item, "")) break;
    }
  }
  if (stopped) {
    console.log("[zhizhen] baidu list early stop", { episode: wantEp, collected: videos.length, matched: matchedCount });
  }
  if (videos.length) zzCacheSet(BAIDU_VIDEO_LIST_CACHE, cacheKey, videos);
  return videos;
}

async function baiduDirectPlayUrl(video, params, uidPromise) {
  var token = video && video.baiduToken || {};
  var cacheKey = token.shareid && token.uk && video && video.fid
    ? [token.shareid, token.uk, video.fid, baiduCookieDigest(params)].join("::")
    : "";
  if (cacheKey) {
    var cached = zzCacheGet(BAIDU_DIRECT_CACHE, cacheKey);
    if (cached) {
      console.log("[zhizhen] baidu direct cacheHit", { fid: String(video.fid || "").slice(0, 8) });
      return cached;
    }
    console.log("[zhizhen] baidu direct cacheMiss", { fid: String(video.fid || "").slice(0, 8) });
  }
  var uid = uidPromise ? await uidPromise.catch(function () { return ""; }) : await baiduGetUid(params);
  var bdussMatch = baiduCookie(params).match(/BDUSS=([^;]+)/);
  if (!uid || !bdussMatch) return "";
  var time = String(Date.now());
  var rand = sha1Hex(sha1Hex(bdussMatch[1]) + uid + "ebrcUYiuxaZv2XGu7KIYKxUrqfnOfpDF" + time + BAIDU_UZ_DEVUID + "11.30.2ae5821440fab5e1a61a025f014bd8972");
  var data = await baiduApi("share/list", {
    shareid: token.shareid,
    uk: token.uk,
    fid: video.fid,
    sekey: token.randsk,
    origin: "dlna",
    devuid: BAIDU_UZ_DEVUID,
    clienttype: 1,
    channel: "android_12_zhao_bd-netdisk_1024266h",
    version: "11.30.2",
    time: time,
    rand: rand
  }, {
    "User-Agent": "netdisk;P2SP;2.2.91.136;android-android;",
    "Cookie": baiduCookie(params)
  }, "get", params);
  var list = data && data.list || [];
  var dlink = list[0] && list[0].dlink || "";
  if (dlink && cacheKey) zzCacheSet(BAIDU_DIRECT_CACHE, cacheKey, dlink);
  return dlink;
}

async function baiduSourceFromVideo(video, line, params, uidPromise) {
  video = video || {};
  var directUrl = await baiduDirectPlayUrl(video, params, uidPromise);
  if (!directUrl) return null;
  var vName = video.file_name || "";
  var vSize = zzSizeText(video.size);
  var vDesc = [line.title, video.vod_group, vName, vSize ? "大小: " + vSize : "", line.shareUrl].filter(Boolean).join("\n");
  return sourceFromDirect("至臻[盘] 百度 " + vName + (vSize ? " " + vSize : ""), directUrl, vDesc, baiduPlaybackHeaders(params), params, { name: vName, size: Number(video.size || 0) });
}

async function baiduSourcesFromVideos(videos, line, params, uidPromise, maxFiles) {
  videos = Array.isArray(videos) ? videos : [];
  maxFiles = Math.max(1, Number(maxFiles || 1));
  var concurrency = fastLoadEnabled(params) ? 1 : BAIDU_DIRECT_CONCURRENCY_FULL;
  var out = [];
  console.log("[zhizhen] baidu direct concurrency", {
    mode: loadSpeedMode(params),
    concurrency: concurrency,
    candidates: videos.length,
    maxFiles: maxFiles
  });
  for (var i = 0; i < videos.length && out.length < maxFiles; i += concurrency) {
    var remaining = maxFiles - out.length;
    var batch = videos.slice(i, i + Math.min(concurrency, remaining));
    var sources = await Promise.all(batch.map(function (video) {
      return baiduSourceFromVideo(video, line, params, uidPromise).catch(function (e) {
        console.warn("[zhizhen] baidu direct source failed", { message: e && e.message || String(e) });
        return null;
      });
    }));
    for (var si = 0; si < sources.length && out.length < maxFiles; si++) {
      if (sources[si]) out.push(sources[si]);
    }
  }
  return out;
}

function flattenBaiduItems(data) {
  var out = [];
  if (Array.isArray(data)) return data;
  for (var key in data || {}) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
    var value = data[key];
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) out.push(value[i]);
    }
  }
  return out;
}

async function resolveBaiduDirect(line, params) {
  var helper = helperAvailable("Baidu2") ? Baidu2 : (helperAvailable("Baidu") ? Baidu : null);
  var baiduStartedAt = Date.now();
  console.log("[zhizhen] baidu direct start", { helper: !!helper, helperName: helperAvailable("Baidu2") ? "Baidu2" : (helperAvailable("Baidu") ? "Baidu" : ""), native: !!baiduCookie(params), share: !!(line && line.shareUrl) });
  if (!helper && baiduCookie(params)) {
    var uidPromise = baiduGetUid(params);
    var rawVideos = await baiduListShareVideos(line.shareUrl, params);
    var videos = filterVideosForEpisode(rawVideos, params);
    if (!videos.length && rawVideos.length && !zzWantedEpisode(params)) {
      console.warn("[zhizhen] baidu title filter fallback", {
        rawCount: rawVideos.length,
        lineTitle: line && line.title || "",
        sample: episodeSummary(rawVideos, function (video) {
          return [video && video.vod_group, helperItemName(video)].filter(Boolean).join(" ");
        })
      });
      videos = sortItemsByEpisodeDesc(rawVideos, function (video) {
        return [video && video.vod_group, helperItemName(video)].filter(Boolean).join(" ");
      });
    }
    console.log("[zhizhen] baidu native videos", { rawCount: rawVideos.length, count: videos.length });
    var nativeMax = sourceLimitForPan("百度", params);
    var nativeOut = await baiduSourcesFromVideos(videos, line, params, uidPromise, nativeMax);
    console.log("[zhizhen] baidu native result", { count: nativeOut.length, ms: Date.now() - baiduStartedAt });
    return nativeOut;
  }
  if (!helper || typeof helper.getShareData !== "function" || typeof helper.getAppShareUrl !== "function") {
    console.warn("[zhizhen] baidu helper unavailable");
    return [];
  }
  var data = await helper.getShareData(line.shareUrl);
  var rawItems = flattenBaiduItems(data);
  var items = filterHelperItemsForEpisode(rawItems, params, line.title);
  if (!items.length && rawItems.length && !zzWantedEpisode(params)) {
    console.warn("[zhizhen] baidu helper title filter fallback", { rawCount: rawItems.length, lineTitle: line && line.title || "" });
    items = rawItems.filter(function (item) { return isPlayableVideoName(helperItemName(item)); });
  }
  var maxFiles = sourceLimitForPan("百度", params);
  var out = [];
  for (var i = 0; i < items.length && out.length < maxFiles; i++) {
    var item = items[i] || {};
    var name = helperItemName(item);
    var size = helperItemSize(item);
    var path = item.path || item.Path || "";
    var uk = item.uk || item.ukey || item.user_id || item.userId || "";
    var shareId = item.shareid || item.share_id || item.shareId || "";
    var fsId = item.fsid || item.fs_id || item.fsId || item.id || "";
    if (!path || !uk || !shareId || !fsId) {
      console.warn("[zhizhen] baidu item missing fields:", { hasPath: !!path, hasUk: !!uk, hasShareId: !!shareId, hasFsId: !!fsId });
      continue;
    }
    var url = await helper.getAppShareUrl(path, uk, shareId, fsId);
    if (!url) continue;
    var desc = [line.title, name, size ? "大小: " + size : "", line.shareUrl].filter(Boolean).join("\n");
    var source = await sourceFromDirect("至臻[盘] 百度 " + name + (size ? " " + size : ""), url, desc, baiduPlaybackHeaders(params), params, { name: name, size: helperItemSizeNumber(item) });
    if (source) out.push(source);
  }
  console.log("[zhizhen] baidu direct result", { count: out.length, ms: Date.now() - baiduStartedAt });
  return out;
}

async function resolveWithHelpers(line, params) {
  var type = line && (line.panType || detectPanType(line.shareUrl));
  if (type !== "百度") return [];
  try {
    return await resolveBaiduDirect(line, params);
  } catch (e) {
    console.warn("[zhizhen] baidu resolve failed:", e && e.message || e);
    return [];
  }
}

function fallbackSource(line, params) {
  return [];
}

async function resolveLine(line, params) {
  var sources = await resolvePlayableLine(line, params || {});
  return sources.length ? sources : fallbackSource(line, params || {});
}

async function resolvePlayableLine(line, params) {
  if (/^https?:\/\/.+\.(?:m3u8|mp4|mkv|mov|webm)(?:\?|$)/i.test(line.shareUrl)) {
    return [sourceFromUrl("至臻[盘] 直链", line.shareUrl, line.title)];
  }
  return resolveWithHelpers(line, params || {});
}

function zzSourceKey(source) {
  source = source || {};
  return source.name || source.description || source.url || "";
}

function filterLinesForEpisode(lines, params) {
  var wantEp = zzWantedEpisode(params);
  if (!wantEp) return lines;
  var matched = lines.filter(function (line) {
    var ep = zzExtractEpisode(line.title);
    return ep && ep === wantEp;
  });
  return matched.length ? matched : lines;
}

function buildSearchKeywords(params) {
  params = params || {};
  var keys = [];
  function add(v) {
    v = zzCleanTitle(v);
    if (v && keys.indexOf(v) < 0) keys.push(v);
  }
  var baseTitles = [];
  function addBase(v) {
    v = zzCleanTitle(v);
    if (v && baseTitles.indexOf(v) < 0) baseTitles.push(v);
  }
  if (params.tmdbInfo) {
    addBase(params.tmdbInfo.title || params.tmdbInfo.name);
    addBase(params.tmdbInfo.originalTitle || params.tmdbInfo.originalName);
  }
  addBase(params.seriesName);
  addBase(params.title);
  addBase(params.name);
  var wantEp = zzWantedEpisode(params);
  var fast = fastLoadEnabled(params);
  if (wantEp && !fast) {
    for (var bi = 0; bi < baseTitles.length; bi++) {
      add(baseTitles[bi] + " 第" + wantEp + "集");
      add(baseTitles[bi] + " " + wantEp);
    }
  }
  for (var bj = 0; bj < baseTitles.length; bj++) add(baseTitles[bj]);
  if (wantEp && fast) {
    for (var fk = 0; fk < baseTitles.length; fk++) {
      add(baseTitles[fk] + " 第" + wantEp + "集");
      add(baseTitles[fk] + " " + wantEp);
    }
  }
  add(params.episodeName);
  add(searchKeywordFromParams(params));
  return keys;
}

function searchKeywordFromParams(params) {
  params = params || {};
  return zzText(params.keyword || params.searchWord || params.search_word || params.search_query
    || params.query || params.q || params.wd || params.text || "");
}

function debugParamsSummary(params) {
  params = params || {};
  var keys = [];
  for (var k in params) {
    if (Object.prototype.hasOwnProperty.call(params, k)) keys.push(k);
  }
  keys.sort();
  var interesting = [
    "title", "seriesName", "name", "type", "season", "tmdbId", "imdbId",
    "duration", "durationText", "durationSeconds", "runtime", "runtimeMinutes",
    "episode", "episodeNumber", "episode_number",
    "episodeNo", "episodeIndex", "episodeSort", "currentEpisode", "playEpisode",
    "ep", "sort", "episodeName", "episodeTitle", "subtitle", "remark", "link", "id",
    "quality_tag", "tmdbInfo", "mediaInfo", "episodeInfo", "selectedEpisode",
    "mediaSource", "mediaSources", "currentProvider", "currentResolutionInfo"
  ];
  var values = {};
  for (var i = 0; i < interesting.length; i++) {
    var key = interesting[i];
    if (!Object.prototype.hasOwnProperty.call(params, key)) continue;
    var value = params[key];
    if (/cookie|token|ut/i.test(key)) {
      values[key] = value ? "[set]" : "";
    } else if (value && typeof value === "object") {
      try { values[key] = JSON.stringify(value).slice(0, 220); } catch (e) { values[key] = "[object]"; }
    } else {
      values[key] = zzText(value).slice(0, 120);
    }
  }
  return { keys: keys.join(","), values: values };
}

async function search(params) {
  params = params || {};
  zzSyncParams(params);
  var keyword = searchKeywordFromParams(params);
  if (!keyword) return [];
  return zzSearchAll(keyword, params);
}

async function loadDetail(link) {
  var params = ZZ_RUNTIME_PARAMS || {};
  var detail = await zzLoadDetailObject(link, params);
  var lines = preferredOnlyLines(filterLinesForEpisode(detail.lines || [], params), params);
  var childItems = [];
  var seenSources = {};
  var seenSourceSizes = {};
  var panCounts = {};
  for (var i = 0; i < lines.length; i++) {
    var panType = lines[i] && (lines[i].panType || detectPanType(lines[i].shareUrl)) || "";
    if ((panCounts[panType] || 0) >= sourceLimitForPan(panType, params)) continue;
    var sources = await resolvePlayableLine(lines[i], params);
    for (var si = 0; si < sources.length; si++) {
      if ((panCounts[panType] || 0) >= sourceLimitForPan(panType, params)) break;
      var key = zzSourceKey(sources[si]);
      if (seenSources[key]) continue;
      var sizeKey = sourceSizeDedupeKey(sources[si]);
      if (sizeKey && seenSourceSizes[sizeKey]) continue;
      seenSources[key] = true;
      if (sizeKey) seenSourceSizes[sizeKey] = true;
      panCounts[panType] = (panCounts[panType] || 0) + 1;
      childItems.push({
        id: sources[si].id || String(link) + "#" + i + "." + si,
        type: "url",
        title: sources[si].name,
        name: sources[si].name,
        video: sources[si].video,
        audio: sources[si].audio,
        fileName: sources[si].fileName,
        FileName: sources[si].FileName,
        filename: sources[si].filename,
        file_name: sources[si].file_name,
        server_filename: sources[si].server_filename,
        originalFileName: sources[si].originalFileName,
        serverFileName: sources[si].serverFileName,
        subTitle: sources[si].subTitle,
        subtitle: sources[si].subtitle,
        remark: sources[si].remark,
        description: sources[si].description,
        quality: sources[si].quality,
        qualityName: sources[si].qualityName,
        qualityLabel: sources[si].qualityLabel,
        qualityTitle: sources[si].qualityTitle,
        label: sources[si].label,
        format: sources[si].format,
        resolution: sources[si].resolution,
        resolutionText: sources[si].resolutionText,
        renderSize: sources[si].renderSize,
        renderSizeText: sources[si].renderSizeText,
        width: sources[si].width,
        height: sources[si].height,
        url: sources[si].url,
        link: sources[si].link || sources[si].url,
        videoUrl: sources[si].url,
        header: sources[si].header,
        headers: sources[si].headers,
        customHeaders: sources[si].customHeaders,
        fastPlayMode: sources[si].fastPlayMode,
        fastplay: sources[si].fastplay,
        speedup: sources[si].speedup,
        speedupEnabled: sources[si].speedupEnabled,
        multiThread: sources[si].multiThread,
        multiThreadMode: sources[si].multiThreadMode,
        isMulti: sources[si].isMulti,
        isVideo: sources[si].isVideo,
        threads: sources[si].threads,
        thread: sources[si].thread,
        threadCount: sources[si].threadCount,
        threadNum: sources[si].threadNum,
        downloadThreads: sources[si].downloadThreads,
        downloadThreadCount: sources[si].downloadThreadCount,
        maxThreadCount: sources[si].maxThreadCount,
        poolSize: sources[si].poolSize,
        chunkSize: sources[si].chunkSize,
        chunk_size: sources[si].chunk_size,
        chunk: sources[si].chunk,
        segmentSize: sources[si].segmentSize,
        downloadChunkSize: sources[si].downloadChunkSize,
        rangeSize: sources[si].rangeSize,
        dataSize: sources[si].dataSize,
        realSize: sources[si].realSize,
        RealSize: sources[si].RealSize,
        actualSize: sources[si].actualSize,
        ActualSize: sources[si].ActualSize,
        actualFileSize: sources[si].actualFileSize,
        fileRealSize: sources[si].fileRealSize,
        sourceSize: sources[si].sourceSize,
        originalSize: sources[si].originalSize,
        size: sources[si].size,
        fileSize: sources[si].fileSize,
        file_size: sources[si].file_size,
        videoFileSize: sources[si].videoFileSize,
        videoFileSizeText: sources[si].videoFileSizeText,
        resolutionVideoFileSize: sources[si].resolutionVideoFileSize,
        maxFileSize: sources[si].maxFileSize,
        isFirstFileSize: sources[si].isFirstFileSize,
        bitrate: sources[si].bitrate,
        bitRate: sources[si].bitRate,
        BitRate: sources[si].BitRate,
        Bitrate: sources[si].Bitrate,
        videoRate: sources[si].videoRate,
        videoBitRate: sources[si].videoBitRate,
        videoBitrate: sources[si].videoBitrate,
        videoBitRateText: sources[si].videoBitRateText,
        bitrateLabel: sources[si].bitrateLabel,
        videoPixelSize: sources[si].videoPixelSize,
        videoTitle: sources[si].videoTitle,
        videoRange: sources[si].videoRange,
        VideoRange: sources[si].VideoRange,
        videoRangeScore: sources[si].videoRangeScore,
        resolutionId: sources[si].resolutionId,
        mediaSourceId: sources[si].mediaSourceId,
        MediaSourceId: sources[si].MediaSourceId,
        mediaSource: sources[si].mediaSource,
        MediaSource: sources[si].MediaSource,
        mediaSources: sources[si].mediaSources,
        MediaSources: sources[si].MediaSources,
        mediaStreams: sources[si].mediaStreams,
        MediaStreams: sources[si].MediaStreams,
        RunTimeTicks: sources[si].RunTimeTicks,
        runTimeTicks: sources[si].runTimeTicks,
        providerId: sources[si].providerId,
        sourceId: sources[si].sourceId,
        sourceType: sources[si].sourceType,
        isBest: sources[si].isBest,
        _isBest: sources[si]._isBest,
        isResolutionChecked: sources[si].isResolutionChecked,
        playerType: sources[si].playerType || "system"
      });
    }
  }
  detail.childItems = sortSourcesByPan(childItems, params);
  delete detail.lines;
  return detail;
}

async function resolveDeferredResource(params, link) {
  var route = zzParseResolveLink(link);
  if (!route) return [];
  var line = {
    title: route.title || route.detailTitle || "至臻[盘]",
    shareUrl: route.shareUrl,
    panType: route.panType || detectPanType(route.shareUrl)
  };
  console.log("[zhizhen] deferred resolve", { panType: line.panType, title: line.title || "" });
  var sources = await resolvePlayableLine(line, params || {});
  for (var i = 0; i < sources.length; i++) {
    sources[i].description = withMediaTagsFirst(sources[i], [
      route.keyword ? "搜索词: " + route.keyword : "",
      route.detailTitle ? "命中: " + route.detailTitle : ""
    ]);
  }
  return sources;
}

function resourceCacheKey(params, panType) {
  params = params || {};
  return [
    WidgetMetadata && WidgetMetadata.version || "",
    "百度",
    params.title || "",
    params.seriesName || "",
    params.name || "",
    params.episodeName || "",
    zzWantedEpisode(params) || params.episode || "",
    ZZ_PRIMARY_HOST,
    ZZ_DEFAULT_PAN_HOSTS.join(","),
    ZZ_BUILTIN_BAIDU_MAX_FILES,
    ZZ_BUILTIN_CANDIDATE_SCAN_LIMIT,
    ZZ_BUILTIN_SEARCH_EXTRA_AFTER_HIT,
    ZZ_BUILTIN_LOAD_SPEED_MODE,
    ZZ_BUILTIN_QUALITY_TAG,
    !!baiduCookie(params)
  ].join("||");
}

function sourcePanType(source) {
  source = source || {};
  return source.panType || sourcePanLabel(source.displayName || source.name || source.title || "");
}

function sourceSizeNumber(source) {
  source = source || {};
  return Number(
    source.realSize || source.RealSize || source.actualSize || source.ActualSize ||
    source.actualFileSize || source.fileRealSize || source.sourceSize || source.originalSize ||
    source.size || source.fileSize || source.file_size || source.videoFileSize ||
    source.resolutionVideoFileSize || source.maxFileSize || 0
  ) || 0;
}

function sourceSizeDedupeKey(source) {
  var size = sourceSizeNumber(source);
  return size > 0 ? String(Math.round(size)) : "";
}

function sourceDebugSummary(source) {
  source = source || {};
  var url = String(source.url || source.videoUrl || "");
  var host = "";
  try { host = new URL(url.split("#")[0]).host; } catch (e) {}
  return {
    name: source.name || source.title || "",
    fileName: source.fileName || source.filename || source.file_name || source.server_filename || "",
    host: host,
    realSize: source.realSize || source.actualSize || source.sourceSize || 0,
    displaySize: source.size || source.fileSize || source.videoFileSize || 0,
    hasFilenameHint: /(?:^|[&#])(?:filename|fileName|server_filename)=/i.test(url),
    resolutionId: source.resolutionId || "",
    video: source.video || null,
    audio: source.audio || null,
    playerType: source.playerType || ""
  };
}

function sortSourcesByPan(sources, params) {
  return (Array.isArray(sources) ? sources : []).slice().sort(function (a, b) {
    var panDelta = panPriority(sourcePanType(a), params) - panPriority(sourcePanType(b), params);
    if (panDelta) return panDelta;
    return sourceSizeNumber(b) - sourceSizeNumber(a);
  });
}

async function loadResourceForPan(params, panType) {
  return loadResourceAll(params || {}, "百度");
}

async function loadBaiduResource(params) {
  return loadResourceForPan(params, "百度");
}

async function loadResource(params) {
  return loadResourceForPan(params, "百度");
}

async function loadResourceAll(params, panType) {
  params = params || {};
  zzSyncParams(params);
  panType = "百度";
  var key = resourceCacheKey(params, panType);
  var cached = zzCacheGet(ZZ_RESOURCE_CACHE, key);
  if (cached) return cached;
  var promise = loadResourceUncached(Object.assign({}, params), panType).catch(function (e) {
    delete ZZ_RESOURCE_CACHE[key];
    throw e;
  });
  return zzCacheSet(ZZ_RESOURCE_CACHE, key, promise);
}

function addSearchCandidates(results, keyword, params, candidates, seenCandidate, scanLimit) {
  var before = candidates.length;
  var ranked = zzRankItems(results || [], params, keyword);
  for (var ri = 0; ri < ranked.length && candidates.length < scanLimit; ri++) {
    var item = ranked[ri] || {};
    var cKey = item.link || item.id || item.title || "";
    if (!cKey || seenCandidate[cKey]) continue;
    seenCandidate[cKey] = true;
    item._zzKeyword = keyword;
    candidates.push(item);
  }
  return candidates.length - before;
}

async function searchKeywordForResource(keyword, params) {
  var searchStartedAt = Date.now();
  var searchParams = Object.assign({}, params || {}, { _zzHttpTimeoutMs: ZZ_RESOURCE_SEARCH_TIMEOUT_MS });
  var results = await zzSearchAll(keyword, searchParams);
  console.log("[zhizhen] search", {
    keyword: keyword,
    count: results.length,
    ms: Date.now() - searchStartedAt,
    timeoutMs: ZZ_RESOURCE_SEARCH_TIMEOUT_MS
  });
  return { keyword: keyword, results: results };
}

async function searchCandidatesForResource(keywords, params, scanLimit) {
  var startedAt = Date.now();
  var fast = fastLoadEnabled(params);
  var seenCandidate = {};
  console.log("[zhizhen] keyword search concurrent", {
    mode: loadSpeedMode(params),
    concurrency: keywords.length,
    timeoutMs: ZZ_RESOURCE_SEARCH_TIMEOUT_MS
  });
  var tasks = keywords.map(function (keyword, index) {
    return searchKeywordForResource(keyword, params).then(function (result) {
      result.index = index;
      return result;
    }).catch(function (e) {
      console.warn("[zhizhen] search failed", { keyword: keyword, message: e && e.message || String(e) });
      return { keyword: keyword, results: [], index: index };
    });
  });

  if (fast) {
    return new Promise(function (resolve) {
      var done = false;
      var pending = tasks.length;
      var completed = [];
      function finish(payload) {
        if (done) return;
        done = true;
        resolve(payload);
      }
      tasks.forEach(function (task) {
        task.then(function (result) {
          completed[result.index] = result;
          var candidates = [];
          var localSeen = {};
          addSearchCandidates(result.results, result.keyword, params, candidates, localSeen, scanLimit);
          if (candidates.length) {
            console.log("[zhizhen] stop keyword search after hit", {
              keyword: result.keyword,
              candidateCount: candidates.length,
              concurrent: true,
              ms: Date.now() - startedAt
            });
            finish({ candidates: candidates, usedKeyword: result.keyword });
          }
        }).then(function () {
          pending--;
          if (pending <= 0 && !done) {
            var fallback = [];
            for (var i = 0; i < completed.length && fallback.length < scanLimit; i++) {
              if (!completed[i]) continue;
              addSearchCandidates(completed[i].results, completed[i].keyword, params, fallback, seenCandidate, scanLimit);
            }
            finish({ candidates: fallback, usedKeyword: fallback[0] && fallback[0]._zzKeyword || "" });
          }
        });
      });
    });
  }

  var all = await Promise.all(tasks);
  all.sort(function (a, b) { return a.index - b.index; });
  var candidates = [];
  for (var i = 0; i < all.length && candidates.length < scanLimit; i++) {
    addSearchCandidates(all[i].results, all[i].keyword, params, candidates, seenCandidate, scanLimit);
  }
  return { candidates: candidates, usedKeyword: candidates[0] && candidates[0]._zzKeyword || "" };
}

async function loadResourceUncached(params, targetPanType) {
  var startedAt = Date.now();
  params = params || {};
  targetPanType = "百度";
  params._zzResourceLoad = true;
  zzSyncParams(params);
  if (targetPanType && !panEnabled(targetPanType, params)) {
    console.log("[zhizhen] loadResource skipped disabled pan", { targetPanType: targetPanType });
    return [];
  }
  var keywords = buildSearchKeywords(params);
  var speedMode = loadSpeedMode(params);
  var extraAfterHit = searchExtraAfterHit(params);
  console.log("[zhizhen] loadResource", {
    targetPanType: targetPanType,
    title: params.title || params.seriesName || params.name || "",
    episode: zzWantedEpisode(params) || params.episode || "",
    paramsSummary: debugParamsSummary(params),
    keywords: keywords.join("|"),
    keywordCount: keywords.length,
    hasBaiduCookie: !!baiduCookie(params),
    enableBaidu: panEnabled("百度", params),
    hasBaiduHelper: helperAvailable("Baidu2") || helperAvailable("Baidu"),
    speedMode: speedMode,
    scanLimit: candidateScanLimit(params),
    extraAfterHit: extraAfterHit
  });
  if (!keywords.length) return [];

  var candidates = [];
  var usedKeyword = "";
  var scanLimit = candidateScanLimit(params);
  var searchResult = await searchCandidatesForResource(keywords, params, scanLimit);
  candidates = searchResult.candidates || [];
  usedKeyword = searchResult.usedKeyword || "";
  if (!candidates.length) {
    console.log("[zhizhen] no best match");
    return [];
  }
  console.log("[zhizhen] candidates", { keyword: usedKeyword, count: candidates.length, scanLimit: scanLimit });

  var out = [];
  var seenSources = {};
  var seenSourceSizes = {};
  var panCounts = {};
  var lastNewCandidateIndex = -1;
  var scannedCandidates = 0;
  for (var ci = 0; ci < candidates.length; ci++) {
    var best = candidates[ci];
    if (!best || !best.link) continue;
    var beforeCandidateCount = out.length;
    var detailStartedAt = Date.now();
    var detail = await zzLoadDetailObject(best.link, params);
    var detailMs = Date.now() - detailStartedAt;
    var sourceKeyword = best._zzKeyword || usedKeyword;
    var rawLines = filterLinesForEpisode(detail.lines || [], params);
    if (targetPanType) {
      rawLines = rawLines.filter(function (line) {
        return (line && (line.panType || detectPanType(line.shareUrl)) || "") === targetPanType;
      });
    }
    var lines = preferredOnlyLines(rawLines, params);
    console.log("[zhizhen] detail lines", {
      title: detail.title || "",
      source: zzOrigin(best.link),
      rawCount: rawLines.length,
      rawPanTypes: panTypesSummary(rawLines),
      count: lines.length,
      panTypes: panTypesSummary(lines),
      ms: detailMs
    });
    var lineConcurrency = fastLoadEnabled(params) ? 1 : BAIDU_DIRECT_CONCURRENCY_FULL;
    if (lines.length) {
      console.log("[zhizhen] line resolve concurrency", {
        mode: loadSpeedMode(params),
        concurrency: lineConcurrency,
        lines: lines.length
      });
    }
    for (var li = 0; li < lines.length;) {
      var jobs = [];
      var reservedPanCounts = {};
      while (li < lines.length && jobs.length < lineConcurrency) {
        var line = lines[li++];
        var jobPanType = line && (line.panType || detectPanType(line.shareUrl)) || "";
        var panLimit = sourceLimitForPan(jobPanType, params);
        var reserved = reservedPanCounts[jobPanType] || 0;
        if ((panCounts[jobPanType] || 0) + reserved >= panLimit) {
          console.log("[zhizhen] skip pan limit", { panType: jobPanType, title: detail.title || "", limit: panLimit });
          continue;
        }
        reservedPanCounts[jobPanType] = reserved + 1;
        jobs.push({ line: line, panType: jobPanType });
      }
      if (!jobs.length) continue;
      var resolvedJobs = await Promise.all(jobs.map(function (job) {
        var resolveStartedAt = Date.now();
        return resolvePlayableLine(job.line, params).then(function (sources) {
          console.log("[zhizhen] resolved pan", { panType: job.panType, sourceCount: sources.length, ms: Date.now() - resolveStartedAt });
          return { line: job.line, panType: job.panType, sources: sources || [] };
        }).catch(function (e) {
          console.warn("[zhizhen] resolved pan failed", { panType: job.panType, message: e && e.message || String(e) });
          return { line: job.line, panType: job.panType, sources: [] };
        });
      }));
      for (var rj = 0; rj < resolvedJobs.length; rj++) {
        var resolved = resolvedJobs[rj] || {};
        var panType = resolved.panType || "";
        var sources = resolved.sources || [];
        if (!fastLoadEnabled(params) && !sources.length && resolved.line) {
          var retryStartedAt = Date.now();
          sources = await resolvePlayableLine(resolved.line, params).catch(function (e) {
            console.warn("[zhizhen] resolved pan retry failed", { panType: panType, message: e && e.message || String(e) });
            return [];
          });
          console.log("[zhizhen] resolved pan retry", { panType: panType, sourceCount: sources.length, ms: Date.now() - retryStartedAt });
        }
        for (var si = 0; si < sources.length; si++) {
          if ((panCounts[panType] || 0) >= sourceLimitForPan(panType, params)) break;
          sources[si].description = withMediaTagsFirst(sources[si], [
            "搜索词: " + usedKeyword,
            sourceKeyword && sourceKeyword !== usedKeyword ? "命中词: " + sourceKeyword : "",
            "来源: " + (zzOrigin(best.link) || ""),
            "命中: " + (detail.title || best.title || "")
          ]);
          var key = zzSourceKey(sources[si]);
          if (seenSources[key]) continue;
          var sizeKey = sourceSizeDedupeKey(sources[si]);
          if (sizeKey && seenSourceSizes[sizeKey]) {
            console.log("[zhizhen] skip duplicate size", {
              size: zzCompactSizeText(zzSizeText(sourceSizeNumber(sources[si]))),
              name: sources[si].name || ""
            });
            continue;
          }
          seenSources[key] = true;
          if (sizeKey) seenSourceSizes[sizeKey] = true;
          panCounts[panType] = (panCounts[panType] || 0) + 1;
          out.push(sources[si]);
        }
      }
    }
    scannedCandidates++;
    if (out.length > beforeCandidateCount) lastNewCandidateIndex = ci;
    if (panLimitsReached(panCounts, params, targetPanType)) {
      console.log("[zhizhen] stop pan limits reached", { scanned: scannedCandidates, panCounts: panCounts });
      break;
    }
    if (lastNewCandidateIndex >= 0 && (extraAfterHit === 0 || ci > lastNewCandidateIndex) && ci - lastNewCandidateIndex >= extraAfterHit) {
      console.log("[zhizhen] stop after hit window", {
        scanned: scannedCandidates,
        extraAfterHit: extraAfterHit,
        lastNewCandidateIndex: lastNewCandidateIndex,
        panCounts: panCounts
      });
      break;
    }
  }
  out = sortSourcesByPan(out, params);
  console.log("[zhizhen] loadResource result", {
    count: out.length,
    panTypes: panTypesSummary(out),
    scanned: scannedCandidates,
    ms: Date.now() - startedAt,
    sources: out.slice(0, 6).map(sourceDebugSummary)
  });
  return out;
}

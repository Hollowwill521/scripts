WidgetMetadata = {
  id: "forward.zhizhen.uc",
  title: "UC网盘",
  version: "1.0.3",
  requiredVersion: "0.0.1",
  description: "搜索至臻[盘]影视资源，解析 UC 网盘分享并返回可播放源。",
  author: "TG@Hollowwill",
  site: "https://t.me/Hollowwill_Q",
  detailCacheDuration: 3600,
  globalParams: [
    { name: "host", title: "站点地址", type: "input", value: "https://www.miqk.cc" },
    { name: "pan_hosts", title: "备用网盘站", type: "input", value: "https://mihdr.top,https://www.2xiaopan.top" },
    { name: "uc_cookie", title: "UC Cookie", type: "input", value: "" },
    { name: "uc_token", title: "UC Token", type: "input", value: "" },
    {
      name: "uc_play_mode",
      title: "UC 播放模式",
      type: "enumeration",
      value: "openapi",
      enumOptions: [
        { title: "OpenAPI 最清晰", value: "openapi" },
        { title: "原文件优先", value: "original" },
        { title: "只用转码", value: "transcode" }
      ]
    },
    { name: "uc_token_warn_hours", title: "UC Token 到期提醒(小时)", type: "input", value: "72" },
    { name: "uc_temp_dir", title: "UC 临时目录", type: "input", value: "ForwardZZPanTemp" },
    { name: "uc_max_files", title: "UC 最多解析", type: "input", value: "2" },
    { name: "search_extra_after_hit", title: "命中后继续扫描", type: "input", value: "3" },
    {
      name: "load_speed_mode",
      title: "加载速度",
      type: "enumeration",
      value: "fast",
      enumOptions: [
        { title: "极速（找到一个就返回）", value: "fast" },
        { title: "普通（返回多个大小）", value: "full" }
      ]
    },
    {
      name: "quality_tag",
      title: "清晰度标签",
      type: "enumeration",
      value: "8k",
      enumOptions: [
        { title: "8K", value: "8k" },
        { title: "4K", value: "4k" },
        { title: "1080P", value: "1080p" },
        { title: "其他", value: "other" }
      ]
    },
    { name: "fallbackMode", title: "无解析器时", type: "enumeration", value: "hide", enumOptions: [{ title: "隐藏线路", value: "hide" }] }
  ],
  modules: [
    {
      id: "loadResource",
      title: "UC网盘",
      description: "按当前影片详情自动搜索至臻[盘]并返回 UC 网盘播放源",
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
var ZZ_DEFAULT_PAN_HOSTS = ["https://www.miqk.cc", "https://woog.nxog.eu.org", "https://www.2xiaopan.top"];
var ZZ_BUILTIN_QUALITY_TAG = "8k";
var ZZ_CACHE_TTL_MS = 3600 * 1000;
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
  return String((params && params.host) || ZZ_RUNTIME_PARAMS.host || "https://mihdr.top").replace(/\/+$/, "");
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
  var configured = zzSplitHosts((params && params.pan_hosts) || ZZ_RUNTIME_PARAMS.pan_hosts || "");
  if (!configured.length) configured = ZZ_DEFAULT_PAN_HOSTS;
  for (var i = 0; i < configured.length; i++) add(configured[i]);
  return out;
}

function loadSpeedMode(params) {
  var value = zzText((params && params.load_speed_mode) || ZZ_RUNTIME_PARAMS.load_speed_mode || "fast").toLowerCase();
  return /^(full|complete|all|slow|off)$/i.test(value) ? "full" : "fast";
}

function fastLoadEnabled(params) {
  return loadSpeedMode(params) === "fast";
}

function fastResourceSearchEnabled(params) {
  return fastLoadEnabled(params) && !!(params && params._zzResourceLoad);
}

function resourceFirstEnabled(params) {
  var value = zzText((params && params.resource_first) || ZZ_RUNTIME_PARAMS.resource_first || "on").toLowerCase();
  return value !== "off";
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

function zzSizeText(bytes) {
  var n = Number(bytes || 0);
  if (!n || !Number.isFinite(n)) return "";
  var units = ["B", "KB", "MB", "GB", "TB"];
  var i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n = n / 1024;
    i++;
  }
  return (i ? n.toFixed(2) : String(Math.round(n))) + " " + units[i];
}

function zzCompactSizeText(text) {
  return zzText(text).replace(/\s+(B|KB|MB|GB|TB)$/i, "$1");
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
    timeout: 20000
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
  if (!ZZ_SEARCH_CACHE[key]) {
    ZZ_SEARCH_CACHE[key] = zzGetHtml(zzSearchUrl(keyword, page, params), params)
      .then(function (html) { return zzParseSearch(html, params); });
  }
  return ZZ_SEARCH_CACHE[key];
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
  if (fastResourceSearchEnabled(params) && !needsCompleteHostSearch(params)) return zzSearchFastHosts(keyword, params, hosts);
  var tasks = hosts.map(function (host) {
    return zzSearch(keyword, zzParamsForHost(params, host)).catch(function (e) {
      console.warn("[zhizhen] pan host search failed:", host, e && e.message || e);
      return [];
    });
  });
  return zzDedupeSearchItems(await Promise.all(tasks));
}

function needsCompleteHostSearch(params) {
  if (!params || !params._zzResourceLoad) return false;
  var pans = resolvableTargetPans(params, params._zzTargetPanType || "");
  return pans.indexOf("UC") >= 0;
}

function zzScoreItem(item, params, keyword) {
  var wantTitle = params.seriesName || params.title || params.name || keyword || "";
  var wantNorm = zzNorm(wantTitle);
  var itemNorm = zzNorm(item.title);
  var qualityText = [item.title, item.description, item.remark, item.desc].filter(Boolean).join(" ");
  var score = 0;
  if (wantNorm && itemNorm === wantNorm) score += 100;
  if (wantNorm && (itemNorm.indexOf(wantNorm) >= 0 || wantNorm.indexOf(itemNorm) >= 0)) score += 40;
  var wantYear = String(params.premiereDate || params.releaseDate || params.year || "").slice(0, 4) || zzYear(wantTitle);
  if (wantYear && item.description && item.description.indexOf(wantYear) >= 0) score += 10;
  if (/真彩|臻彩|4K|HDR|高码|杜比|Dolby|DV/i.test(qualityText)) score += 130;
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
    if (!share || seen[share]) return;
    seen[share] = true;
    lines.push({ title: lineTitle || title || "至臻[盘]", shareUrl: share, panType: detectPanType(share) });
  });

  if (!lines.length) {
    var linkRe = /(https?:\/\/(?:pan\.quark\.cn|drive\.uc\.cn|www\.aliyundrive\.com|www\.alipan\.com|pan\.baidu\.com|cloud\.189\.cn|caiyun\.139\.com|www\.123pan\.com|www\.123684\.com)\/[^\s"'<>]+)/ig;
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
  if (!ZZ_DETAIL_CACHE[link]) {
    ZZ_DETAIL_CACHE[link] = zzGetHtml(link, detailParams).then(function (html) {
      return zzExtractDetail(html, link, detailParams);
    });
  }
  return ZZ_DETAIL_CACHE[link];
}

function detectPanType(url) {
  var u = String(url || "").toLowerCase();
  if (u.indexOf("pan.quark.cn") >= 0) return "夸克";
  if (u.indexOf("drive.uc.cn") >= 0 || /\.uc\./i.test(u)) return "UC";
  if (u.indexOf("aliyundrive.com") >= 0 || u.indexOf("alipan.com") >= 0) return "阿里";
  if (u.indexOf("pan.baidu.com") >= 0) return "百度";
  if (u.indexOf("cloud.189.cn") >= 0) return "天翼";
  if (u.indexOf("caiyun.139.com") >= 0) return "移动";
  if (u.indexOf("123pan.com") >= 0 || u.indexOf("123684.com") >= 0) return "123";
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
    .replace(/\s+\d+(?:\.\d+)?\s*(?:B|KB|MB|GB|TB)$/i, "")
    .trim();
  var pan = sourcePanLabel(s);
  return pan || s;
}

function sourceSizeText(name, description, meta) {
  if (meta && Number(meta.size || 0) > 0) return zzSizeText(meta.size);
  var text = [description, name].filter(Boolean).join("\n");
  var m = text.match(/大小[:：]\s*([0-9.]+\s*(?:B|KB|MB|GB|TB))/i);
  if (m) return zzText(m[1]);
  m = zzText(name).match(/\s([0-9.]+\s*(?:B|KB|MB|GB|TB))$/i);
  return m ? zzText(m[1]) : "";
}

function sourcePanLabel(name) {
  var s = zzText(name);
  if (/百度/.test(s)) return "百度";
  if (/夸克/.test(s)) return "夸克";
  if (/UC/i.test(s)) return "UC";
  if (/天翼/.test(s)) return "天翼";
  if (/123/.test(s)) return "123";
  if (/移动/.test(s)) return "移动";
  if (/阿里/.test(s)) return "阿里";
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
    .replace(/大小[:：]\s*[0-9.]+\s*(?:B|KB|MB|GB|TB)/ig, " ")
    .replace(/\b[0-9.]+\s*(?:B|KB|MB|GB|TB)\b/ig, " ")
    .replace(/\.(?:mp4|mkv|avi|mov|m4v|ts|m2ts|flv|wmv|webm|rmvb)\b/ig, " ")
    .replace(/\bH\.?26[45]\b/ig, " ");
  return zzExtractEpisode(text);
}

function sourceEpisodeText(name, description, meta) {
  var ep = sourceEpisodeNumber(name, description, meta);
  return ep > 0 ? "第" + ep + "集" : "";
}

function sourceQualityConfig(params) {
  params = params || ZZ_RUNTIME_PARAMS || {};
  var value = zzText(params.quality_tag || params.qualityTag || params.display_quality || params.source_quality || ZZ_BUILTIN_QUALITY_TAG).toLowerCase();
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
  var raw = zzText(meta.name || meta.fileName || meta.filename || meta.file_name || name || "zhizhen-video.mkv");
  raw = raw.split(/[\\/]/).pop();
  raw = raw.replace(/^至臻\[盘\]\s*(?:百度|夸克|UC|天翼|123|移动|阿里)?\s*/i, "").replace(/\s+\d+(?:\.\d+)?\s*(?:KB|MB|GB|TB)$/i, "");
  raw = raw.replace(/[\u0000-\u001f]+/g, " ").trim();
  if (!raw) raw = "zhizhen-video.mkv";
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

function buildSyntheticMediaStreams(item, name, meta, params) {
  meta = meta || {};
  params = params || {};
  var quality = sourceActualQualityConfig(name, "", meta);
  var realSize = sourceRealSize(meta, item);
  var dataSize = sourceDataSize(meta, item);
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
    videoRangeType: video.dynamicRange || undefined
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
  var panLabel = sourcePanLabel(item.displayName || name);
  var provider = panLabel === "百度" ? "baidu" : (panLabel === "夸克" ? "quark" : (panLabel === "UC" ? "uc" : "zhizhen"));
  var mediaSourceId = item.id || [provider, size || "", item.url || ""].join("|");
  var dataSizeText = sourceDataSizeText(size);
  var fileName = playbackFileName(name, meta);
  var mediaSource = {
    Id: mediaSourceId,
    id: mediaSourceId,
    Name: item.displayName || sourceDisplayName(name) || panLabel,
    name: item.displayName || sourceDisplayName(name) || panLabel,
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
  item.providerId = provider;
  item.sourceId = provider;
  item.sourceType = "stream";
  return item;
}

function fastPlayConfigForName(name, params) {
  var s = zzText(name);
  if (/夸克/.test(s)) {
    return {
      threads: zzBoundInt(params && params.quark_threads, 9, 1, 9),
      chunkSize: zzBoundInt(params && params.quark_chunk_size, 256, 64, 1024)
    };
  }
  if (/UC/i.test(s)) {
    return {
      threads: panFastPlayValue(params, "uc_threads", 128),
      chunkSize: panFastPlayValue(params, "uc_chunk_size", 128)
    };
  }
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
  var displayQualityText = qualityText || displayQuality.label || "";
  var cardName = [displayQualityText, episodeText, displaySizeText ? zzCompactSizeText(displaySizeText) : ""].filter(Boolean).join(" ");
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
  if (!meta.disableFastPlay) applyFastPlayFields(item, name, meta);
  applyResourceFirstFields(item, panLabel, cfgParams);
  item.id = [sourcePanLabel(displayName), displayName, sizeText, item.url || ""].filter(Boolean).join("|");
  applyMediaSourceFields(item, name, meta);
  return item;
}

function applyResourceFirstFields(item, panLabel, params) {
  if (!item || !resourceFirstEnabled(params)) return item;
  var panRank = panPriority(panLabel, params);
  var priority = 100000 - panRank * 1000;
  item.priority = priority;
  item.weight = priority;
  item.resourcePriority = priority;
  item.sourcePriority = priority;
  item.sortIndex = panRank;
  item.order = panRank;
  item.displayOrder = panRank;
  item.rank = panRank;
  item.pinned = true;
  item.pin = true;
  item.isPreferred = true;
  return item;
}

function playbackPlayerTypeForName(name, headers) {
  var s = zzText(name);
  if ((/夸克|UC/i.test(s)) && headers && headers.Cookie) return "app";
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

function playbackFlagsForName(name, params) {
  var s = zzText(name);
  if (/夸克/.test(s)) {
    var qCfg = fastPlayConfigForName("夸克", params);
    return "#isVideo=true&fastPlayMode=true&threads=" + qCfg.threads + "&chunkSize=" + qCfg.chunkSize;
  }
  if (/UC/i.test(s)) {
    var uCfg = fastPlayConfigForName("UC", params);
    return "#isVideo=true&fastPlayMode=true&threads=" + uCfg.threads + "&chunkSize=" + uCfg.chunkSize;
  }
  return "#isVideo=true#";
}

function appendPlaybackFlags(url, name, params) {
  var s = String(url || "");
  if (!s) return "";
  return s + (s.indexOf("#") >= 0 ? "" : playbackFlagsForName(name, params));
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
    return sourceFromRawUrl(name, appendPlaybackFlags(rawBaiduUrl, name, params), description, headers || null, meta);
  }
  if (/夸克|UC/i.test(zzText(name))) {
    var rawPanUrl = String(url || "").trim().replace(/ /g, "%20");
    return sourceFromRawUrl(name, appendPlaybackFlags(rawPanUrl, name, params), description, headers || null, meta);
  }
  var targetUrl = normalizePlaybackUrl(url);
  return sourceFromUrl(name, appendPlaybackFlags(targetUrl, name, params), description, headers || null, meta);
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

var QUARK_API = "https://drive-pc.quark.cn/1/clouddrive";
var QUARK_SOCIAL_API = "https://drive-social-api.quark.cn/1/clouddrive";
var QUARK_QUERY = "pr=ucpro&fr=pc";
var QUARK_TEMP_FID = "";
var QUARK_SAVED_FIDS = {};
var QUARK_SHARE_TOKENS = {};
var QUARK_SOCIAL_CONVERSATION = null;

function quarkCookie(params) {
  return zzText((params && (params.quark_cookie || params.quarkCookie))
    || ZZ_RUNTIME_PARAMS.quark_cookie || ZZ_RUNTIME_PARAMS.quarkCookie || "");
}

function quarkMiraPlayEnabled(params) {
  return zzText((params && params.quark_miraplay) || ZZ_RUNTIME_PARAMS.quark_miraplay || "off").toLowerCase() === "on";
}

function cookieToMap(cookie) {
  var out = {};
  String(cookie || "").split(";").forEach(function (part) {
    var p = part.trim();
    var eq = p.indexOf("=");
    if (eq <= 0) return;
    out[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
  });
  return out;
}

function cookieMapToString(map) {
  var out = [];
  for (var k in map) {
    if (Object.prototype.hasOwnProperty.call(map, k) && k) out.push(k + "=" + map[k]);
  }
  return out.join("; ");
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

function quarkMergeSetCookie(resp, params) {
  var setCookie = getHeaderValue(resp && resp.headers, "set-cookie");
  if (!setCookie) return;
  var current = cookieToMap(quarkCookie(params));
  var ignored = { "expires": true, "max-age": true, "domain": true, "path": true, "samesite": true, "secure": true, "httponly": true };
  String(Array.isArray(setCookie) ? setCookie.join(";") : setCookie).replace(/(?:^|[,;]\s*)([^=;,\s]+)=([^;,]*)/g, function (_, key, value) {
    if (!ignored[String(key).toLowerCase()]) current[key] = value;
    return "";
  });
  var merged = cookieMapToString(current);
  if (merged) {
    ZZ_RUNTIME_PARAMS.quark_cookie = merged;
    if (params) params.quark_cookie = merged;
  }
}

function quarkHeaders(params) {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/4.5.5.535 quark-cloud-drive/2.5.40 Channel/pckk_other_ch",
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "Origin": "https://pan.quark.cn",
    "Referer": "https://pan.quark.cn/",
    "Cookie": quarkCookie(params)
  };
}

function quarkPlaybackHeaders(params) {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/4.5.5.535 quark-cloud-drive/2.5.40 Channel/pckk_other_ch",
    "Origin": "https://pan.quark.cn",
    "Referer": "https://pan.quark.cn/",
    "Cookie": quarkCookie(params)
  };
}

function quarkApi(path) {
  return QUARK_API + "/" + path + (path.indexOf("?") >= 0 ? "&" : "?") + QUARK_QUERY;
}

function quarkSocialApi(path) {
  return QUARK_SOCIAL_API + "/" + path + (path.indexOf("?") >= 0 ? "&" : "?") + QUARK_QUERY;
}

function quarkJson(resp) {
  var data = resp && resp.data;
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch (e) { return {}; }
  }
  return data || {};
}

async function quarkGet(path, params) {
  var resp = await Widget.http.get(quarkApi(path), { headers: quarkHeaders(params), timeout: 30000 });
  quarkMergeSetCookie(resp, params);
  return quarkJson(resp);
}

async function quarkPost(path, body, params) {
  var resp = await Widget.http.post(quarkApi(path), JSON.stringify(body || {}), { headers: quarkHeaders(params), timeout: 30000 });
  quarkMergeSetCookie(resp, params);
  return quarkJson(resp);
}

async function quarkPostAbsolute(url, body, params, headers) {
  var resp = await Widget.http.post(url, JSON.stringify(body || {}), {
    headers: Object.assign({}, quarkHeaders(params), headers || {}),
    timeout: 30000
  });
  quarkMergeSetCookie(resp, params);
  return quarkJson(resp);
}

async function quarkSocialGet(path, params) {
  var resp = await Widget.http.get(quarkSocialApi(path), { headers: quarkHeaders(params), timeout: 30000 });
  quarkMergeSetCookie(resp, params);
  return quarkJson(resp);
}

async function quarkSocialPost(path, body, params) {
  var resp = await Widget.http.post(quarkSocialApi(path), JSON.stringify(body || {}), {
    headers: quarkHeaders(params),
    timeout: 30000
  });
  quarkMergeSetCookie(resp, params);
  return quarkJson(resp);
}

function zzUuidLike(seed) {
  var hex = md5Hex(String(seed || "") + ":" + Date.now() + ":" + Math.random());
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20, 32);
}

function quarkShareInfo(url) {
  var text = String(url || "");
  var m = text.match(/pan\.quark\.cn\/s\/([A-Za-z0-9_-]+)/i);
  if (!m) return null;
  var pwd = "";
  var pwdMatch = text.match(/(?:pwd|passcode|提取码)[:=：\s]*([A-Za-z0-9]+)/i);
  if (pwdMatch) pwd = pwdMatch[1];
  var folderId = "0";
  var folderMatch = text.match(/[#?&/](?:fid|folder|pdir_fid|path)=?([A-Za-z0-9_-]+)/i)
    || text.match(/\/list\/share\/([A-Za-z0-9_-]+)/i);
  if (folderMatch) folderId = folderMatch[1];
  return { shareId: m[1], sharePwd: pwd, folderId: folderId };
}

function quarkIsVideo(item) {
  var name = String(item && item.file_name || "").toLowerCase();
  return item && isPlayableVideoName(name) && (item.obj_category === "video" || ZZ_VIDEO_EXT_RE.test(name));
}

async function quarkShareToken(info, params) {
  if (QUARK_SHARE_TOKENS[info.shareId]) return QUARK_SHARE_TOKENS[info.shareId];
  var data = await quarkPost("share/sharepage/token", {
    pwd_id: info.shareId,
    passcode: info.sharePwd || ""
  }, params);
  var token = data && data.data && data.data.stoken;
  if (token) QUARK_SHARE_TOKENS[info.shareId] = token;
  return token || "";
}

async function quarkListShareVideos(info, params) {
  var stoken = await quarkShareToken(info, params);
  if (!stoken) return [];
  var videos = [];
  async function walk(fid, group, page) {
    var size = 100;
    var data = await quarkGet("share/sharepage/detail?pwd_id=" + encodeURIComponent(info.shareId)
      + "&stoken=" + encodeURIComponent(stoken)
      + "&pdir_fid=" + encodeURIComponent(fid || "0")
      + "&force=0&_page=" + encodeURIComponent(page || 1)
      + "&_size=" + size
      + "&_sort=file_type:asc,file_name:asc", params);
    var list = data && data.data && data.data.list || [];
    var total = data && data.metadata && data.metadata._total || list.length;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (item.dir === true) {
        await walk(item.fid, group ? group + "/" + item.file_name : item.file_name, 1);
      } else if ((item.file === true || item.type === "file") && quarkIsVideo(item) && Number(item.size || 0) >= 1024 * 1024 * 5) {
        item.stoken = stoken;
        item.vod_group = group || "";
        videos.push(item);
      }
    }
    if ((page || 1) < Math.ceil(total / size)) await walk(fid, group, (page || 1) + 1);
  }
  await walk(info.folderId || "0", "", 1);
  return videos;
}

async function quarkEnsureTempDir(params) {
  if (QUARK_TEMP_FID) return QUARK_TEMP_FID;
  var dirName = zzText(params && params.quark_temp_dir) || "ForwardZZPanTemp";
  var data = await quarkGet("file/sort?pdir_fid=0&_page=1&_size=200&_sort=file_type:asc,updated_at:desc", params);
  var list = data && data.data && data.data.list || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].dir === true && list[i].file_name === dirName) {
      QUARK_TEMP_FID = list[i].fid;
      return QUARK_TEMP_FID;
    }
  }
  data = await quarkPost("file", {
    pdir_fid: "0",
    file_name: dirName,
    dir_path: "",
    dir_init_lock: false
  }, params);
  QUARK_TEMP_FID = data && data.data && data.data.fid || "";
  return QUARK_TEMP_FID;
}

function quarkComparableName(name) {
  return String(name || "").trim().toLowerCase().replace(/\(\d+\)(?=\.[a-z0-9]{1,8}$)/i, "");
}

async function quarkFindExistingTempFile(tempFid, video, params) {
  if (!tempFid || !video) return "";
  var videoName = quarkComparableName(video.file_name || "");
  var videoSize = Number(video.size || 0);
  if (!videoName || !videoSize) return "";
  var page = 1;
  var size = 200;
  while (page <= 5) {
    var data = await quarkGet("file/sort?pdir_fid=" + encodeURIComponent(tempFid)
      + "&_page=" + page
      + "&_size=" + size
      + "&_sort=updated_at:desc", params);
    var list = data && data.data && data.data.list || [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i] || {};
      if (item.dir === true) continue;
      if (Number(item.size || 0) === videoSize && quarkComparableName(item.file_name || "") === videoName && item.fid) {
        return item.fid;
      }
    }
    var total = data && data.metadata && data.metadata._total || list.length;
    if (page >= Math.ceil(total / size) || !list.length) break;
    page++;
  }
  return "";
}

async function quarkSaveToTemp(info, video, params) {
  var cacheKey = info.shareId + "::" + video.fid;
  if (QUARK_SAVED_FIDS[cacheKey]) return QUARK_SAVED_FIDS[cacheKey];
  var tempFid = await quarkEnsureTempDir(params);
  if (!tempFid) return "";
  var existingFid = await quarkFindExistingTempFile(tempFid, video, params);
  if (existingFid) {
    QUARK_SAVED_FIDS[cacheKey] = existingFid;
    return existingFid;
  }
  var data = await quarkPost("share/sharepage/save", {
    fid_list: [video.fid],
    fid_token_list: [video.share_fid_token],
    to_pdir_fid: tempFid,
    pwd_id: info.shareId,
    stoken: video.stoken || await quarkShareToken(info, params),
    pdir_fid: "0",
    scene: "link"
  }, params);
  var taskId = data && data.data && data.data.task_id;
  if (!taskId) return "";
  for (var i = 0; i < 12; i++) {
    var task = await quarkGet("task?task_id=" + encodeURIComponent(taskId) + "&retry_index=" + i, params);
    var fids = task && task.data && task.data.save_as && task.data.save_as.save_as_top_fids;
    if (fids && fids.length) {
      QUARK_SAVED_FIDS[cacheKey] = fids[0];
      return fids[0];
    }
    await zzSleep(1000);
  }
  return "";
}

function quarkSocialFileFromMessage(msg) {
  var extra = msg && msg.extra && msg.extra.custom_extra || {};
  return extra.file || {};
}

async function quarkSocialConversation(params) {
  if (QUARK_SOCIAL_CONVERSATION && QUARK_SOCIAL_CONVERSATION.conversation_id) return QUARK_SOCIAL_CONVERSATION;
  var data = await quarkSocialPost("chat/conv/list", {
    order_field: "msg_pos",
    order: "desc",
    size: 9999,
    fetch_own_conversation: 1,
    fetch_user_count: 1
  }, params);
  var list = data && data.data && data.data.conversations || [];
  var selected = null;
  for (var i = 0; i < list.length; i++) {
    var conv = list[i] || {};
    if (conv.conversation_id && (conv.name === "发给自己" || conv.share_name === "发给自己")) {
      selected = conv;
      break;
    }
  }
  if (!selected) {
    for (var j = 0; j < list.length; j++) {
      var fallback = list[j] || {};
      if (fallback.conversation_id && (Number(fallback.conv_type || fallback.conversation_type || 0) === 3 || fallback.owner_id)) {
        selected = fallback;
        break;
      }
    }
  }
  if (!selected || !selected.conversation_id) return null;
  QUARK_SOCIAL_CONVERSATION = {
    conversation_id: selected.conversation_id,
    conversation_type: Number(selected.conv_type || selected.conversation_type || 3) || 3
  };
  return QUARK_SOCIAL_CONVERSATION;
}

async function quarkSocialSendFile(savedFid, video, params) {
  var conv = await quarkSocialConversation(params);
  if (!conv || !conv.conversation_id || !savedFid) return null;
  var localMsgId = zzUuidLike(savedFid);
  var groupId = zzUuidLike("group:" + savedFid);
  var fileName = zzText(video && video.file_name) || "Forward.mp4";
  var data = await quarkSocialPost("chat/conv/msg/batch_send", {
    conversations: [{
      merge_file: 0,
      conversation_id: conv.conversation_id,
      conversation_type: conv.conversation_type,
      file_list: [{
        fid: savedFid,
        content: fileName,
        client_extra: {
          group_id: groupId,
          device_model: "Forward",
          local_msg_id: localMsgId
        }
      }]
    }],
    return_msg_as_list: 1
  }, params);
  var sendList = data && data.data && data.data.send_msg_list || [];
  var msg = sendList[0] || null;
  var msgId = msg && (msg.store_msg_id || msg.msg_id);
  var file = quarkSocialFileFromMessage(msg);
  if (!msgId && data && data.data && data.data.conversations && data.data.conversations[0]) {
    var sent = data.data.conversations[0].file_list && data.data.conversations[0].file_list[0] || {};
    msgId = sent.send_result && sent.send_result.store_msg_id || sent.client_extra && sent.client_extra.msg_id || "";
  }
  console.log("[zhizhen] quark social send", {
    ok: !!msgId,
    hasPreview: !!(file.preview_url || file.quick_preview_url),
    status: data && (data.status || data.code || ""),
    message: data && (data.message || data.msg || "")
  });
  if (!msgId) return null;
  return {
    conversation_id: conv.conversation_id,
    conversation_type: conv.conversation_type,
    msg_id: msgId,
    file: file
  };
}

async function quarkSocialAcquireDownloadToken(sent, params) {
  if (!sent || !sent.conversation_id || !sent.msg_id) return "";
  var data = await quarkSocialPost("chat/conv/file/acquire_dl_token", {
    conversation_id: sent.conversation_id,
    conversation_type: sent.conversation_type || 3,
    msg_id: sent.msg_id
  }, params);
  var token = data && data.data && data.data.token || "";
  console.log("[zhizhen] quark social dl token", {
    ok: !!token,
    status: data && (data.status || data.code || ""),
    message: data && (data.message || data.msg || "")
  });
  return token;
}

async function quarkSocialPlayUrls(video, savedFid, params) {
  var out = [];
  if (!savedFid) return out;
  try {
    var sent = await quarkSocialSendFile(savedFid, video, params);
    if (!sent) return out;
    await quarkSocialAcquireDownloadToken(sent, params);
    var file = sent.file || {};
    var seen = {};
    async function add(name, url) {
      url = zzText(url);
      if (!url || seen[url]) return;
      var headers = quarkPlaybackHeaders(params);
      var probe = await probePlaybackUrl(url, headers);
      if (!probe.ok) {
        console.warn("[zhizhen] quark social candidate skipped", {
          name: name,
          host: zzUrlHost(url),
          status: probe.status || "",
          contentType: probe.contentType || "",
          message: probe.message || ""
        });
        return;
      }
      seen[url] = true;
      out.push({
        name: name,
        url: url,
        headers: headers,
        priority: 9000
      });
    }
    await add("MiraPlay", file.preview_url);
    await add("MiraPlay 快速预览", file.quick_preview_url || file.big_thumbnail);
  } catch (e) {
    console.warn("[zhizhen] quark social play failed:", e && e.message || e);
  }
  return out;
}

function quarkTranscodeRank(resolution) {
  var s = zzText(resolution).toLowerCase();
  if (/4k|uhd|2160/.test(s)) return 600;
  if (/2k|qhd|1440/.test(s)) return 500;
  if (/super|fhd|1080|超清/.test(s)) return 400;
  if (/high|hd|720|高清/.test(s)) return 300;
  if (/normal|sd|540|标清/.test(s)) return 200;
  if (/low|ld|360|流畅/.test(s)) return 100;
  var m = s.match(/(\d{3,4})/);
  return m ? Number(m[1]) : 0;
}

function quarkTranscodeName(resolution) {
  var s = zzText(resolution);
  var lower = s.toLowerCase();
  if (/4k|uhd|2160/.test(lower)) return "转码 4K";
  if (/2k|qhd|1440/.test(lower)) return "转码 2K";
  if (/super|fhd|1080/.test(lower)) return "转码 超清";
  if (/high|hd|720/.test(lower)) return "转码 高清";
  if (/normal|sd|540/.test(lower)) return "转码 标清";
  if (/low|ld|360/.test(lower)) return "转码 流畅";
  return s ? "转码 " + s : "转码";
}

async function quarkTranscodePlayUrls(video, savedFid, params) {
  var out = [];
  if (!savedFid) return out;
  try {
    var play = await quarkPost("file/v2/play", {
      fid: savedFid,
      resolutions: "normal,low,high,super,2k,4k"
    }, params);
    var list = play && play.data && play.data.video_list || [];
    var candidates = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i] || {};
      var url = item.video_info && item.video_info.url || item.url || item.play_url || "";
      if (!url) continue;
      candidates.push({
        name: quarkTranscodeName(item.resolution),
        resolution: item.resolution || "",
        url: url,
        headers: quarkPlaybackHeaders(params),
        transcode: true,
        priority: 10000 + quarkTranscodeRank(item.resolution),
        rank: quarkTranscodeRank(item.resolution)
      });
    }
    candidates.sort(function (a, b) {
      return (b.rank || 0) - (a.rank || 0);
    });
    console.log("[zhizhen] quark transcode", {
      ok: !!candidates.length,
      status: play && (play.status || play.code || ""),
      message: play && (play.message || play.msg || ""),
      count: candidates.length,
      best: candidates[0] && candidates[0].resolution || "",
      host: candidates[0] && zzUrlHost(candidates[0].url) || ""
    });
    if (candidates.length) out.push(candidates[0]);
  } catch (e) {
    console.warn("[zhizhen] quark transcode failed:", e && e.message || e);
  }
  return out;
}

async function quarkPlayUrls(info, video, savedFid, params) {
  var out = [];
  if (savedFid) {
    var transcodes = await quarkTranscodePlayUrls(video, savedFid, params);
    for (var tf = 0; tf < transcodes.length; tf++) out.push(transcodes[tf]);
  }
  if (!out.length && savedFid && quarkMiraPlayEnabled(params)) {
    var socialFirst = await quarkSocialPlayUrls(video, savedFid, params);
    for (var sf = 0; sf < socialFirst.length; sf++) out.push(socialFirst[sf]);
  }
  return out;
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
  console.log("[zhizhen] video size filter", {
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
  console.log("[zhizhen] helper size filter", {
    rawCount: rawCount,
    filteredCount: items.length,
    pickedCount: picked.length,
    uniqueCount: unique.length,
    sizes: itemSizeSummary(unique)
  });
  return unique;
}

function panPriority(type, params) {
  var order = ["百度", "夸克", "UC", "天翼", "123", "移动", "阿里", "网盘"];
  var idx = order.indexOf(type);
  return idx >= 0 ? idx : order.length;
}

function panEnabled(type, params) {
  var value = "";
  if (type === "百度") value = (params && params.enable_baidu) || ZZ_RUNTIME_PARAMS.enable_baidu || "on";
  else if (type === "夸克") value = (params && params.enable_quark) || ZZ_RUNTIME_PARAMS.enable_quark || "on";
  else if (type === "UC") value = (params && params.enable_uc) || ZZ_RUNTIME_PARAMS.enable_uc || "on";
  else value = "on";
  return zzText(value || "on").toLowerCase() !== "off";
}

function sourceLimitForPan(type, params) {
  var limit = 1;
  if (type === "百度") limit = Math.max(1, zzToInt(params && params.baidu_max_files, 2));
  else if (type === "夸克") limit = Math.max(1, zzToInt(params && params.quark_max_files, 2));
  else if (type === "UC") limit = Math.max(1, zzToInt(params && params.uc_max_files, 2));
  if (fastLoadEnabled(params)) return Math.min(limit, 1);
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
  return Math.max(12, zzToInt(params && params.search_candidates, 40) || 40);
}

function searchExtraAfterHit(params) {
  if (fastLoadEnabled(params)) return 0;
  return zzBoundInt(params && params.search_extra_after_hit, 3, 0, 40);
}

function fallbackModeValue(params) {
  return zzText((params && params.fallbackMode) || ZZ_RUNTIME_PARAMS.fallbackMode || "hide");
}

function shouldKeepPanLine(type, params) {
  if (!panEnabled(type, params)) return false;
  if (canResolvePanType(type, params)) return true;
  if (fallbackModeValue(params) !== "hide") return true;
  return false;
}

function canResolvePanType(type, params) {
  if (!panEnabled(type, params)) return false;
  if (type === "百度") return !!baiduCookie(params) || helperAvailable("Baidu2") || helperAvailable("Baidu");
  if (type === "夸克") return !!quarkCookie(params);
  if (type === "UC") return !!ucCookie(params);
  if (type === "阿里") return helperAvailable("Ali");
  if (type === "天翼") return helperAvailable("Cloud");
  if (type === "移动") return helperAvailable("Yun");
  if (type === "123") return helperAvailable("Pan");
  return false;
}

function resolvableTargetPans(params, targetPanType) {
  var base = targetPanType ? [targetPanType] : ["百度", "夸克", "UC"];
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

function missingResolvablePans(panCounts, params, targetPanType) {
  var pans = resolvableTargetPans(params, targetPanType);
  var out = [];
  for (var i = 0; i < pans.length; i++) {
    if ((panCounts[pans[i]] || 0) < sourceLimitForPan(pans[i], params)) out.push(pans[i]);
  }
  return out;
}

function preferredOnlyLines(lines, params) {
  lines = sortLinesByPan(lines, params);
  var allowShareFallback = fallbackModeValue(params) !== "hide";
  var out = [];
  var seenPan = {};
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!line) continue;
    var type = line.panType || detectPanType(line.shareUrl);
    if (!panEnabled(type, params)) continue;
    if ((seenPan[type] || 0) >= sourceLimitForPan(type, params)) continue;
    if (shouldKeepPanLine(type, params) || allowShareFallback) {
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

function baiduApplyRandsk(params, randsk) {
  randsk = zzText(randsk);
  if (!randsk) return;
  var cookie = baiduCookie(params).replace(/BDCLND=[^;]*;?\s*/g, "");
  if (cookie && !/;\s*$/.test(cookie)) cookie += "; ";
  setBaiduCookie(params, cookie + "BDCLND=" + randsk);
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
    var nativeMax = Math.max(1, zzToInt(params && params.baidu_max_files, 2));
    var nativeOut = [];
    for (var vi = 0; vi < videos.length && nativeOut.length < nativeMax; vi++) {
      var video = videos[vi] || {};
      var directUrl = await baiduDirectPlayUrl(video, params, uidPromise);
      if (!directUrl) continue;
      var vName = video.file_name || "";
      var vSize = zzSizeText(video.size);
      var vDesc = [line.title, video.vod_group, vName, vSize ? "大小: " + vSize : "", line.shareUrl].filter(Boolean).join("\n");
      var vSource = await sourceFromDirect("至臻[盘] 百度 " + vName + (vSize ? " " + vSize : ""), directUrl, vDesc, baiduPlaybackHeaders(params), params, { name: vName, size: Number(video.size || 0) });
      if (vSource) nativeOut.push(vSource);
    }
    console.log("[zhizhen] baidu native result", { count: nativeOut.length });
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
  var maxFiles = Math.max(1, zzToInt(params && params.baidu_max_files, 2));
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
  console.log("[zhizhen] baidu direct result", { count: out.length });
  return out;
}

async function resolveQuarkDirect(line, params) {
  console.log("[zhizhen] quark direct start", { hasCookie: !!quarkCookie(params), share: !!line.shareUrl });
  if (!quarkCookie(params)) return [];
  var info = quarkShareInfo(line.shareUrl);
  if (!info) {
    console.log("[zhizhen] quark share parse miss");
    return [];
  }
  var rawVideos = await quarkListShareVideos(info, params);
  console.log("[zhizhen] quark videos raw", {
    wantedEpisode: zzWantedEpisode(params),
    count: rawVideos.length,
    sample: episodeSummary(rawVideos, function (video) {
      return [video && video.vod_group, helperItemName(video)].filter(Boolean).join(" ");
    })
  });
  var videos = filterVideosForEpisode(rawVideos, params);
  console.log("[zhizhen] quark videos", {
    wantedEpisode: zzWantedEpisode(params),
    count: videos.length,
    sample: episodeSummary(videos, function (video) {
      return [video && video.vod_group, helperItemName(video)].filter(Boolean).join(" ");
    })
  });
  var maxFiles = Math.max(1, zzToInt(params && params.quark_max_files, 2));
  var out = [];
  for (var i = 0; i < videos.length && out.length < maxFiles; i++) {
    var video = videos[i];
    var savedFid = "";
    try {
      savedFid = await quarkSaveToTemp(info, video, params);
    } catch (e) {
      console.warn("[zhizhen] quark save failed:", e && e.message || e);
    }
    console.log("[zhizhen] quark save", { index: i + 1, saved: !!savedFid });
    var urls = await quarkPlayUrls(info, video, savedFid, params);
    console.log("[zhizhen] quark play urls", { count: urls.length });
    for (var ui = 0; ui < urls.length; ui++) {
      var sizeText = zzSizeText(video.size);
      var qDesc = [
        line.title,
        video.vod_group,
        video.file_name,
        sizeText ? "大小: " + sizeText : "",
        line.shareUrl
      ].filter(Boolean).join("\n");
      var qHeaders = urls[ui].headers || quarkPlaybackHeaders(params);
      var qName = "至臻[盘] 夸克 " + (urls[ui].name || video.file_name || "") + (sizeText ? " " + sizeText : "");
      var qMeta = { size: Number(video.size || 0), name: video.file_name || "", params: params, disableFastPlay: !!urls[ui].transcode };
      var qDirect = urls[ui].transcode
        ? sourceFromRawUrl(qName, urls[ui].url, qDesc, qHeaders, qMeta)
        : await sourceFromDirect(qName, urls[ui].url, qDesc, qHeaders, params, qMeta);
      if (qDirect) out.push(qDirect);
    }
  }
  return out;
}

var UC_API = "https://pc-api.uc.cn/1/clouddrive";
var UC_QUERY = "pr=UCBrowser&fr=pc&sys=darwin&ve=1.8.6";
var UC_OPEN_API = "https://open-api-drive.uc.cn";
var UC_OPEN_CLIENT_ID = "5acf882d27b74502b7040b0c65519aa7";
var UC_OPEN_SIGN_KEY = "l3srvtd7p42l0d0x1u8d7yc8ye9kki4d";
var UC_OPEN_APP_VER = "1.6.8";
var UC_OPEN_CHANNEL = "UCTVOFFICIALWEB";
var UC_OPEN_DEVICE_ID = "1fa50e78894bd1d7ba3abe2c720a97cc";
var UC_OPEN_PLAY_DEVICE_ID = "4b63317b19bc4d228af9bceb997d1624";
var UC_OPEN_USER_AGENT = "Mozilla/5.0 (Linux; U; Android 12; zh-cn; V2238A Build/V417IR) AppleWebKit/533.1 (KHTML, like Gecko) Mobile Safari/533.1";
var UC_TEMP_FID = "";
var UC_SAVED_FIDS = {};
var UC_SHARE_TOKENS = {};

function ucCookie(params) {
  return zzText((params && (params.uc_cookie || params.ucCookie))
    || ZZ_RUNTIME_PARAMS.uc_cookie || ZZ_RUNTIME_PARAMS.ucCookie || "");
}

function ucApiToken(params) {
  return "";
}

function ucToken(params) {
  return zzText((params && (params.uc_token || params.ucToken)) || ZZ_RUNTIME_PARAMS.uc_token || ZZ_RUNTIME_PARAMS.ucToken || "");
}

function ucPad2(n) {
  return n < 10 ? "0" + n : String(n);
}

function ucFormatLocalTime(ms) {
  var d = new Date(ms);
  return d.getFullYear() + "-" + ucPad2(d.getMonth() + 1) + "-" + ucPad2(d.getDate())
    + " " + ucPad2(d.getHours()) + ":" + ucPad2(d.getMinutes());
}

function ucBase64UrlDecode(text) {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var s = String(text || "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  var bytes = [];
  var buffer = 0;
  var bits = 0;
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (ch === "=") break;
    var val = chars.indexOf(ch);
    if (val < 0) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
    }
  }
  var encoded = "";
  for (var bi = 0; bi < bytes.length; bi++) encoded += "%" + ("0" + bytes[bi].toString(16)).slice(-2);
  try { return decodeURIComponent(encoded); } catch (e) {
    var out = "";
    for (var oi = 0; oi < bytes.length; oi++) out += String.fromCharCode(bytes[oi]);
    return out;
  }
}

function ucJwtPayload(token) {
  var parts = String(token || "").split(".");
  if (parts.length < 2) return {};
  try { return JSON.parse(ucBase64UrlDecode(parts[1])); } catch (e) { return {}; }
}

function ucTokenExpiryInfo(params) {
  var token = ucToken(params);
  if (!token) return null;
  var payload = ucJwtPayload(token);
  var exp = Number(payload && payload.exp || 0);
  if (!exp) return null;
  var warnHours = Math.max(1, zzToInt((params && (params.uc_token_warn_hours || params.ucTokenWarnHours)) || ZZ_RUNTIME_PARAMS.uc_token_warn_hours || ZZ_RUNTIME_PARAMS.ucTokenWarnHours, 72));
  var secondsLeft = exp - Math.floor(Date.now() / 1000);
  var expText = ucFormatLocalTime(exp * 1000);
  if (secondsLeft <= 0) {
    return { expired: true, shouldWarn: true, secondsLeft: secondsLeft, expText: expText, warning: "UC Token 已过期，请更新" };
  }
  if (secondsLeft <= warnHours * 3600) {
    return { expired: false, shouldWarn: true, secondsLeft: secondsLeft, expText: expText, warning: "UC Token 将于 " + expText + " 到期，请更新" };
  }
  return { expired: false, shouldWarn: false, secondsLeft: secondsLeft, expText: expText, warning: "" };
}

function ucLogTokenExpiry(params) {
  var info = ucTokenExpiryInfo(params);
  if (info && info.shouldWarn) {
    console.warn("[zhizhen] uc token expiry", {
      expired: !!info.expired,
      exp: info.expText,
      secondsLeft: info.secondsLeft
    });
  }
  return info;
}

function ucOpenReqId(timestamp) {
  return md5Hex(UC_OPEN_DEVICE_ID + String(timestamp || "")).slice(0, 16);
}

function ucOpenXPanToken(method, path, timestamp) {
  return sha256Hex(String(method || "GET").toUpperCase() + "&" + path + "&" + timestamp + "&" + UC_OPEN_SIGN_KEY);
}

function ucOpenApiUrl(path, paramsObj) {
  var query = [];
  paramsObj = paramsObj || {};
  for (var key in paramsObj) {
    if (!Object.prototype.hasOwnProperty.call(paramsObj, key)) continue;
    var value = paramsObj[key];
    if (value == null || value === "") continue;
    query.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
  }
  return UC_OPEN_API + path + (query.length ? "?" + query.join("&") : "");
}

function ucOpenApiHeaders(timestamp) {
  return {
    "User-Agent": UC_OPEN_USER_AGENT,
    "Accept": "*/*",
    "Connection": "Keep-Alive",
    "x-pan-client-id": UC_OPEN_CLIENT_ID,
    "x-pan-tm": String(timestamp || ""),
    "x-pan-token": ucOpenXPanToken("GET", "/file", String(timestamp || "")),
    "content-type": "text/plain;charset=UTF-8"
  };
}

function ucOpenPlaybackHeaders() {
  return {
    "User-Agent": "Lavf/57.83.100",
    "Accept": "*/*",
    "x-device-id": UC_OPEN_PLAY_DEVICE_ID
  };
}

function ucMergeSetCookie(resp, params) {
  var setCookie = getHeaderValue(resp && resp.headers, "set-cookie");
  if (!setCookie) return;
  var current = cookieToMap(ucCookie(params));
  var ignored = { "expires": true, "max-age": true, "domain": true, "path": true, "samesite": true, "secure": true, "httponly": true };
  String(Array.isArray(setCookie) ? setCookie.join(";") : setCookie).replace(/(?:^|[,;]\s*)([^=;,\s]+)=([^;,]*)/g, function (_, key, value) {
    if (!ignored[String(key).toLowerCase()]) current[key] = value;
    return "";
  });
  var merged = cookieMapToString(current);
  if (merged) {
    ZZ_RUNTIME_PARAMS.uc_cookie = merged;
    if (params) params.uc_cookie = merged;
  }
}

function ucHeaders(params) {
  var h = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) uc-cloud-drive/2.5.20 Chrome/100.0.4896.160 Electron/18.3.5.4-b478491100 Safari/537.36 Channel/pckk_other_ch",
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "Origin": "https://drive.uc.cn",
    "Referer": "https://drive.uc.cn/",
    "Cookie": ucCookie(params)
  };
  return h;
}

function ucPlaybackHeaders(params) {
  var rawCookie = ucCookie(params);
  var playCookie = rawCookie.split(";").map(function (s) { return s.trim(); }).filter(function (s) {
    return /^(?:_UP_A4A_11_|tfstk|__uid|__pus|__kp|__puus)=/i.test(s);
  }).join("; ");
  return {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) uc-cloud-drive/1.8.6 Chrome/100.0.4896.160 Electron/18.3.5.16-b62cf9c50d Safari/537.36 Channel/ucpan_other_ch",
    "Referer": "https://drive.uc.cn/",
    "Cookie": playCookie || rawCookie
  };
}

function ucPlayMode(params) {
  var mode = zzText(params && (params.uc_play_mode || params.ucPlayMode) || ZZ_RUNTIME_PARAMS.uc_play_mode || "").toLowerCase();
  if (/trans|转码/.test(mode)) return "transcode";
  if (/orig|原/.test(mode)) return "original";
  return "openapi";
}

async function ucRuntimeUt(params) {
  return ucApiToken(params);
}

async function ucApi(path, params) {
  var urls = await ucApiCandidates(path, params);
  return urls[0] || "";
}

async function ucApiCandidates(path, params) {
  var query = UC_QUERY;
  var ut = await ucRuntimeUt(params);
  if (ut) query += "&ut=" + encodeURIComponent(ut);
  var legacyQuery = "pr=UCBrowser&fr=pc";
  if (ut) legacyQuery += "&ut=" + encodeURIComponent(ut);
  function build(q) {
    return UC_API + "/" + path + (path.indexOf("?") >= 0 ? "&" : "?") + q;
  }
  var out = [];
  function add(url) {
    if (out.indexOf(url) < 0) out.push(url);
  }
  add(build(query));
  if (path.indexOf("uc_param_str") < 0) {
    add(build(query + "&uc_param_str="));
    add(build("uc_param_str=&" + query));
  }
  if (legacyQuery !== query) out.push(build(legacyQuery));
  return out;
}

function ucJson(resp) {
  var data = resp && resp.data;
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch (e) { return {}; }
  }
  return data || {};
}

async function ucGet(path, params) {
  var apiUrls = await ucApiCandidates(path, params);
  var lastErr = null;
  try {
    for (var i = 0; i < apiUrls.length; i++) {
      try {
        var resp = await Widget.http.get(apiUrls[i], { headers: ucHeaders(params), timeout: 30000 });
        ucMergeSetCookie(resp, params);
        var data = ucJson(resp);
        console.log("[zhizhen] uc get", {
          path: String(path || "").split("?")[0],
          variant: i + 1,
          status: data && (data.status || data.code || ""),
          ok: ucApiOk(data)
        });
        if (ucApiOk(data) || data && data.data != null) return data;
        lastErr = new Error("UC GET not ok: " + (data && (data.message || data.msg || data.status || data.code) || "empty"));
        console.warn("[zhizhen] uc get not ok", {
          path: String(path || "").split("?")[0],
          variant: i + 1,
          status: data && (data.status || data.code || ""),
          message: data && (data.message || data.msg || "")
        });
      } catch (inner) {
        lastErr = inner;
        console.warn("[zhizhen] uc get failed", {
          path: String(path || "").split("?")[0],
          variant: i + 1,
          message: inner && inner.message || String(inner)
        });
      }
    }
    throw lastErr || new Error("UC GET failed");
  } catch (e) {
    throw e;
  }
}

async function ucPost(path, body, params) {
  var apiUrls = await ucApiCandidates(path, params);
  var lastErr = null;
  try {
    for (var i = 0; i < apiUrls.length; i++) {
      try {
        var resp = await Widget.http.post(apiUrls[i], JSON.stringify(body || {}), { headers: ucHeaders(params), timeout: 30000 });
        ucMergeSetCookie(resp, params);
        var data = ucJson(resp);
        console.log("[zhizhen] uc post", {
          path: String(path || "").split("?")[0],
          variant: i + 1,
          status: data && (data.status || data.code || ""),
          ok: ucApiOk(data)
        });
        if (ucApiOk(data) || data && data.data != null) return data;
        lastErr = new Error("UC POST not ok: " + (data && (data.message || data.msg || data.status || data.code) || "empty"));
        console.warn("[zhizhen] uc post not ok", {
          path: String(path || "").split("?")[0],
          variant: i + 1,
          status: data && (data.status || data.code || ""),
          message: data && (data.message || data.msg || "")
        });
      } catch (inner) {
        lastErr = inner;
        console.warn("[zhizhen] uc post failed", {
          path: String(path || "").split("?")[0],
          variant: i + 1,
          message: inner && inner.message || String(inner)
        });
      }
    }
    throw lastErr || new Error("UC POST failed");
  } catch (e) {
    throw e;
  }
}

function ucApiOk(data) {
  if (!data) return false;
  var status = data.status;
  var code = data.code;
  if (status === 200 || status === 0 || status === "200" || status === "0") return true;
  if (code === 0 || code === "0") return true;
  return false;
}

function ucShareInfo(url) {
  var text = String(url || "");
  var m = text.match(/drive\.uc\.cn\/s\/([A-Za-z0-9_-]+)/i);
  if (!m) return null;
  var pwd = "";
  var pwdMatch = text.match(/(?:pwd|passcode|提取码)[:=：\s]*([A-Za-z0-9]+)/i);
  if (pwdMatch) pwd = pwdMatch[1];
  var folderId = "0";
  var folderMatch = text.match(/[#?&/](?:fid|folder|pdir_fid|path)=?([A-Za-z0-9_-]+)/i)
    || text.match(/\/list\/share\/([A-Za-z0-9_-]+)/i);
  if (folderMatch) folderId = folderMatch[1];
  return { shareId: m[1], sharePwd: pwd, folderId: folderId };
}

async function ucShareToken(info, params) {
  if (UC_SHARE_TOKENS[info.shareId]) return UC_SHARE_TOKENS[info.shareId];
  console.log("[zhizhen] uc share token start", { shareId: info.shareId, hasPwd: !!info.sharePwd });
  var data = await ucPost("share/sharepage/token", {
    pwd_id: info.shareId,
    passcode: info.sharePwd || ""
  }, params);
  var token = data && data.data && data.data.stoken;
  console.log("[zhizhen] uc share token", {
    shareId: info.shareId,
    ok: !!token,
    status: data && (data.status || data.code || ""),
    message: data && (data.message || data.msg || "")
  });
  if (token) UC_SHARE_TOKENS[info.shareId] = token;
  return token || "";
}

async function ucListShareVideos(info, params) {
  var stoken = await ucShareToken(info, params);
  if (!stoken) {
    console.warn("[zhizhen] uc list skipped: missing stoken", { shareId: info && info.shareId || "" });
    return [];
  }
  var videos = [];
  async function walk(fid, group, page) {
    var size = 100;
    var data = await ucGet("share/sharepage/detail?pwd_id=" + encodeURIComponent(info.shareId)
      + "&stoken=" + encodeURIComponent(stoken)
      + "&pdir_fid=" + encodeURIComponent(fid || "0")
      + "&force=0&_page=" + encodeURIComponent(page || 1)
      + "&_size=" + size
      + "&_sort=file_type:asc,file_name:asc", params);
    var list = data && data.data && data.data.list || [];
    var total = data && data.metadata && data.metadata._total || list.length;
    console.log("[zhizhen] uc detail page", {
      fid: fid || "0",
      page: page || 1,
      count: list.length,
      total: total
    });
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (item.dir === true) {
        await walk(item.fid, group ? group + "/" + item.file_name : item.file_name, 1);
      } else if ((item.file === true || item.type === "file") && quarkIsVideo(item) && Number(item.size || 0) >= 1024 * 1024 * 5) {
        item.stoken = stoken;
        item.vod_group = group || "";
        videos.push(item);
      }
    }
    if ((page || 1) < Math.ceil(total / size)) await walk(fid, group, (page || 1) + 1);
  }
  await walk(info.folderId || "0", "", 1);
  console.log("[zhizhen] uc list videos raw", { count: videos.length });
  return videos;
}

async function ucEnsureTempDir(params) {
  if (UC_TEMP_FID) return UC_TEMP_FID;
  var dirName = zzText(params && params.uc_temp_dir) || "ForwardZZPanTemp";
  var data = await ucGet("file/sort?pdir_fid=0&_page=1&_size=200&_sort=file_type:asc,updated_at:desc", params);
  var list = data && data.data && data.data.list || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].dir === true && list[i].file_name === dirName) {
      UC_TEMP_FID = list[i].fid;
      return UC_TEMP_FID;
    }
  }
  data = await ucPost("file", {
    pdir_fid: "0",
    file_name: dirName,
    dir_path: "",
    dir_init_lock: false
  }, params);
  UC_TEMP_FID = data && data.data && data.data.fid || "";
  return UC_TEMP_FID;
}

async function ucSaveToTemp(info, video, params) {
  var cacheKey = info.shareId + "::" + video.fid;
  if (UC_SAVED_FIDS[cacheKey]) return UC_SAVED_FIDS[cacheKey];
  var tempFid = await ucEnsureTempDir(params);
  if (!tempFid) return "";
  var data = await ucPost("share/sharepage/save", {
    fid_list: [video.fid],
    fid_token_list: [video.share_fid_token],
    to_pdir_fid: tempFid,
    pwd_id: info.shareId,
    stoken: video.stoken || await ucShareToken(info, params),
    pdir_fid: "0",
    scene: "link"
  }, params);
  var taskId = data && data.data && data.data.task_id;
  console.log("[zhizhen] uc save task", {
    hasTask: !!taskId,
    status: data && (data.status || data.code || ""),
    message: data && (data.message || data.msg || "")
  });
  if (!taskId) return "";
  for (var i = 0; i < 12; i++) {
    var task = await ucGet("task?task_id=" + encodeURIComponent(taskId) + "&retry_index=" + i, params);
    var fids = task && task.data && task.data.save_as && task.data.save_as.save_as_top_fids;
    if (fids && fids.length) {
      UC_SAVED_FIDS[cacheKey] = fids[0];
      console.log("[zhizhen] uc save done", { retry: i, hasFid: true });
      return fids[0];
    }
    await zzSleep(1000);
  }
  return "";
}

async function ucOpenApiPlayUrls(video, savedFid, params) {
  var out = [];
  if (!savedFid) return out;
  var accessToken = ucToken(params);
  if (!accessToken) {
    console.warn("[zhizhen] uc openapi skipped: missing uc_token");
    return out;
  }
  var expiry = ucLogTokenExpiry(params);
  if (expiry && expiry.expired) return out;
  try {
    var timestamp = String(Date.now());
    var path = "/file";
    var url = ucOpenApiUrl(path, {
      method: "streaming",
      access_token: accessToken,
      activity_rect: "{}",
      app_ver: UC_OPEN_APP_VER,
      build_device: "OnePlus7T",
      build_product: "OnePlus7T_CH",
      channel: UC_OPEN_CHANNEL,
      device_brand: "OnePlus",
      device_gpu: "Adreno (TM) 640",
      device_id: UC_OPEN_DEVICE_ID,
      device_model: "HD1900",
      fid: savedFid,
      group_by: "source",
      platform: "tv",
      req_id: ucOpenReqId(timestamp),
      resolution: "low,normal,high,super,2k,4k",
      support: "dolby_vision"
    });
    var resp = await Widget.http.get(url, {
      headers: ucOpenApiHeaders(timestamp),
      timeout: 30000
    });
    var data = ucJson(resp);
    var info = data && data.data && (data.data.video_info || data.data.video_list) || data && data.video_info || [];
    var list = Array.isArray(info) ? info : (info ? [info] : []);
    var candidates = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i] || {};
      if (item.accessable === false || item.accessable === "false" || !item.url) continue;
      candidates.push({
        name: "",
        resolution: item.resolution || "",
        url: item.url,
        headers: ucOpenPlaybackHeaders(),
        streaming: true,
        disableFastPlay: true,
        priority: 30000 + quarkTranscodeRank(item.resolution),
        rank: quarkTranscodeRank(item.resolution),
        dataSize: Number(item.size || video && video.size || 0),
        fileName: video && video.file_name || "",
        width: item.width,
        height: item.height,
        bitrate: item.bitrate,
        tokenWarning: expiry && expiry.warning || ""
      });
    }
    candidates.sort(function (a, b) {
      return (b.rank || 0) - (a.rank || 0);
    });
    console.log("[zhizhen] uc openapi stream", {
      ok: !!candidates.length,
      status: data && (data.status || data.code || ""),
      message: data && (data.message || data.msg || ""),
      count: candidates.length,
      best: candidates[0] && candidates[0].resolution || "",
      host: candidates[0] && zzUrlHost(candidates[0].url) || "",
      tokenExp: expiry && expiry.expText || ""
    });
    if (candidates.length) out.push(candidates[0]);
  } catch (e) {
    console.warn("[zhizhen] uc openapi stream failed:", e && e.message || e);
  }
  return out;
}

async function ucTranscodePlayUrls(video, savedFid, params) {
  var out = [];
  if (!savedFid) return out;
  try {
    var play = await ucPost("file/v2/play", {
      fid: savedFid,
      resolutions: "normal,low,high,super,2k,4k",
      supports: "fmp4"
    }, params);
    var list = play && play.data && play.data.video_list || [];
    var candidates = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i] || {};
      var rawUrl = item.video_info && item.video_info.url || item.url || item.play_url || "";
      var playUrl = ucAttachClientToken(rawUrl, params);
      if (!playUrl) continue;
      candidates.push({
        name: quarkTranscodeName(item.resolution),
        resolution: item.resolution || "",
        url: playUrl,
        headers: ucPlaybackHeaders(params),
        transcode: true,
        priority: 10000 + quarkTranscodeRank(item.resolution),
        rank: quarkTranscodeRank(item.resolution)
      });
    }
    candidates.sort(function (a, b) {
      return (b.rank || 0) - (a.rank || 0);
    });
    console.log("[zhizhen] uc transcode", {
      ok: !!candidates.length,
      status: play && (play.status || play.code || ""),
      message: play && (play.message || play.msg || ""),
      count: candidates.length,
      best: candidates[0] && candidates[0].resolution || "",
      host: candidates[0] && zzUrlHost(candidates[0].url) || "",
      hasUcToken: !!ucToken(params)
    });
    if (candidates.length) out.push(candidates[0]);
  } catch (e) {
    console.warn("[zhizhen] uc transcode failed:", e && e.message || e);
  }
  return out;
}

function ucDownloadUrlFromItem(item) {
  if (!item) return "";
  if (typeof item === "string") return item;
  return item.download_url || item.downloadUrl || item.download || item.url || item.play_url || "";
}

async function ucOriginalPlayUrls(video, savedFid, params) {
  var out = [];
  if (!savedFid) return out;
  try {
    var data = await ucPost("file/download?uc_param_str=", { fids: [savedFid] }, params);
    var rawList = data && data.data;
    var list = Array.isArray(rawList) ? rawList : (rawList ? [rawList] : []);
    var headers = ucPlaybackHeaders(params);
    for (var i = 0; i < list.length; i++) {
      var item = list[i] || {};
      var url = ucDownloadUrlFromItem(item);
      if (!url) continue;
      out.push({
        name: "",
        resolution: item.video_max_resolution || video && video.video_max_resolution || "",
        url: url,
        headers: headers,
        transcode: false,
        priority: 20000,
        rank: 1000,
        dataSize: Number(item.size || video && video.size || 0),
        fileName: item.file_name || video && video.file_name || ""
      });
    }
    console.log("[zhizhen] uc original", {
      ok: !!out.length,
      status: data && (data.status || data.code || ""),
      message: data && (data.message || data.msg || ""),
      count: out.length,
      host: out[0] && zzUrlHost(out[0].url) || "",
      rangeSize: list[0] && list[0].range_size || 0,
      hasUcToken: !!ucToken(params)
    });
  } catch (e) {
    console.warn("[zhizhen] uc original failed:", e && e.message || e);
  }
  return out;
}

async function ucPlayUrls(video, savedFid, params) {
  var mode = ucPlayMode(params);
  if (mode === "transcode") return ucTranscodePlayUrls(video, savedFid, params);
  if (mode === "original") return ucOriginalPlayUrls(video, savedFid, params);
  return ucOpenApiPlayUrls(video, savedFid, params);
}

function ucAttachClientToken(url, params) {
  return String(url || "");
}

async function resolveUcDirect(line, params) {
  console.log("[zhizhen] uc direct start", { hasCookie: !!ucCookie(params), share: !!line.shareUrl, hasToken: !!ucToken(params) });
  if (!ucCookie(params)) {
    console.warn("[zhizhen] uc direct skipped: missing cookie");
    return [];
  }
  var info = ucShareInfo(line.shareUrl);
  if (!info) {
    console.warn("[zhizhen] uc direct skipped: unrecognized share url", { url: line.shareUrl || "" });
    return [];
  }
  var rawVideos = await ucListShareVideos(info, params);
  console.log("[zhizhen] uc videos raw", {
    wantedEpisode: zzWantedEpisode(params),
    count: rawVideos.length,
    sample: episodeSummary(rawVideos, function (video) {
      return [video && video.vod_group, helperItemName(video)].filter(Boolean).join(" ");
    })
  });
  var videos = filterVideosForEpisode(rawVideos, params);
  console.log("[zhizhen] uc videos", {
    wantedEpisode: zzWantedEpisode(params),
    count: videos.length,
    sample: episodeSummary(videos, function (video) {
      return [video && video.vod_group, helperItemName(video)].filter(Boolean).join(" ");
    })
  });
  var maxFiles = Math.max(1, zzToInt(params && (params.uc_max_files || params.quark_max_files), 2));
  var out = [];
  for (var i = 0; i < videos.length && out.length < maxFiles; i++) {
    var video = videos[i];
    var savedFid = "";
    try {
      savedFid = await ucSaveToTemp(info, video, params);
    } catch (e) {
      console.warn("[zhizhen] uc save failed:", e && e.message || e);
    }
    var urls = await ucPlayUrls(video, savedFid, params);
    console.log("[zhizhen] uc play urls", { count: urls.length });
    for (var ui = 0; ui < urls.length; ui++) {
      var uSizeNumber = Number(urls[ui].dataSize || video.size || 0);
      var uFileName = urls[ui].fileName || video.file_name || "";
      var sizeText = zzSizeText(uSizeNumber || video.size);
      var uDesc = [
        line.title,
        video.vod_group,
        uFileName || video.file_name,
        sizeText ? "大小: " + sizeText : "",
        urls[ui].tokenWarning || "",
        line.shareUrl
      ].filter(Boolean).join("\n");
      var uHeaders = urls[ui].headers || ucPlaybackHeaders(params);
      var uName = "至臻[盘] UC " + (urls[ui].name || video.file_name || "") + (sizeText ? " " + sizeText : "");
      var uMeta = { size: uSizeNumber, name: uFileName, params: params, disableFastPlay: !!(urls[ui].transcode || urls[ui].streaming || urls[ui].disableFastPlay) };
      var uDirect = (urls[ui].transcode || urls[ui].streaming || urls[ui].disableFastPlay)
        ? sourceFromRawUrl(uName, urls[ui].url, uDesc, uHeaders, uMeta)
        : await sourceFromDirect(uName, urls[ui].url, uDesc, uHeaders, params, uMeta);
      if (uDirect) out.push(uDirect);
    }
  }
  return out;
}

async function resolveWithHelpers(line, params) {
  var url = line.shareUrl;
  var type = line.panType;
  var desc = [line.title, url].filter(Boolean).join("\n");
  var out = [];
  if (!panEnabled(type, params)) {
    console.log("[zhizhen] pan disabled", { panType: type });
    return out;
  }

  try {
    if (type === "夸克") {
      if (quarkCookie(params)) {
        out = await resolveQuarkDirect(line, params);
      } else {
        console.warn("[zhizhen] quark transcode skipped: missing cookie");
      }
    } else if (type === "UC") {
      if (ucCookie(params)) {
        try {
          out = await resolveUcDirect(line, params);
        } catch (e) {
          console.warn("[zhizhen] uc direct failed:", e && e.message || e);
        }
      } else {
        console.warn("[zhizhen] uc transcode skipped: missing cookie");
      }
    } else if (type === "阿里" && helperAvailable("Ali")) {
      var aShare = await Ali.getShareData(url);
      if (aShare) {
        var aVideos = filterVideosForEpisode(await Ali.getFilesByShareUrl(aShare), params);
        for (var ai = 0; ai < aVideos.length; ai++) {
          var av = aVideos[ai];
          var aName = helperItemName(av);
          var aSize = helperItemSize(av);
          var aDown = await Ali.getDownload(av.share_id, av.file_id, false);
          if (aDown && aDown.url) out.push(sourceFromUrl("至臻[盘] 阿里 " + aName + (aSize ? " " + aSize : ""), aDown.url, [desc, aName, aSize ? "大小: " + aSize : ""].filter(Boolean).join("\n"), { "Referer": "https://www.aliyundrive.com/" }));
        }
      }
    } else if (type === "百度") {
      out = await resolveBaiduDirect(line, params);
    } else if (type === "天翼" && helperAvailable("Cloud")) {
      var cData = await Cloud.getShareData(url);
      for (var ck in cData) {
        var cArr = filterHelperItemsForEpisode(cData[ck] || [], params, ck);
        for (var ci = 0; ci < cArr.length; ci++) {
          var cName = helperItemName(cArr[ci]) || ck;
          var cSize = helperItemSize(cArr[ci]);
          var cUrl = await Cloud.getShareUrl(cArr[ci].fileId, cArr[ci].shareId);
          if (cUrl) out.push(sourceFromUrl("至臻[盘] 天翼 " + cName + (cSize ? " " + cSize : ""), cUrl, [desc, cName, cSize ? "大小: " + cSize : ""].filter(Boolean).join("\n")));
        }
      }
    } else if (type === "移动" && helperAvailable("Yun")) {
      var yData = await Yun.getShareData(url);
      for (var yk in yData) {
        var yArr = filterHelperItemsForEpisode(yData[yk] || [], params, yk);
        for (var yi = 0; yi < yArr.length; yi++) {
          var yName = helperItemName(yArr[yi]) || yk;
          var ySize = helperItemSize(yArr[yi]);
          var yUrl = await Yun.getSharePlay(yArr[yi].contentId, yArr[yi].linkID);
          if (yUrl) out.push(sourceFromUrl("至臻[盘] 移动 " + yName + (ySize ? " " + ySize : ""), yUrl, [desc, yName, ySize ? "大小: " + ySize : ""].filter(Boolean).join("\n")));
        }
      }
    } else if (type === "123" && helperAvailable("Pan")) {
      var pShare = await Pan.getShareData(url);
      var pVideos = await Pan.getFilesByShareUrl(pShare);
      for (var pk in pVideos) {
        var pArr = filterHelperItemsForEpisode(pVideos[pk] || [], params, pk);
        for (var pi = 0; pi < pArr.length; pi++) {
          var p = pArr[pi];
          var pName = helperItemName(p) || pk;
          var pSize = helperItemSize(p);
          var pUrl = await Pan.getDownload(p.ShareKey, p.FileId, p.S3KeyFlag, p.Size, p.Etag);
          if (pUrl) out.push(sourceFromUrl("至臻[盘] 123 " + pName + (pSize ? " " + pSize : ""), pUrl, [desc, pName, pSize ? "大小: " + pSize : ""].filter(Boolean).join("\n")));
        }
      }
    }
  } catch (e) {
    console.warn("[zhizhen] helper resolve failed:", type, e && e.message || e);
  }

  return out;
}

function fallbackSource(line, params) {
  if (fallbackModeValue(params) === "hide") return [];
  return [sourceFromUrl("至臻[盘] " + line.panType, line.shareUrl, [line.title, "未检测到可用网盘解析器，返回分享链接。"].filter(Boolean).join("\n"))];
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
    "episode", "episodeNumber", "episode_number",
    "episodeNo", "episodeIndex", "episodeSort", "currentEpisode", "playEpisode",
    "ep", "sort", "episodeName", "episodeTitle", "subtitle", "remark", "link", "id",
    "quality_tag", "load_speed_mode", "resource_first",
    "tmdbInfo", "mediaInfo", "episodeInfo", "selectedEpisode"
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
  var panCounts = {};
  for (var i = 0; i < lines.length; i++) {
    var panType = lines[i] && (lines[i].panType || detectPanType(lines[i].shareUrl)) || "";
    if ((panCounts[panType] || 0) >= sourceLimitForPan(panType, params)) continue;
    var sources = await resolvePlayableLine(lines[i], params);
    for (var si = 0; si < sources.length; si++) {
      if ((panCounts[panType] || 0) >= sourceLimitForPan(panType, params)) break;
      var key = zzSourceKey(sources[si]);
      if (seenSources[key]) continue;
      seenSources[key] = true;
      panCounts[panType] = (panCounts[panType] || 0) + 1;
      childItems.push({
        id: sources[si].id || String(link) + "#" + i + "." + si,
        type: "url",
        title: sources[si].name,
        name: sources[si].name,
        subTitle: sources[si].subTitle,
        subtitle: sources[si].subtitle,
        remark: sources[si].remark,
        description: sources[si].description,
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
        priority: sources[si].priority,
        weight: sources[si].weight,
        resourcePriority: sources[si].resourcePriority,
        sourcePriority: sources[si].sourcePriority,
        sortIndex: sources[si].sortIndex,
        order: sources[si].order,
        displayOrder: sources[si].displayOrder,
        rank: sources[si].rank,
        pinned: sources[si].pinned,
        pin: sources[si].pin,
        isPreferred: sources[si].isPreferred,
        playerType: sources[si].playerType || "system"
      });
    }
  }
  detail.childItems = childItems;
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
    sources[i].description = [
      route.keyword ? "搜索词: " + route.keyword : "",
      route.detailTitle ? "命中: " + route.detailTitle : "",
      sources[i].description || ""
    ].filter(Boolean).join("\n");
  }
  return sources;
}

function resourceCacheKey(params, panType) {
  params = params || {};
  return [
    WidgetMetadata && WidgetMetadata.version || "",
    panType || "",
    params.title || "",
    params.seriesName || "",
    params.name || "",
    params.episodeName || "",
    zzWantedEpisode(params) || params.episode || "",
    params.host || "",
    params.pan_hosts || "",
    params.enable_baidu || "",
    params.enable_quark || "",
    params.enable_uc || "",
    params.quark_max_files || "",
    params.baidu_max_files || "",
    params.uc_max_files || "",
    params.quark_threads || "",
    params.quark_chunk_size || "",
    params.quark_miraplay || "",
    params.uc_threads || "",
    params.uc_chunk_size || "",
    params.uc_play_mode || params.ucPlayMode || "",
    params.uc_token_warn_hours || params.ucTokenWarnHours || "",
    params.quality_tag || params.qualityTag || "",
    ucToken(params) || "",
    params.search_candidates || "",
    params.search_extra_after_hit || "",
    params.load_speed_mode || "",
    params.resource_first || "",
    !!quarkCookie(params),
    !!baiduCookie(params),
    !!ucCookie(params)
  ].join("||");
}

function sourcePanType(source) {
  source = source || {};
  return source.panType || sourcePanLabel(source.displayName || source.name || source.title || "");
}

function sortSourcesByPan(sources, params) {
  return (Array.isArray(sources) ? sources : []).slice().sort(function (a, b) {
    return panPriority(sourcePanType(a), params) - panPriority(sourcePanType(b), params);
  });
}

async function loadResourceForPan(params, panType) {
  return loadResourceAll(params || {}, "UC");
}

async function loadQuarkResource(params) {
  return loadResourceForPan(params, "夸克");
}

async function loadBaiduResource(params) {
  return loadResourceForPan(params, "百度");
}

async function loadUcResource(params) {
  return loadResourceForPan(params, "UC");
}

async function loadResource(params) {
  return loadResourceForPan(params, "UC");
}

async function loadResourceAll(params, panType) {
  params = params || {};
  zzSyncParams(params);
  panType = "UC";
  var key = resourceCacheKey(params, panType);
  if (!ZZ_RESOURCE_CACHE[key]) {
    ZZ_RESOURCE_CACHE[key] = loadResourceUncached(Object.assign({}, params), panType);
  }
  return ZZ_RESOURCE_CACHE[key];
}

async function loadResourceUncached(params, targetPanType) {
  var startedAt = Date.now();
  params = params || {};
  targetPanType = "UC";
  params._zzResourceLoad = true;
  params._zzTargetPanType = targetPanType;
  zzSyncParams(params);
  if (targetPanType && !panEnabled(targetPanType, params)) {
    console.log("[zhizhen] loadResource skipped disabled pan", { targetPanType: targetPanType });
    return [];
  }
  var keywords = buildSearchKeywords(params);
  var quarkFast = fastPlayConfigForName("夸克", params);
  var ucFast = fastPlayConfigForName("UC", params);
  var speedMode = loadSpeedMode(params);
  var extraAfterHit = searchExtraAfterHit(params);
  console.log("[zhizhen] loadResource", {
    targetPanType: targetPanType,
    title: params.title || params.seriesName || params.name || "",
    episode: zzWantedEpisode(params) || params.episode || "",
    paramsSummary: debugParamsSummary(params),
    keywords: keywords.join("|"),
    keywordCount: keywords.length,
    hasQuarkCookie: !!quarkCookie(params),
    hasBaiduCookie: !!baiduCookie(params),
    hasUcCookie: !!ucCookie(params),
    hasUcToken: !!ucToken(params),
    enableBaidu: panEnabled("百度", params),
    enableQuark: panEnabled("夸克", params),
    enableUc: panEnabled("UC", params),
    hasBaiduHelper: helperAvailable("Baidu2") || helperAvailable("Baidu"),
    hasUcHelper: helperAvailable("UC"),
    speedMode: speedMode,
    ucPlayMode: ucPlayMode(params),
    qualityTag: sourceQualityConfig(params).label,
    resourceFirst: resourceFirstEnabled(params),
    scanLimit: candidateScanLimit(params),
    extraAfterHit: extraAfterHit,
    quarkThreads: quarkFast && quarkFast.threads,
    quarkChunkSize: quarkFast && quarkFast.chunkSize,
    ucThreads: ucFast && ucFast.threads,
    ucChunkSize: ucFast && ucFast.chunkSize
  });
  if (!keywords.length) return [];

  var candidates = [];
  var usedKeyword = "";
  var seenCandidate = {};
  var scanLimit = candidateScanLimit(params);
  for (var i = 0; i < keywords.length && candidates.length < scanLimit; i++) {
    var searchStartedAt = Date.now();
    var results = await zzSearchAll(keywords[i], params);
    console.log("[zhizhen] search", { keyword: keywords[i], count: results.length, ms: Date.now() - searchStartedAt });
    var ranked = zzRankItems(results, params, keywords[i]);
    for (var ri = 0; ri < ranked.length && candidates.length < scanLimit; ri++) {
      var item = ranked[ri] || {};
      var cKey = item.link || item.id || item.title || "";
      if (!cKey || seenCandidate[cKey]) continue;
      seenCandidate[cKey] = true;
      item._zzKeyword = keywords[i];
      candidates.push(item);
    }
    if (!usedKeyword && results.length) usedKeyword = keywords[i];
    if (fastLoadEnabled(params) && candidates.length) {
      console.log("[zhizhen] stop keyword search after hit", { keyword: keywords[i], candidateCount: candidates.length });
      break;
    }
  }
  if (!candidates.length) {
    console.log("[zhizhen] no best match");
    return [];
  }
  console.log("[zhizhen] candidates", { keyword: usedKeyword, count: candidates.length, scanLimit: scanLimit });

  var out = [];
  var seenSources = {};
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
    for (var li = 0; li < lines.length; li++) {
      var panType = lines[li] && (lines[li].panType || detectPanType(lines[li].shareUrl)) || "";
      if ((panCounts[panType] || 0) >= sourceLimitForPan(panType, params)) {
        console.log("[zhizhen] skip pan limit", { panType: panType, title: detail.title || "", limit: sourceLimitForPan(panType, params) });
        continue;
      }
      var resolveStartedAt = Date.now();
      var sources = await resolvePlayableLine(lines[li], params);
      console.log("[zhizhen] resolved pan", { panType: panType, sourceCount: sources.length, ms: Date.now() - resolveStartedAt });
      for (var si = 0; si < sources.length; si++) {
        if ((panCounts[panType] || 0) >= sourceLimitForPan(panType, params)) break;
        sources[si].description = [
          "搜索词: " + usedKeyword,
          sourceKeyword && sourceKeyword !== usedKeyword ? "命中词: " + sourceKeyword : "",
          "来源: " + (zzOrigin(best.link) || ""),
          "命中: " + (detail.title || best.title || ""),
          sources[si].description || ""
        ].filter(Boolean).join("\n");
        var key = zzSourceKey(sources[si]);
        if (seenSources[key]) continue;
        seenSources[key] = true;
        panCounts[panType] = (panCounts[panType] || 0) + 1;
        out.push(sources[si]);
      }
    }
    scannedCandidates++;
    if (out.length > beforeCandidateCount) lastNewCandidateIndex = ci;
    if (panLimitsReached(panCounts, params, targetPanType)) {
      console.log("[zhizhen] stop pan limits reached", { scanned: scannedCandidates, panCounts: panCounts });
      break;
    }
    if (lastNewCandidateIndex >= 0 && (extraAfterHit === 0 || ci > lastNewCandidateIndex) && ci - lastNewCandidateIndex >= extraAfterHit) {
      var missingPans = missingResolvablePans(panCounts, params, targetPanType);
      if (fastLoadEnabled(params) && missingPans.length) {
        console.log("[zhizhen] keep scanning missing pans", {
          scanned: scannedCandidates,
          missingPans: missingPans.join(","),
          panCounts: panCounts
        });
        continue;
      }
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
  console.log("[zhizhen] loadResource result", { count: out.length, panTypes: panTypesSummary(out), scanned: scannedCandidates, ms: Date.now() - startedAt });
  return out;
}

(() => {
  const SHORTS_RE = /^\/shorts\/([A-Za-z0-9_-]{6,})/;
  const MSG_KEY = "ytc-shorts-to-video";
  const QUALITY_KEY = "ytc-video-quality";
  const ORIGINAL_KEY = "ytc-original-content";
  const SUBS_KEY = "ytc-subtitles";

  const QUALITY_ORDER = ["tiny", "small", "medium", "large", "hd720", "hd1080", "hd1440", "hd2160", "highres"];

  let enabled = true;
  let desiredQuality = "auto";
  let originalTitles = false;
  let originalAudio = false;
  let originalDescriptions = false;
  let subtitlesAuto = false;
  let subtitlesLanguage = "auto";
  let myLanguage = "pt";
  let subtitlesForMyLanguage = false;

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.key === MSG_KEY) enabled = !!e.data.enabled;
    if (e.data.key === QUALITY_KEY) {
      desiredQuality = e.data.quality;
      applyQuality();
    }
    if (e.data.key === ORIGINAL_KEY) {
      originalTitles = !!e.data.titles;
      originalAudio = !!e.data.audio;
      originalDescriptions = !!e.data.descriptions;
      untranslateAudio();
      scheduleUntranslateTitles();
      untranslateDescription();
    }
    if (e.data.key === SUBS_KEY) {
      subtitlesAuto = !!e.data.auto;
      subtitlesLanguage = e.data.language || "auto";
      myLanguage = e.data.myLanguage || "pt";
      subtitlesForMyLanguage = !!e.data.forMyLanguage;
      applySubtitles();
    }
  });

  const toWatchUrl = (href) => {
    const url = new URL(href, location.origin);
    const match = url.pathname.match(SHORTS_RE);
    if (!match) return null;
    const target = new URL("/watch", url.origin);
    target.searchParams.set("v", match[1]);
    const t = url.searchParams.get("t");
    if (t) target.searchParams.set("t", t);
    return target.pathname + target.search;
  };

  const wrap = (fn) =>
    function (state, title, url) {
      if (enabled && url) {
        const watch = toWatchUrl(url);
        if (watch) url = watch;
      }
      return fn.call(this, state, title, url);
    };

  history.pushState = wrap(history.pushState);
  history.replaceState = wrap(history.replaceState);

  const pickTarget = (available) => {
    if (available.includes(desiredQuality)) return desiredQuality;
    return QUALITY_ORDER.filter((q) => available.includes(q)).pop() || null;
  };

  const applyQuality = () => {
    if (desiredQuality === "auto") return;
    const player = document.getElementById("movie_player");
    if (!player || typeof player.getAvailableQualityLevels !== "function") return;

    const available = player.getAvailableQualityLevels();
    if (!available || !available.length) return;

    const target = pickTarget(available);
    if (!target) return;

    if (typeof player.getPlaybackQuality === "function" && player.getPlaybackQuality() === target) return;

    player.setPlaybackQualityRange(target, target);
  };

  const hookPlayerState = () => {
    const player = document.getElementById("movie_player");
    if (!player || player.__ytcQualityHooked || typeof player.addEventListener !== "function") return;
    player.__ytcQualityHooked = true;
    player.addEventListener("onStateChange", (state) => {
      if (state === 1 || state === 3) {
        setTimeout(applyQuality, 50);
        setTimeout(untranslateAudio, 150);
        setTimeout(applySubtitles, 200);
      }
    });
  };

  const trackParams = (track) => {
    const params = { languageCode: track.languageCode };
    if (track.kind) params.kind = track.kind;
    if (track.name && track.name.simpleText) params.name = track.name;
    return params;
  };

  const getVideoLanguage = async (player) => {
    try {
      if (typeof player.getAudioTrack !== "function") return null;
      const track = await player.getAudioTrack();
      const parts = String((track && track.id) || "").split(";");
      if (parts.length < 2) return null;
      const m = atob(parts[1]).match(/lang..([-a-zA-Z]+)/);
      return m ? m[1].toLowerCase() : null;
    } catch {
      return null;
    }
  };

  const applySubtitles = async () => {
    const player = document.getElementById("movie_player");
    if (!player || typeof player.unloadModule !== "function") return;
    if (!location.pathname.startsWith("/watch")) return;

    const videoId = new URLSearchParams(location.search).get("v");
    const configHash = `${videoId}+${subtitlesAuto}+${subtitlesLanguage}+${myLanguage}+${subtitlesForMyLanguage}`;
    if (player.__ytcLastSubs === configHash) return;
    player.__ytcLastSubs = configHash;

    if (!subtitlesAuto) {
      player.unloadModule("captions");
      return;
    }

    if (typeof player.getOption !== "function" || typeof player.setOption !== "function") return;

    const videoLang = await getVideoLanguage(player);

    if (videoLang && videoLang === myLanguage && !subtitlesForMyLanguage) {
      player.unloadModule("captions");
      return;
    }

    const tracklist = player.getOption("captions", "tracklist") || [];

    if (subtitlesLanguage !== "auto") {
      const preferred = tracklist.find((t) => t.languageCode === subtitlesLanguage);
      if (preferred) {
        player.setOption("captions", "track", trackParams(preferred));
        return;
      }
      const base =
        (videoLang && tracklist.find((t) => t.languageCode === videoLang)) || tracklist[0];
      if (base) {
        player.setOption("captions", "track", {
          ...trackParams(base),
          translationLanguage: { languageCode: subtitlesLanguage },
        });
        return;
      }
      player.unloadModule("captions");
      return;
    }

    const base = (videoLang && tracklist.find((t) => t.languageCode === videoLang)) || tracklist[0];
    if (base) {
      player.setOption("captions", "track", trackParams(base));
    } else {
      player.unloadModule("captions");
    }
  };

  const ORIGINAL_WORDS = [
    "original", "оригинал", "オリジナル", "原始", "원본", "origineel", "originale",
    "oryginał", "původní", "αρχικό", "orijinal", "原創", "gốc", "asli", "מקורי",
    "أصلي", "मूल", "मूळ", "ਪ੍ਰਮਾਣਿਕ", "অসলు", "মূল", "അസലി", "ต้นฉบับ",
  ];

  const isOriginalTrack = (track) => {
    if (!track) return false;
    for (const field of Object.values(track)) {
      if (field && typeof field === "object" && field.name) {
        const name = field.name.toLowerCase();
        if (ORIGINAL_WORDS.some((w) => name.includes(w.toLowerCase()))) return true;
      }
    }
    try {
      const parts = String(track.id || "").split(";");
      if (parts.length >= 2) return atob(parts[1]).includes("original");
    } catch {}
    return false;
  };

  const untranslateAudio = async () => {
    if (!originalAudio) return;
    const player = document.getElementById("movie_player");
    if (
      !player ||
      typeof player.getAvailableAudioTracks !== "function" ||
      typeof player.getAudioTrack !== "function" ||
      typeof player.setAudioTrack !== "function"
    )
      return;

    const tracks = await player.getAvailableAudioTracks();
    const current = await player.getAudioTrack();
    if (!tracks || !tracks.length || !current) return;

    const original = tracks.find(isOriginalTrack);
    if (!original || original.id === current.id) return;

    const videoId = new URLSearchParams(location.search).get("v");
    if (player.__ytcLastAudio === `${videoId}+${original.id}`) return;

    const ok = await player.setAudioTrack(original);
    if (ok || ok === undefined) player.__ytcLastAudio = `${videoId}+${original.id}`;
  };

  const titleCache = new Map();
  const TITLE_CACHE_KEY = "ytcTitleCache";
  const TITLE_CACHE_MAX = 500;

  try {
    const saved = JSON.parse(localStorage.getItem(TITLE_CACHE_KEY) || "{}");
    for (const [id, title] of Object.entries(saved)) titleCache.set(id, Promise.resolve(title));
  } catch {}

  const persistTitleCache = () => {
    try {
      const obj = {};
      for (const [id, p] of titleCache) {
        if (p.__resolvedTitle) obj[id] = p.__resolvedTitle;
      }
      const keys = Object.keys(obj);
      while (keys.length > TITLE_CACHE_MAX) delete obj[keys.shift()];
      localStorage.setItem(TITLE_CACHE_KEY, JSON.stringify(obj));
    } catch {}
  };

  const fetchOriginalTitle = (id) => {
    if (titleCache.has(id)) return titleCache.get(id);
    const p = fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const title = (d && d.title) || null;
        if (title) {
          p.__resolvedTitle = title;
          persistTitleCache();
        } else {
          titleCache.delete(id);
        }
        return title;
      })
      .catch(() => {
        titleCache.delete(id);
        return null;
      });
    titleCache.set(id, p);
    return p;
  };

  const applyTitleToElement = async (el, id) => {
    if (!originalTitles || !id || el.dataset.ytcOriginal === id) return;
    el.dataset.ytcOriginal = id;
    const title = await fetchOriginalTitle(id);
    if (!title) return;
    const target = el.querySelector("yt-formatted-string") || el;
    if (target.textContent.trim() !== title) target.textContent = title;
  };

  const videoIdFromHref = (href) => {
    const m = String(href).match(/[?&]v=([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : null;
  };

  const renderDescriptionHtml = (text, videoId) => {
    const esc = (s) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    let out = esc(text);
    out = out.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#3ea6ff;text-decoration:none">$1</a>'
    );
    out = out.replace(
      /(?<![\w/=&#])((?:\d{1,2}:)?\d{1,2}:\d{2})(?![\w<])/g,
      (m, ts) => {
        const parts = ts.split(":").map(Number);
        const secs =
          parts.length === 3
            ? parts[0] * 3600 + parts[1] * 60 + parts[2]
            : parts[0] * 60 + parts[1];
        return `<a href="/watch?v=${videoId}&t=${secs}s" style="color:#3ea6ff;text-decoration:none">${ts}</a>`;
      }
    );
    out = out.replace(
      /(^|\s)#([\p{L}\p{N}_]+)/gu,
      '$1<a href="/hashtag/$2" style="color:#3ea6ff;text-decoration:none">#$2</a>'
    );
    return out.replace(/\n/g, "<br>");
  };

  const untranslateDescription = async () => {
    if (!originalDescriptions || !location.pathname.startsWith("/watch")) return;
    const player = document.getElementById("movie_player");
    if (!player || typeof player.getPlayerResponse !== "function") return;

    const response = await player.getPlayerResponse();
    const original = response && response.videoDetails && response.videoDetails.shortDescription;
    const videoId = response && response.videoDetails && response.videoDetails.videoId;
    if (!original || !videoId) return;

    const container = document.querySelector(
      "#description-inline-expander yt-attributed-string, ytd-text-inline-expander yt-attributed-string, #description-inline-expander"
    );
    if (!container) return;
    if (container.dataset.ytcOriginalDesc === videoId) return;
    container.dataset.ytcOriginalDesc = videoId;

    if (container.innerText.trim() !== original.trim()) {
      container.innerHTML = renderDescriptionHtml(original, videoId);
    }
  };

  const untranslateTitles = () => {
    if (!originalTitles) return;

    document
      .querySelectorAll('a#video-title[href*="watch?v="], a#video-title-link[href*="watch?v="]')
      .forEach((el) => applyTitleToElement(el, videoIdFromHref(el.href)));

    if (location.pathname.startsWith("/watch")) {
      const id = new URLSearchParams(location.search).get("v");
      if (id) {
        fetchOriginalTitle(id).then((title) => {
          if (!title) return;
          const h1 = document.querySelector("h1.ytd-watch-metadata yt-formatted-string");
          if (h1 && h1.textContent.trim() !== title) h1.textContent = title;
          if (!document.title.startsWith(title)) document.title = `${title} - YouTube`;
        });
      }
    }
  };

  let titleTimer = null;
  const scheduleUntranslateTitles = () => {
    if (titleTimer) return;
    titleTimer = setTimeout(() => {
      titleTimer = null;
      untranslateTitles();
      untranslateDescription();
    }, 50);
  };

  new MutationObserver(scheduleUntranslateTitles).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  const scheduleApplyQuality = () => {
    for (const delay of [300, 1000, 2500, 5000]) {
      setTimeout(() => {
        hookPlayerState();
        applyQuality();
      }, delay);
    }
  };

  setInterval(() => {
    if (desiredQuality !== "auto") {
      hookPlayerState();
      applyQuality();
    }
  }, 2000);

  document.addEventListener(
    "pointerover",
    (e) => {
      if (!originalTitles) return;
      const anchor = e.target.closest && e.target.closest('a[href*="watch?v="]');
      if (!anchor) return;
      const id = videoIdFromHref(anchor.href);
      if (id) fetchOriginalTitle(id);
    },
    true
  );

  window.addEventListener("yt-navigate-start", (e) => {
    if (!originalTitles) return;
    const url = e.detail && e.detail.url;
    const id = url && videoIdFromHref(url);
    if (id) fetchOriginalTitle(id);
  }, true);

  window.addEventListener("yt-navigate-finish", scheduleApplyQuality, true);
  window.addEventListener("yt-navigate-finish", () => {
    for (const delay of [500, 1500, 3000]) {
      setTimeout(untranslateAudio, delay);
      setTimeout(untranslateDescription, delay);
      setTimeout(applySubtitles, delay);
    }
    scheduleUntranslateTitles();
  }, true);
  window.addEventListener("load", scheduleApplyQuality);
  window.addEventListener("load", () => {
    for (const delay of [500, 1500, 3000]) {
      setTimeout(untranslateAudio, delay);
      setTimeout(untranslateDescription, delay);
      setTimeout(applySubtitles, delay);
    }
    scheduleUntranslateTitles();
  });
})();

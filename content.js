(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;

  const SHORTS_RE = /^\/shorts\/([A-Za-z0-9_-]{6,})/;
  const MSG_KEY = "ytc-shorts-to-video";
  const QUALITY_KEY = "ytc-video-quality";

  const HIDE_TOGGLES = [
    "hideShortsAll",
    "hideShortsMenu",
    "hideShortsHome",
    "hideShortsSearch",
    "hideShortsSubscriptions",
    "hideShortsChannel",
    "hideShortsWatch",
    "hideShortsTrending",
    "hideWatchRecommendations",
    "hideWatchPlaylist",
  ];

  const DEFAULTS = {
    shortsToVideo: true,
    hideShortsAll: false,
    hideShortsMenu: false,
    hideShortsHome: false,
    hideShortsSearch: false,
    hideShortsSubscriptions: false,
    hideShortsChannel: false,
    hideShortsWatch: false,
    hideShortsTrending: false,
    hideWatchRecommendations: false,
    hideWatchPlaylist: false,
    videoQuality: "auto",
    playerSize: "default",
  };

  let settings = { ...DEFAULTS };

  const postState = () => {
    window.postMessage({ key: MSG_KEY, enabled: settings.shortsToVideo }, "*");
    window.postMessage({ key: QUALITY_KEY, quality: settings.videoQuality }, "*");
  };

  const contextClass = () => {
    const p = location.pathname;
    if (p === "/") return "ytc-ctx-home";
    if (p.startsWith("/results")) return "ytc-ctx-search";
    if (p.startsWith("/feed/subscriptions")) return "ytc-ctx-subscriptions";
    if (p.startsWith("/watch")) return "ytc-ctx-watch";
    if (p.startsWith("/feed/trending") || p.startsWith("/feed/explore") || p.startsWith("/hashtag/"))
      return "ytc-ctx-trending";
    if (p.startsWith("/@") || p.startsWith("/channel/") || p.startsWith("/c/"))
      return "ytc-ctx-channel";
    return null;
  };

  const CONTEXTS = ["home", "search", "subscriptions", "watch", "trending", "channel"];

  const applyClasses = () => {
    const root = document.documentElement;
    const ctx = contextClass();
    for (const c of CONTEXTS) root.classList.toggle(`ytc-ctx-${c}`, ctx === `ytc-ctx-${c}`);
    for (const key of HIDE_TOGGLES) {
      const cls = "ytc-" + key.replace(/[A-Z]/g, (l) => "-" + l.toLowerCase());
      let on = !!settings[key];
      root.classList.toggle(cls, on);
    }
  };

  const refresh = () => {
    applyClasses();
    applyExpandClass();
    postState();
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    scheduleResizePlayer();
  };

  api.storage.sync.get(DEFAULTS).then((res) => {
    settings = res;
    refresh();
  });

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    let touched = false;
    for (const key of Object.keys(DEFAULTS)) {
      if (changes[key]) {
        settings[key] = changes[key].newValue;
        touched = true;
      }
    }
    if (touched) refresh();
  });

  window.addEventListener("yt-navigate-start", applyClasses, true);
  window.addEventListener("yt-navigate-finish", applyClasses, true);
  window.addEventListener("yt-navigate-start", () => {
    document.documentElement.classList.remove("ytc-has-playlist");
  }, true);
  applyClasses();

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

  const rewriteAnchor = (anchor) => {
    if (!settings.shortsToVideo) return;
    const watch = toWatchUrl(anchor.href);
    if (watch) anchor.href = watch;
  };

  const rewriteTree = (root) => {
    if (!settings.shortsToVideo || !root.querySelectorAll) return;
    if (root.tagName === "A") rewriteAnchor(root);
    root.querySelectorAll('a[href*="/shorts/"]').forEach(rewriteAnchor);
  };

  const updatePlaylistPresence = () => {
    const had = document.documentElement.classList.contains("ytc-has-playlist");
    const has =
      location.pathname.startsWith("/watch") &&
      new URLSearchParams(location.search).has("list");
    document.documentElement.classList.toggle("ytc-has-playlist", has);
    applyExpandClass();
    if (had !== has) scheduleResizePlayer();
  };

  const shouldExpand = () => {
    const root = document.documentElement;
    if (!root.classList.contains("ytc-ctx-watch")) return false;
    if (!root.classList.contains("ytc-hide-watch-recommendations")) return false;
    if (root.classList.contains("ytc-has-playlist") && !root.classList.contains("ytc-hide-watch-playlist"))
      return false;
    if (settings.playerSize === "default") return false;
    return true;
  };

  const applyExpandClass = () => {
    document.documentElement.classList.toggle("ytc-expand-player", shouldExpand());
  };

  const resizePlayer = () => {
    const primary = document.querySelector("#primary");
    const columns = document.querySelector("#columns");
    if (!shouldExpand()) {
      if (primary) primary.style.removeProperty("max-width");
      if (columns) columns.style.removeProperty("max-width");
      return;
    }
    const player = document.getElementById("movie_player");
    if (!primary || !player || typeof player.setSize !== "function") return;
    primary.style.setProperty("max-width", "none", "important");
    if (columns) columns.style.setProperty("max-width", "none", "important");
    let w = primary.clientWidth;
    if (settings.playerSize === "fit") {
      const maxH = window.innerHeight - 160;
      w = Math.min(w, Math.round((maxH * 16) / 9));
    }
    if (!w) return;
    player.setSize(w, Math.round((w * 9) / 16));
  };

  const scheduleResizePlayer = () => {
    for (const delay of [0, 300, 1000]) {
      setTimeout(resizePlayer, delay);
    }
  };

  window.addEventListener("resize", resizePlayer);

  new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) rewriteTree(node);
      }
      if (m.type === "attributes" && m.target.tagName === "A") {
        rewriteAnchor(m.target);
      }
    }
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href"],
  });

  window.addEventListener("yt-navigate-finish", updatePlaylistPresence, true);
  window.addEventListener("yt-navigate-finish", () => {
    applyExpandClass();
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    scheduleResizePlayer();
  }, true);
  updatePlaylistPresence();
  scheduleResizePlayer();

  document.addEventListener(
    "click",
    (e) => {
      const anchor = e.target.closest && e.target.closest('a[href*="/shorts/"]');
      if (anchor) rewriteAnchor(anchor);
    },
    true
  );

  window.addEventListener(
    "yt-navigate-start",
    (e) => {
      if (!settings.shortsToVideo) return;
      const url = e.detail && e.detail.url;
      if (!url) return;
      const watch = toWatchUrl(url);
      if (!watch) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      location.assign(watch);
    },
    true
  );
})();

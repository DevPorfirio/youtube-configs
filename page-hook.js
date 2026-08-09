(() => {
  const SHORTS_RE = /^\/shorts\/([A-Za-z0-9_-]{6,})/;
  const MSG_KEY = "ytc-shorts-to-video";
  const QUALITY_KEY = "ytc-video-quality";

  const QUALITY_ORDER = ["tiny", "small", "medium", "large", "hd720", "hd1080", "hd1440", "hd2160", "highres"];

  let enabled = true;
  let desiredQuality = "auto";

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.key === MSG_KEY) enabled = !!e.data.enabled;
    if (e.data.key === QUALITY_KEY) {
      desiredQuality = e.data.quality;
      applyQuality();
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
      if (state === 1 || state === 3) setTimeout(applyQuality, 50);
    });
  };

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

  window.addEventListener("yt-navigate-finish", scheduleApplyQuality, true);
  window.addEventListener("load", scheduleApplyQuality);
})();

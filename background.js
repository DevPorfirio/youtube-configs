const api = typeof browser !== "undefined" ? browser : chrome;

const SHORTS_RE = /^\/shorts\/([A-Za-z0-9_-]{6,})/;

let enabled = true;

const updateIcon = () => {
  const suffix = enabled ? "" : "-gray";
  api.action.setIcon({
    path: {
      16: `icons/icon16${suffix}.png`,
      48: `icons/icon48${suffix}.png`,
      128: `icons/icon128${suffix}.png`,
    },
  });
};

api.storage.sync.get({ shortsToVideo: true }).then((res) => {
  enabled = res.shortsToVideo;
  updateIcon();
});

api.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.shortsToVideo) {
    enabled = changes.shortsToVideo.newValue;
    updateIcon();
  }
});

api.webNavigation.onBeforeNavigate.addListener((details) => {
  if (!enabled || details.frameId !== 0) return;

  const url = new URL(details.url);
  const match = url.pathname.match(SHORTS_RE);
  if (!match) return;

  const target = new URL("/watch", url.origin);
  target.searchParams.set("v", match[1]);
  const t = url.searchParams.get("t");
  if (t) target.searchParams.set("t", t);

  api.tabs.update(details.tabId, { url: target.toString() });
}, { url: [{ hostSuffix: "youtube.com", pathPrefix: "/shorts/" }] });

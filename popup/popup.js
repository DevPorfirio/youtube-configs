const api = typeof browser !== "undefined" ? browser : chrome;

const KEYS = [
  "shortsToVideo",
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

const SELECTS = ["videoQuality", "playerSize"];

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

const toggles = Object.fromEntries(KEYS.map((k) => [k, document.getElementById(k)]));
const selects = Object.fromEntries(SELECTS.map((k) => [k, document.getElementById(k)]));
const specificSection = document.getElementById("specific-toggles");

const syncSpecificState = () => {
  specificSection.classList.toggle("disabled", toggles.hideShortsAll.checked);
};

const load = () => {
  api.storage.sync
    .get(DEFAULTS)
    .then((res) => {
      for (const key of KEYS) {
        toggles[key].checked = res[key] ?? false;
      }
      for (const key of SELECTS) {
        selects[key].value = res[key] ?? DEFAULTS[key];
      }
      syncSpecificState();
    })
    .catch((err) => console.error("[YouTube Configs] storage.get falhou:", err));
};

load();

api.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  for (const key of KEYS) {
    if (changes[key] && document.activeElement !== toggles[key]) {
      toggles[key].checked = changes[key].newValue ?? false;
    }
  }
  if (changes.hideShortsAll) syncSpecificState();
});

for (const key of KEYS) {
  toggles[key].addEventListener("change", () => {
    api.storage.sync
      .set({ [key]: toggles[key].checked })
      .catch((err) => console.error("[YouTube Configs] storage.set falhou:", err));
    if (key === "hideShortsAll") syncSpecificState();
  });
}

for (const key of SELECTS) {
  selects[key].addEventListener("change", () => {
    api.storage.sync
      .set({ [key]: selects[key].value })
      .catch((err) => console.error("[YouTube Configs] storage.set falhou:", err));
  });
}

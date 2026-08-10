const api = typeof browser !== "undefined" ? browser : chrome;

const KEYS = [
  "shortsToVideo",
  "disableHoldSpeed",
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
  "originalTitles",
  "originalAudio",
  "originalDescriptions",
  "subtitlesAuto",
  "subtitlesForMyLanguage",
];

const SELECTS = ["videoQuality", "playerSize", "subtitlesLanguage", "myLanguage"];

const DEFAULTS = {
  shortsToVideo: true,
  disableHoldSpeed: true,
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
  originalTitles: false,
  originalAudio: false,
  originalDescriptions: false,
  subtitlesAuto: false,
  subtitlesLanguage: "auto",
  myLanguage: "pt",
  subtitlesForMyLanguage: false,
};

const toggles = Object.fromEntries(KEYS.map((k) => [k, document.getElementById(k)]));
const selects = Object.fromEntries(SELECTS.map((k) => [k, document.getElementById(k)]));
const specificSection = document.getElementById("specific-toggles");
const subtitlesOptions = document.getElementById("subtitles-options");

const syncSpecificState = () => {
  specificSection.classList.toggle("disabled", toggles.hideShortsAll.checked);
};

const syncSubtitlesState = () => {
  subtitlesOptions.classList.toggle("disabled", !toggles.subtitlesAuto.checked);
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
      syncSubtitlesState();
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
  if (changes.subtitlesAuto) syncSubtitlesState();
});

for (const key of KEYS) {
  toggles[key].addEventListener("change", () => {
    api.storage.sync
      .set({ [key]: toggles[key].checked })
      .catch((err) => console.error("[YouTube Configs] storage.set falhou:", err));
    if (key === "hideShortsAll") syncSpecificState();
    if (key === "subtitlesAuto") syncSubtitlesState();
  });
}

for (const key of SELECTS) {
  selects[key].addEventListener("change", () => {
    api.storage.sync
      .set({ [key]: selects[key].value })
      .catch((err) => console.error("[YouTube Configs] storage.set falhou:", err));
  });
}

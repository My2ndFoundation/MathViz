/**
 * The shell's English strings. zh.ts has exactly the same keys (typed as Messages, and
 * tests/unit/i18n.test.ts compares them at run time). Tool pages carry their own strings.
 */
export const en = {
  app: {
    loading: "Loading…",
  },
  nav: {
    search: "Search tools",
    collapse: "Collapse sidebar",
    expand: "Expand sidebar",
    notes: "Notes",
    askLibrary: "Ask the whole library",
    settings: "Settings",
    searchPlaceholder: "Filter by title or tag…",
    noResults: "No tool matches.",
    close: "Close",
    switchTo: "中文",
    switchToLabel: "Switch to Chinese",
  },
  settings: {
    language: "Language",
    langEn: "English",
    langZh: "中文",
  },
  content: {
    none: "No content pack is installed.",
    noneBody:
      "The tools come in a content pack. Install it from the PrimeForge store, or import a .pfaddon file you already have.",
    fromStore: "Install from the store",
    fromStoreBody:
      "Open this app's page in the PrimeForge store and install its content pack; the app picks it up when you reload.",
    importLocal: "Import a local content pack",
    importing: "Importing…",
    version: "Content version {version}",
  },
  tool: {
    notFound: "This tool is not in the installed content pack.",
  },
  error: {
    bad_host: "The request did not come from this app's address.",
    bad_origin: "The request came from another site.",
    cross_site: "The request came from another site.",
    bad_csrf: "The page's session has expired. Reload the page and try again.",
    method_not_allowed: "That action is not allowed here.",
    body_too_large: "The request is too large.",
    bad_json: "The request could not be read.",
    bad_request: "The request is not valid.",
    not_gzip: "That file is not a content pack (.pfaddon).",
    bad_addon: "That file is not a content pack for this app, or it is damaged.",
    not_found: "Not found.",
    read_only:
      "This data was written by a newer version of the app; it can be read but not changed.",
    not_ready: "The app is still starting. Try again in a moment.",
    internal: "Something went wrong.",
  },
};

export type Messages = typeof en;

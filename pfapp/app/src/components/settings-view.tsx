"use client";

// After MathTestBuddy trainer/src/components/settings/settings-tabs.tsx (the side menu),
// use-save-setting.ts + save-status.tsx (save on change, "Saving… / Saved / error") and
// general-settings.tsx (radio groups). Kept: one menu entry per section, the section named in the
// URL hash (read after hydration and on hashchange, written with replaceState so nothing scrolls),
// every section mounted and only the chosen one shown (an install in progress keeps its progress),
// each section a heading, a help line and one card. Changed: our CSS instead of shadcn Tabs (a
// tablist of buttons with aria-selected), three sections (general, content, ai), no
// router.refresh() after a save (nothing server-rendered here reads aiLang).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useId, useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import type { AiLang } from "@/lib/server/settings";
import { useAiJobs } from "./ai/use-ai-jobs";
import { ImportPack } from "./import-pack";
import { OnlinePack } from "./online-pack";
import { api, errorText } from "./qa/api";

export const SETTINGS_TABS = ["general", "content", "ai"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

/** The tab an address's hash names ("#ai" or "ai"), or the first tab. */
export function tabFromHash(hash: string): SettingsTab {
  const id = hash.replace(/^#/, "");
  return (SETTINGS_TABS as readonly string[]).includes(id) ? (id as SettingsTab) : SETTINGS_TABS[0];
}

export interface SettingsData {
  aiLang: AiLang;
  content: { version: string; source: "store" | "manual" } | null;
  ai: { state: "available" | "not_authorised" | "unavailable"; code: string | null };
}

function useSave(locale: Locale) {
  const [state, setState] = useState<{ saving: boolean; saved: boolean; error: string | null }>({
    saving: false,
    saved: false,
    error: null,
  });
  const save = useCallback(
    async (patch: Record<string, string>): Promise<boolean> => {
      setState({ saving: true, saved: false, error: null });
      try {
        await api("PUT", "/api/settings", patch);
        setState({ saving: false, saved: true, error: null });
        return true;
      } catch (e) {
        setState({ saving: false, saved: false, error: errorText(e, locale) });
        return false;
      }
    },
    [locale],
  );
  return { save, ...state };
}

function SaveStatus({
  locale,
  saving,
  saved,
  error,
}: {
  locale: Locale;
  saving: boolean;
  saved: boolean;
  error: string | null;
}) {
  const t = MESSAGES[locale].settings;
  if (error)
    return (
      <p role="alert" className="err small" data-testid="save-status">
        {error}
      </p>
    );
  return (
    <p className="muted small save-status" aria-live="polite" data-testid="save-status">
      {saving ? t.saving : saved ? t.saved : ""}
    </p>
  );
}

function Radios<V extends string>({
  name,
  legend,
  help,
  value,
  options,
  onChange,
  testid,
}: {
  name: string;
  legend: string;
  help?: string;
  value: V;
  options: readonly (readonly [V, string])[];
  onChange: (v: V) => void;
  testid: string;
}) {
  const id = useId();
  return (
    <fieldset className="set-field" data-testid={testid}>
      <legend>{legend}</legend>
      <div className="set-radios">
        {options.map(([v, label]) => (
          <label key={v} htmlFor={`${id}-${v}`} className="set-radio">
            <input
              id={`${id}-${v}`}
              type="radio"
              name={name}
              value={v}
              checked={value === v}
              onChange={() => onChange(v)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {help ? <p className="muted small">{help}</p> : null}
    </fieldset>
  );
}

function General({ locale, data }: { locale: Locale; data: SettingsData }) {
  const t = MESSAGES[locale].settings;
  const router = useRouter();
  const [aiLang, setAiLang] = useState<AiLang>(data.aiLang);
  const { save, ...status } = useSave(locale);
  const lang = useSave(locale);

  async function switchLang(next: Locale) {
    if (next === locale) return;
    // the stored language picks what `/` opens in; the URL's is what this page renders in
    await lang.save({ lang: next });
    router.push(`/${next}/settings${window.location.hash}`);
  }

  return (
    <div className="set-stack">
      <Radios
        name="lang"
        legend={t.language}
        help={t.languageHelp}
        value={locale}
        options={[
          ["en", t.langEn],
          ["zh", t.langZh],
        ]}
        onChange={(v) => void switchLang(v)}
        testid="set-lang"
      />
      <Radios
        name="aiLang"
        legend={t.aiLang}
        help={t.aiLangHelp}
        value={aiLang}
        options={[
          ["page", t.aiLangPage],
          ["en", t.aiLangEn],
          ["zh", t.aiLangZh],
        ]}
        onChange={(v) => {
          setAiLang(v);
          void save({ aiLang: v });
        }}
        testid="set-ai-lang"
      />
      <SaveStatus locale={locale} {...(lang.error ? lang : status)} />
    </div>
  );
}

function Content({ locale, data }: { locale: Locale; data: SettingsData }) {
  const t = MESSAGES[locale].settings;
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  const c = data.content;
  return (
    <div className="set-stack">
      <div className="set-field" data-testid="set-installed">
        <h3>{t.installed}</h3>
        {c ? (
          <p>
            <span className="mono" data-testid="set-installed-version">
              {t.installedVersion.replace("{version}", c.version)}
            </span>
            <span className="muted">
              {" "}
              · {c.source === "store" ? t.sourceStore : t.sourceManual}
            </span>
          </p>
        ) : (
          <p className="muted">{t.noneInstalled}</p>
        )}
      </div>
      <div className="set-field">
        <h3>{MESSAGES[locale].online.title}</h3>
        <OnlinePack locale={locale} onChange={() => router.refresh()} />
      </div>
      <div className="set-field">
        <h3>{t.importTitle}</h3>
        <p className="muted small">{t.importHelp}</p>
        <ImportPack
          locale={locale}
          onDone={(r) => {
            setNote(t.imported.replace("{version}", r.version));
            router.refresh();
          }}
        />
        <p className="small" aria-live="polite" data-testid="import-note">
          {note ?? ""}
        </p>
      </div>
    </div>
  );
}

/**
 * The AI card reads GET /api/ai/jobs, the top bar's AI indicator's source, so the two never
 * disagree; the server-rendered status shows until the first answer (and stays on a failed read).
 */
function Ai({ locale, data }: { locale: Locale; data: SettingsData }) {
  const t = MESSAGES[locale].settings;
  const errors = MESSAGES[locale].error as Record<string, string>;
  const live = useAiJobs().data;
  const { state, code } = live ? { state: live.ai.state, code: live.ai.reason } : data.ai;
  const reason =
    code === "not_registered" ? t.aiNotRegistered : code ? (errors[code] ?? null) : null;
  return (
    <div className="set-stack" data-testid="set-ai" data-state={state}>
      <p className="set-ai">
        <span className="light" data-tone={state} aria-hidden="true" />
        <span>
          {state === "available"
            ? t.aiAvailable
            : state === "not_authorised"
              ? t.aiNotAuthorised
              : t.aiUnavailable}
        </span>
      </p>
      {reason ? <p className="muted small">{reason}</p> : null}
    </div>
  );
}

/** Settings (design: MTB's Settings page): a side menu of sections and the chosen one beside it. */
export function SettingsView({ locale, data }: { locale: Locale; data: SettingsData }) {
  const t = MESSAGES[locale].settings;
  const [tab, setTab] = useState<SettingsTab>(SETTINGS_TABS[0]);

  useEffect(() => {
    const read = () => setTab(tabFromHash(window.location.hash));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const choose = (next: SettingsTab) => {
    setTab(next);
    window.history.replaceState(window.history.state, "", `#${next}`);
  };
  // the WAI-ARIA tabs pattern (vertical, automatic activation): one tab stop, Up/Down wrap,
  // Home/End; the chosen tab takes the focus (review M4)
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = SETTINGS_TABS.indexOf(tab);
    const n = SETTINGS_TABS.length;
    const to =
      e.key === "ArrowDown"
        ? (i + 1) % n
        : e.key === "ArrowUp"
          ? (i - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : -1;
    if (to < 0) return;
    e.preventDefault();
    const next = SETTINGS_TABS[to] as SettingsTab;
    choose(next);
    document.getElementById(`set-tab-${next}`)?.focus();
  };

  const sections: { id: SettingsTab; title: string; help: string; body: ReactNode }[] = [
    {
      id: "general",
      title: t.general,
      help: t.generalHelp,
      body: <General locale={locale} data={data} />,
    },
    {
      id: "content",
      title: t.content,
      help: t.contentHelp,
      body: <Content locale={locale} data={data} />,
    },
    { id: "ai", title: t.ai, help: t.aiHelp, body: <Ai locale={locale} data={data} /> },
  ];

  return (
    <div className="qa-page set-page" data-testid="settings">
      <div className="qa-page-head">
        {/* no content pack: no sidebar either, and the app window has no back button (review M5) */}
        {data.content ? null : (
          <Link href={`/${locale}`} className="set-back" data-testid="settings-back">
            {t.back}
          </Link>
        )}
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
      </div>
      <div className="set-grid">
        <div className="set-menu" role="tablist" aria-label={t.menu} aria-orientation="vertical">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`set-tab-${s.id}`}
              aria-selected={tab === s.id}
              aria-controls={`set-panel-${s.id}`}
              tabIndex={tab === s.id ? 0 : -1}
              data-testid={`settings-tab-${s.id}`}
              onClick={() => choose(s.id)}
              onKeyDown={onTabKey}
            >
              {s.title}
            </button>
          ))}
        </div>
        {sections.map((s) => (
          <section
            key={s.id}
            id={`set-panel-${s.id}`}
            role="tabpanel"
            aria-labelledby={`set-tab-${s.id}`}
            hidden={tab !== s.id}
            className="set-panel"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA tabs — a panel whose first content is not focusable (AI) takes the tab stop after the tab list
            tabIndex={0}
            data-testid={`settings-panel-${s.id}`}
          >
            <h2>{s.title}</h2>
            <p className="muted small">{s.help}</p>
            <div className="set-card">{s.body}</div>
          </section>
        ))}
      </div>
    </div>
  );
}

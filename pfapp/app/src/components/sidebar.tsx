"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import type { ShellGroup } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n/locale";
import { AiIndicator } from "./ai/ai-indicator";
import { AiJobsProvider } from "./ai/use-ai-jobs";
import { accentColor, CommandK } from "./command-k";
import { LangSwitch } from "./lang-switch";
import { AskToggle } from "./qa/ask-toggle";

/** A path segment decoded; a malformed `%` escape stays as it is instead of throwing. */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export interface ShellText {
  search: string;
  searchPlaceholder: string;
  noResults: string;
  close: string;
  collapse: string;
  expand: string;
  switchTo: string;
  switchToLabel: string;
  contentVersion: string;
  notes: string;
  askLibrary: string;
  settings: string;
}

/**
 * The shell (design §7.2): the sidebar re-implemented natively after the web version's
 * python/app.html — groups in the pack's order, tools in registry order, labels in the URL's
 * language, the current tool highlighted (aria-current), each tool's version — plus a thin top bar
 * (the page's title, on a tool page the ask panel's toggle, the AI indicator) above the stage the page renders into, the collapse edge
 * and ⌘K.
 */
export function Shell({
  groups,
  locale,
  appName,
  text,
  children,
}: {
  groups: ShellGroup[];
  locale: Locale;
  appName: { eyebrow: string; name: string };
  text: ShellText;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const current = safeDecode(pathname.match(/^\/[^/]+\/tool\/([^/]+)/)?.[1] ?? "");
  const [collapsed, setCollapsed] = useState(false);
  const [searching, setSearching] = useState(false);
  const onOpenChange = useCallback((o: boolean) => setSearching(o), []);
  const items = groups.flatMap((g) => g.items);
  const page = pathname.split("/")[2] ?? "";
  const pageTitle =
    page === "tool"
      ? (items.find((it) => it.id === current)?.title[locale] ?? "")
      : page === "ask"
        ? text.askLibrary
        : page === "notes"
          ? text.notes
          : page === "settings"
            ? text.settings
            : "";

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("pfapp-sidebar") === "collapsed");
    } catch {
      // no storage: open
    }
  }, []);
  const toggle = (c: boolean) => {
    setCollapsed(c);
    try {
      localStorage.setItem("pfapp-sidebar", c ? "collapsed" : "open");
    } catch {
      // no storage: this session only
    }
  };

  return (
    <AiJobsProvider>
      <div className="shell" data-collapsed={collapsed}>
        {/* inert when collapsed: its links leave the tab order and the accessibility tree */}
        <nav className="sidebar" aria-label={appName.name} data-testid="sidebar" inert={collapsed}>
          <div className="sb-head">
            <Link href={`/${locale}`} className="brand no-underline">
              <span className="eyebrow">{appName.eyebrow}</span>
              <span className="name">{appName.name}</span>
            </Link>
            <button
              type="button"
              className="iconbtn"
              title={text.collapse}
              aria-label={text.collapse}
              onClick={() => toggle(true)}
            >
              ◀
            </button>
          </div>
          <button
            type="button"
            className="chip sb-search"
            data-testid="search-open"
            onClick={() => setSearching(true)}
          >
            <span>{text.search}</span>
            <kbd>⌘K</kbd>
          </button>
          <div className="sb-links">
            {(
              [
                ["ask", text.askLibrary],
                ["notes", text.notes],
              ] as const
            ).map(([page, label]) => (
              <Link
                key={page}
                href={`/${locale}/${page}`}
                className="item"
                data-testid={`nav-${page}`}
                aria-current={pathname === `/${locale}/${page}` ? "page" : undefined}
              >
                <span className="dot" />
                <span className="tx">{label}</span>
              </Link>
            ))}
          </div>
          <div className="sb-list">
            {groups.map((g) => (
              <section key={g.id} data-testid="sidebar-group" data-group={g.id}>
                <div className="grp" data-testid="sidebar-group-label">
                  {g.label[locale]}
                </div>
                {g.items.map((it) => (
                  <Link
                    key={it.id}
                    href={`/${locale}/tool/${encodeURIComponent(it.id)}`}
                    className="item"
                    data-testid="sidebar-item"
                    data-id={it.id}
                    aria-current={it.id === current ? "page" : undefined}
                    style={{ "--c": accentColor(it.accent) } as never}
                  >
                    <span className="dot" />
                    <span className="tx">{it.title[locale]}</span>
                    <span className="ver" data-testid="sidebar-item-version">
                      v{it.version}
                    </span>
                  </Link>
                ))}
              </section>
            ))}
          </div>
          {/* the "System" place at the bottom, as in Math Test Buddy's sidebar */}
          <div className="sb-links sb-sys">
            <Link
              href={`/${locale}/settings`}
              className="item"
              data-testid="nav-settings"
              aria-current={pathname === `/${locale}/settings` ? "page" : undefined}
            >
              <span className="dot" />
              <span className="tx">{text.settings}</span>
            </Link>
          </div>
          <div className="sb-foot">
            <span data-testid="content-version">{text.contentVersion}</span>
            <span className="sp" />
            <LangSwitch locale={locale} label={text.switchTo} title={text.switchToLabel} />
          </div>
        </nav>
        <button
          type="button"
          className="edge"
          title={text.expand}
          aria-label={text.expand}
          onClick={() => toggle(false)}
        >
          ▶
        </button>
        <div className="main-col">
          {/* the top bar (after Math Test Buddy's): where she is, and the AI indicator at the end */}
          <header className="topbar" data-testid="topbar">
            <div className="tb-title" data-testid="page-title">
              {pageTitle}
            </div>
            {/* tool pages only: the ask panel's toggle, beside the AI indicator */}
            {page === "tool" && items.some((it) => it.id === current) ? (
              <AskToggle locale={locale} />
            ) : null}
            <AiIndicator locale={locale} />
          </header>
          <main className="stage" data-testid="stage">
            {children}
          </main>
        </div>
        <CommandK
          items={items}
          locale={locale}
          open={searching}
          onOpenChange={onOpenChange}
          placeholder={text.searchPlaceholder}
          noResults={text.noResults}
          closeLabel={text.close}
        />
      </div>
    </AiJobsProvider>
  );
}

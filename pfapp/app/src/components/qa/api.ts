import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import { csrfHeaders } from "../csrf";

/** The Q&A pages' JSON calls (lib/server/qa.ts) and the shapes they return. */

export interface Citation {
  id: string;
  title: { en: string; zh: string };
  /** Locale-less path in this app; links prefix the locale. */
  href: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations: Citation[];
  noteId: string | null;
  createdAt: string;
}

export interface Job {
  id: string;
  status: string;
  threadId: string;
  workflow: string;
  error: string | null;
}

export interface Thread {
  id: string;
  title: string;
  workflow: string | null;
  subjects: { type: string; id: string }[];
  messages: Message[];
  job: Job | null;
}

export interface Note {
  id: string;
  messageId: string;
  threadId: string;
  threadTitle: string;
  question: string;
  text: string;
  citations: Citation[];
  subjects: NoteSubject[];
  createdAt: string;
}

/** A note's subject (lib/server/qa SubjectView): a program or blank also names its tool. */
export interface NoteSubject {
  type: string;
  id: string;
  title: { en: string; zh: string } | null;
  toolId: string | null;
  programId: string | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`HTTP ${status} ${code}`);
  }
}

export async function api<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== "GET") Object.assign(headers, await csrfHeaders());
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers,
    cache: "no-store",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null as T;
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const code = (data as { error?: { code?: unknown } } | null)?.error?.code;
    throw new ApiError(res.status, typeof code === "string" ? code : "internal");
  }
  return data as T;
}

/** A thrown API error as the shell's message for it. */
export function errorText(e: unknown, locale: Locale): string {
  const errors = MESSAGES[locale].error as Record<string, string>;
  const code = e instanceof ApiError ? e.code : "internal";
  return errors[code] ?? errors.internal ?? code;
}

/** Job statuses still waiting for an answer (lib/ai/jobs OPEN). */
export const OPEN_STATUSES = ["queued", "running"];

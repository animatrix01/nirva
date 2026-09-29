/**
 * report-speech — narration script + offline voice helpers for the
 * completed-investigation report page.
 *
 * AIR-GAP RULE: only voices with `localService === true` are ever selected,
 * so the browser can never fall back to cloud (network) voices. Speech
 * synthesis itself runs 100% on-device; Hindi translation goes through the
 * local model gateway (see `app/api/translate/route.ts`), never the cloud.
 *
 * WHAT GETS SPOKEN: primary finding + recommended action only. Evidence
 * bullets, citations, confidence numbers, asset history, diagrams, and UI
 * tags are deliberately excluded — see `buildSpeechScript`.
 */

import type { ParsedFindings } from "./parse-findings";

export type SpeechLang = "en" | "hi";

/** Translation backend (local model gateway) is unreachable. */
export class ModelUnavailableError extends Error {
  constructor(message = "On-device translation model is unavailable") {
    super(message);
    this.name = "ModelUnavailableError";
  }
}

/**
 * Compose the narration script. Only the two sentences a supervisor needs:
 * the primary finding and the recommended action. Everything else on the
 * report page (evidence lists, citations, confidence %, asset history,
 * diagrams, status tags) is excluded by construction.
 */
export function buildSpeechScript(parsed: ParsedFindings | null): string {
  if (!parsed) return "";
  const parts: string[] = [];
  if (parsed.primaryFinding?.trim()) {
    parts.push(cleanForSpeech(parsed.primaryFinding));
  }
  if (parsed.recommendedAction?.trim()) {
    parts.push(cleanForSpeech(parsed.recommendedAction));
  }
  return parts.filter(Boolean).join(".  ");
}

/**
 * Strip markdown and expand plant abbreviations for fluent, intelligible
 * offline TTS. Keeps the meaning but makes P-204 / 4.2 kN / WO / OEM
 * pronounceable without the "dash" stutter.
 */
export function cleanForSpeech(raw: string): string {
  let s = raw
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  // Plant IDs — "P-204" → "P 204" (avoids "P dash two-oh-four" stutter)
  s = s.replace(/\b([A-Z])-(\d)/g, "$1 $2");
  // Work orders — "WO-88712" → "W O 88712"
  s = s.replace(/\bWO-?(\d+)\b/gi, "W O $1");
  // Units — "kN" → "kilo newtons" (fluent vs "kay en")
  s = s.replace(/\bkN\b/g, "kilo newtons");
  s = s.replace(/\bPSI\b/gi, "P S I");
  // Acronyms — spell out for clarity
  s = s.replace(/\bOEM\b/g, "O E M");
  s = s.replace(/\bSOP\b/g, "S O P");
  return s.replace(/\s+/g, " ").trim();
}

type VoiceLike = Pick<SpeechSynthesisVoice, "lang" | "localService" | "name">;

/**
 * English locales we will NOT auto-select. Windows ships a British English
 * voice in almost every install (George / Hazel / Susan), so a naive
 * "first en-* match" reliably lands on en-GB — which is why narration
 * sounded British on a machine with no voice packs installed. The report is
 * read aloud to plant engineers, so US English is the house accent.
 */
const NON_PREFERRED_EN_LOCALES = ["en-gb", "en-au", "en-ie", "en-nz", "en-za"];

/** Voice-name fragments that identify those same British/AU voices. */
const NON_PREFERRED_EN_NAMES = [
  "george",
  "hazel",
  "susan",
  "james",
  "catherine",
  "sean",
  "sonia",
  "ryan",
];

/**
 * THE REPORT VOICE.
 *
 * "Microsoft Guy (Natural)" is the house voice for narration: US English, and
 * a natural neural voice, which reads the long evidence sentences in a report
 * far more clearly than the legacy SAPI voices.
 *
 * NOTE ON AVAILABILITY: Natural Voices ship separately from Windows and are
 * NOT present on every machine. When Guy is installed this list wins outright.
 * When it is not, selection falls through to the other preferred names and
 * then to any non-British local English voice, so the Listen button always
 * produces speech rather than an error. Guy's name is listed first, and only
 * first — hard-coding Guy alone would silence narration on any machine where
 * the optional voice pack is absent.
 *
 * Install path: Settings > Accessibility > Narrator > Add natural voices, or
 * `Win+Ctrl+N` > Choose a voice. A Windows restart is usually required before
 * the browser can see it.
 */
const PREFERRED_VOICE_NAMES = [
  // en-US natural (Microsoft) — the intended narration voice
  "guy",
  "jenny",
  "aria",
  // en-IN natural (Microsoft)
  "neerja",
  "prabhat",
  // Any voice whose name advertises a natural/neural voice.
  "natural",
  // en-US / en-IN legacy — audible fallback only
  "david",
  "zira",
  "mark",
  "heera",
  "ravi",
];

/** Normalise a BCP-47 tag to the lowercase hyphenated form used throughout. */
function normLang(lang: string): string {
  return lang.toLowerCase().replace(/_/g, "-");
}

/** True when the voice's locale starts with any of the given prefixes. */
function langStartsWith(lang: string, prefixes: readonly string[]): boolean {
  const l = normLang(lang);
  return prefixes.some((p) => l.startsWith(p));
}

function isNonPreferredEnglish(v: VoiceLike): boolean {
  if (langStartsWith(v.lang, NON_PREFERRED_EN_LOCALES)) return true;
  const name = v.name.toLowerCase();
  return NON_PREFERRED_EN_NAMES.some((bad) => name.includes(bad));
}

/**
 * Read a `?voice=` override so a specific voice can be auditioned without a
 * code change. Matched case-insensitively as a substring of the voice name.
 * Only on-device voices are honoured, so the override cannot pull in a cloud
 * voice and break the air-gap rule. Unknown names fall back to normal
 * selection rather than erroring.
 */
export function pickVoiceByName(
  needle: string,
  voices: readonly VoiceLike[],
): SpeechSynthesisVoice | null {
  const q = needle.trim().toLowerCase();
  if (!q) return null;
  const hit = voices.find(
    (v) => v.localService && v.name.toLowerCase().includes(q),
  );
  return (hit as SpeechSynthesisVoice | undefined) ?? null;
}

/** The `?voice=` param from the current URL, or null. Safe on the server. */
export function voiceOverrideFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = new URLSearchParams(window.location.search).get("voice");
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}

/**
 * Why a particular voice was chosen. Surfaced by `diagnoseVoice` so the UI can
 * explain itself instead of leaving the operator guessing from the audio.
 *
 *  - "house"    → the intended voice (Microsoft Guy (Natural)) is speaking
 *  - "named"    → another preferred named voice (Jenny, Aria, Neerja…)
 *  - "locale"   → no preferred name matched, but a clean non-British voice did
 *  - "british"  → only a British voice exists locally (last resort)
 *  - "override" → forced via ?voice=
 *  - "none"     → no local voice at all; narration cannot play
 */
export type VoicePickSource =
  | "house"
  | "named"
  | "locale"
  | "british"
  | "override"
  | "none";

export interface VoiceDiagnosis {
  /** Local (on-device) voices the browser reported. */
  local: VoiceLike[];
  /** Name of the voice `pickVoice` would use, or null. */
  selected: string | null;
  /** Its locale, or empty when null. */
  selectedLang: string;
  /** Which list entry / branch produced the choice. */
  source: VoicePickSource;
  /** True only when the intended house voice is the one selected. */
  isHouseVoice: boolean;
  /** One-line, actionable instruction — empty when all is well. */
  hint: string;
}

/** The intended narration voice, matched the same way PREFERRED_VOICE_NAMES is. */
const HOUSE_VOICE_MATCH = "guy";

function isHouseVoice(name: string): boolean {
  return name.toLowerCase().includes(HOUSE_VOICE_MATCH);
}

/**
 * Explain, in data, which voice the Listen button will use and why.
 *
 * This exists because "does it sound right?" is not a reliable way to verify a
 * voice: a legacy robot voice and a correctly-selected natural voice are easy
 * to confuse by ear, and a missing Natural Voices pack is otherwise
 * indistinguishable from a selection bug. Callers render this verbatim.
 *
 * Accepts an injectable list for tests; reads `speechSynthesis.getVoices()`
 * otherwise. Never throws.
 */
export function diagnoseVoice(
  lang: SpeechLang = "en",
  voices?: readonly VoiceLike[],
  preferName?: string | null,
): VoiceDiagnosis {
  const list: readonly VoiceLike[] =
    voices ??
    (typeof window !== "undefined" && "speechSynthesis" in window
      ? window.speechSynthesis.getVoices()
      : []);
  const local = list.filter((v) => v.localService);

  const selected = pickVoice(lang, list, preferName);
  const name = selected?.name ?? null;

  if (!name) {
    return {
      local,
      selected: null,
      selectedLang: "",
      source: "none",
      isHouseVoice: false,
      hint: "No on-device voice is available. Install a Windows text-to-speech voice pack (Settings > Time & language > Language options > Text-to-speech > Download).",
    };
  }

  const forced = preferName
    ? (pickVoiceByName(preferName, list)?.name ?? null)
    : null;

  let source: VoicePickSource;
  if (forced === name) {
    source = "override";
  } else if (isHouseVoice(name)) {
    source = "house";
  } else if (
    PREFERRED_VOICE_NAMES.some((n) => n !== "natural" && name.toLowerCase().includes(n))
  ) {
    source = "named";
  } else if (isNonPreferredEnglish(selected as VoiceLike)) {
    source = "british";
  } else {
    source = "locale";
  }

  let hint = "";
  if (source === "house") {
    hint = "";
  } else if (lang === "en") {
    hint =
      'Microsoft Guy (Natural) is not installed, so narration fell back to a legacy voice. ' +
      "Install it via Settings > Accessibility > Narrator > Add natural voices > " +
      'English (United States) > "Microsoft Guy (Natural)", then restart Windows.';
  }

  return {
    local,
    selected: name,
    selectedLang: normLang(selected?.lang ?? ""),
    source,
    isHouseVoice: source === "house",
    hint,
  };
}

/**
 * Pick an ON-DEVICE voice. Network (cloud) voices are never eligible, even
 * if no local voice exists — returns null instead so callers degrade
 * honestly. Accepts an injectable list for tests; reads
 * `speechSynthesis.getVoices()` otherwise.
 *
 * `preferName` forces a specific voice (from `?voice=`). It is only honoured
 * when that voice is present AND local; otherwise normal selection runs, so a
 * stale bookmark on another machine still produces a working voice.
 */
export function pickVoice(
  lang: SpeechLang,
  voices?: readonly VoiceLike[],
  preferName?: string | null,
): SpeechSynthesisVoice | null {
  const list: readonly VoiceLike[] =
    voices ??
    (typeof window !== "undefined" && "speechSynthesis" in window
      ? window.speechSynthesis.getVoices()
      : []);
  const local = list.filter((v) => v.localService);
  if (local.length === 0) return null;

  if (preferName) {
    const forced = pickVoiceByName(preferName, list);
    if (forced) return forced;
  }

  const startsWith = (prefixes: readonly string[]) =>
    local.find((v) => langStartsWith(v.lang, prefixes)) as
      | SpeechSynthesisVoice
      | undefined;

  if (lang === "hi") {
    return startsWith(["hi"]) ?? null;
  }

  // ── ENGLISH SELECTION ──────────────────────────────────────────────────────
  // 1. The named house voice ("Microsoft Guy (Natural)"), then the other
  //    natural voices, then legacy. This is checked BEFORE any locale logic so
  //    that installing Guy is all it takes for him to take over — no further
  //    code change, no reload ordering to worry about.
  for (const needle of PREFERRED_VOICE_NAMES) {
    const byName = pickVoiceByName(needle, local) as
      | SpeechSynthesisVoice
      | undefined;
    // A British voice is never auto-selected, even if it appears in this list.
    if (byName && !isNonPreferredEnglish(byName)) return byName;
  }

  // 2. Any other local English voice that is not British/AU/IE, so the button
  //    still speaks on a machine with no natural voice installed.
  const anyGoodEnglish = local.find(
    (v) => langStartsWith(v.lang, ["en"]) && !isNonPreferredEnglish(v),
  ) as SpeechSynthesisVoice | undefined;
  if (anyGoodEnglish) return anyGoodEnglish;

  // 3. Last resort: ANY local English voice, even a British one. A robotic
  //    British narration still beats an error message, so this stays rather
  //    than returning null.
  return startsWith(["en"]) ?? null;
}

/**
 * Resolve the voice list, waiting for the browser's async voice loading
 * (`voiceschanged`) when the first read comes back empty.
 */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve([]);
  }
  const synth = window.speechSynthesis;
  const current = synth.getVoices();
  if (current.length > 0) return Promise.resolve(current);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(synth.getVoices()), 1500);
    const onChange = () => {
      window.clearTimeout(timer);
      synth.removeEventListener("voiceschanged", onChange);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", onChange);
  });
}

export interface SpeakCallbacks {
  onEnd?: () => void;
  onError?: (event: SpeechSynthesisErrorEvent) => void;
}

/** Speak fluently: single utterance with confident prosody. Fully offline. */
export function speak(
  text: string,
  voice: SpeechSynthesisVoice,
  callbacks: SpeakCallbacks = {},
): void {
  stop();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.voice = voice;
  // Set the locale from the voice we actually chose, normalised to the
  // BCP-47 form the engine expects. Inheriting voice.lang verbatim can
  // disagree with the voice's own tuning and mispronounce the reading.
  utterance.lang = voice.lang.toLowerCase().replace(/_/g, "-");
  // Deliberately unhurried: plant findings contain numbers, unit names and
  // asset IDs, and a slightly slow, mid pitch stays intelligible on a noisy
  // plant floor.
  utterance.rate = 0.92;
  utterance.pitch = 0.96;
  utterance.volume = 1;
  if (callbacks.onEnd) utterance.onend = callbacks.onEnd;
  if (callbacks.onError) utterance.onerror = callbacks.onError;
  window.speechSynthesis.speak(utterance);
}

/** Stop any ongoing speech. Safe to call when idle or unsupported. */
export function stop(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

/** Translate report narration to Hindi via the on-device model gateway. */
export async function translateToHindi(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) throw new ModelUnavailableError("Nothing to translate");
  let res: Response;
  try {
    res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed.slice(0, 2000), targetLang: "hi" }),
    });
  } catch {
    throw new ModelUnavailableError("Translation service unreachable");
  }
  if (!res.ok) throw new ModelUnavailableError("Translation service unavailable");
  const data: unknown = await res.json().catch(() => null);
  const translated =
    typeof data === "object" && data !== null && "text" in data
      ? String((data as { text: unknown }).text ?? "").trim()
      : "";
  if (!translated) throw new ModelUnavailableError("Empty translation result");
  return translated;
}

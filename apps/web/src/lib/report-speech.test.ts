import { describe, expect, it } from "vitest";
import {
  buildSpeechScript,
  cleanForSpeech,
  pickVoice,
} from "./report-speech";
import type { ParsedFindings } from "./parse-findings";

function parsed(overrides: Partial<ParsedFindings> = {}): ParsedFindings {
  return {
    title: null,
    primaryFinding: null,
    supportingEvidence: [],
    contradiction: null,
    recommendedAction: null,
    remainder: "",
    ...overrides,
  };
}

type StubVoice = Pick<SpeechSynthesisVoice, "lang" | "localService" | "name">;

const stub = (
  name: string,
  lang: string,
  localService: boolean,
): StubVoice => ({ name, lang, localService });

describe("buildSpeechScript", () => {
  it("speaks primary finding + recommended action only", () => {
    const script = buildSpeechScript(
      parsed({
        title: "Root Cause Analysis — Pump P-204",
        primaryFinding: "Bearing wear caused repeated failure of Pump P-204.",
        supportingEvidence: ["WO-88712 records 5.8 kN load", "OEM manual rev C p.41"],
        contradiction: "OEM specifies 4.2 kN but WO-88712 records 5.8 kN.",
        recommendedAction: "Replace the bearing per OEM spec 4.2 kN.",
      }),
    );
    expect(script).toContain("Bearing wear caused repeated failure");
    expect(script).toContain("Replace the bearing per O E M spec");
    // Deliberately excluded: evidence, contradiction, title, confidence
    expect(script).not.toContain("WO-88712 records");
    expect(script).not.toContain("OEM specifies 4.2 kN but");
    expect(script).not.toContain("Root Cause Analysis");
    expect(script).not.toContain("87");
  });

  it("returns empty string when nothing narratable exists", () => {
    expect(buildSpeechScript(parsed())).toBe("");
    expect(buildSpeechScript(null)).toBe("");
    expect(
      buildSpeechScript(parsed({ supportingEvidence: ["some bullet"] })),
    ).toBe("");
  });

  it("expands equipment IDs and specs for pronunciation", () => {
    const script = buildSpeechScript(
      parsed({ primaryFinding: "Pump P-204 failed at 4.2 kN per WO-88712." }),
    );
    expect(script).toContain("P 204");
    expect(script).not.toContain("P-204");
    expect(script).toContain("kilo newtons");
    expect(script).not.toContain("kN");
    expect(script).toContain("W O 88712");
    expect(script).not.toContain("WO-88712");
  });
});

describe("cleanForSpeech", () => {
  it("strips markdown and expands plant abbreviations", () => {
    expect(cleanForSpeech("**Primary finding:** Pump P-204 failed.")).toBe(
      "Primary finding: Pump P 204 failed.",
    );
    expect(cleanForSpeech("## Root Cause — `bearing`")).toBe(
      "Root Cause — bearing",
    );
    expect(cleanForSpeech("OEM spec 4.2 kN, check SOP and WO-100")).toBe(
      "O E M spec 4.2 kilo newtons, check S O P and W O 100",
    );
  });
});

describe("pickVoice — on-device only", () => {
  const voices: StubVoice[] = [
    stub("Google हिन्दी", "hi-IN", false), // network: must NEVER win
    stub("Microsoft Swara", "hi-IN", true),
    stub("Microsoft Zira", "en-US", true),
  ];

  it("picks the local Hindi voice, never a network one", () => {
    expect(pickVoice("hi", voices)?.name).toBe("Microsoft Swara");
  });

  it("returns null for Hindi when only network voices exist", () => {
    expect(
      pickVoice("hi", [stub("Google हिन्दी", "hi-IN", false)]),
    ).toBeNull();
  });

  it("prefers en-US, then en-IN, then any other English", () => {
    expect(
      pickVoice("en", [
        stub("Microsoft Zira", "en-US", true),
        stub("Microsoft Heera", "en-IN", true),
      ])?.name,
    ).toBe("Microsoft Zira");
    expect(
      pickVoice("en", [
        stub("Microsoft Heera", "en-IN", true),
        stub("Microsoft Zira", "en-US", true),
      ])?.name,
    ).toBe("Microsoft Zira");
    expect(pickVoice("en", voices)?.name).toBe("Microsoft Zira");
  });

  it("never auto-selects a British voice when a US one exists", () => {
    // The regression this guards: Windows ships a GB English voice in almost
    // every install, so a naive first-en-match returned en-GB and the report
    // narration came out British on machines with no voice packs installed.
    expect(
      pickVoice("en", [
        stub("Microsoft Hazel", "en-GB", true),
        stub("Microsoft Zira", "en-US", true),
      ])?.name,
    ).toBe("Microsoft Zira");

    // Even when the GB voice is listed FIRST it must not win.
    expect(
      pickVoice("en", [
        stub("Microsoft George", "en-GB", true),
        stub("Microsoft David", "en-US", true),
      ])?.name,
    ).toBe("Microsoft David");
  });

  it("deprioritises other non-US English locales", () => {
    expect(
      pickVoice("en", [
        stub("Microsoft Catherine", "en-AU", true),
        stub("Microsoft Zira", "en-US", true),
      ])?.name,
    ).toBe("Microsoft Zira");
  });

  it("still returns a local English voice when only British ones exist", () => {
    // Better a British narration than an error message, but never a network one.
    expect(
      pickVoice("en", [stub("Microsoft Hazel", "en-GB", true)])?.name,
    ).toBe("Microsoft Hazel");
    expect(
      pickVoice("en", [stub("Google UK English", "en-GB", false)]),
    ).toBeNull();
  });

  it("returns null when no local voices exist at all", () => {
    expect(pickVoice("en", [])).toBeNull();
    expect(
      pickVoice("en", [stub("Google US English", "en-US", false)]),
    ).toBeNull();
  });
});

describe("pickVoice — ?voice= override", () => {
  const voices: StubVoice[] = [
    stub("Microsoft Zira", "en-US", true),
    stub("Microsoft David", "en-US", true),
    stub("Microsoft Hazel", "en-GB", true),
    stub("Google US English", "en-US", false),
  ];

  it("forces the named voice, including a British one on purpose", () => {
    expect(pickVoice("en", voices, "David")?.name).toBe("Microsoft David");
    expect(pickVoice("en", voices, "Hazel")?.name).toBe("Microsoft Hazel");
  });

  it("matches case-insensitively on a substring", () => {
    expect(pickVoice("en", voices, "zira")?.name).toBe("Microsoft Zira");
    expect(pickVoice("en", voices, "  ZIRA  ")?.name).toBe("Microsoft Zira");
  });

  it("refuses a network voice even when named explicitly", () => {
    // The override must never be a way to break the air-gap rule. Falls back
    // to the first preferred LOCAL voice, which is David.
    expect(pickVoice("en", voices, "Google")?.name).toBe("Microsoft David");
  });

  it("falls back to normal selection when the name is not installed", () => {
    expect(pickVoice("en", voices, "Aria")?.name).toBe("Microsoft David");
  });

  it("ignores an empty or blank override", () => {
    expect(pickVoice("en", voices, "")?.name).toBe("Microsoft David");
    expect(pickVoice("en", voices, "   ")?.name).toBe("Microsoft David");
    expect(pickVoice("en", voices, null)?.name).toBe("Microsoft David");
  });
});

describe("pickVoice — natural voice preference", () => {
  it("picks Microsoft Guy whenever he is installed, even listed last", () => {
    // The regression this guards: the house voice is Guy. Once the optional
    // Natural Voices pack is present he must win outright, regardless of
    // list order or the presence of legacy voices.
    const voices: StubVoice[] = [
      stub("Microsoft David - English (United States)", "en-US", true),
      stub("Microsoft Zira - English (United States)", "en-US", true),
      stub("Microsoft Guy (Natural)", "en-US", true),
    ];
    expect(pickVoice("en", voices)?.name).toBe("Microsoft Guy (Natural)");
  });

  it("prefers Jenny over the legacy voices too", () => {
    const voices: StubVoice[] = [
      stub("Microsoft David - English (United States)", "en-US", true),
      stub("Microsoft Jenny (Natural)", "en-US", true),
    ];
    expect(pickVoice("en", voices)?.name).toBe("Microsoft Jenny (Natural)");
  });

  it("never picks a natural British voice over a legacy US one", () => {
    // A UK "natural" voice is still British; accent wins over quality tier.
    const voices: StubVoice[] = [
      stub("Microsoft Ryan (Natural)", "en-GB", true),
      stub("Microsoft David - English (United States)", "en-US", true),
    ];
    expect(pickVoice("en", voices)?.name).toBe(
      "Microsoft David - English (United States)",
    );
  });

  it("falls back to a legacy US voice when no natural voice is installed", () => {
    // This is the machine as it stands today: Guy absent, so narration still
    // speaks — just with a legacy voice rather than going silent.
    const voices: StubVoice[] = [
      stub("Microsoft Zira - English (United States)", "en-US", true),
      stub("Microsoft David - English (United States)", "en-US", true),
      stub("Google UK English Female", "en-GB", false),
    ];
    expect(pickVoice("en", voices)?.name).toBe(
      "Microsoft David - English (United States)",
    );
  });
});

import { describe, expect, it } from "vitest";
import { classifyUrl } from "./egress-watch";

const ORIGIN = "http://127.0.0.1:3000";

describe("classifyUrl", () => {
  it("treats same-origin http(s) as local", () => {
    expect(classifyUrl("/api/health", ORIGIN)).toBe("local");
    expect(classifyUrl("http://127.0.0.1:3000/api/jobs", ORIGIN)).toBe("local");
    expect(classifyUrl("http://127.0.0.1:3000/cta-refinery.jpg", ORIGIN)).toBe(
      "local",
    );
  });

  it("treats loopback services on other ports as local", () => {
    // Demo-machine / dev API, vector DB and telemetry run on loopback
    // ports — port differences must not count as external leaks.
    expect(classifyUrl("http://127.0.0.1:8000/api/health", ORIGIN)).toBe(
      "local",
    );
    expect(classifyUrl("http://localhost:8000/api/jobs", ORIGIN)).toBe(
      "local",
    );
    expect(
      classifyUrl(
        "http://127.0.0.1:8000/api/jobs/abc/image",
        "http://localhost:3000",
      ),
    ).toBe("local");
    expect(classifyUrl("http://127.0.0.1:6333/collections", ORIGIN)).toBe(
      "local",
    );
  });

  it("flags foreign http(s) origins as external", () => {
    expect(classifyUrl("https://fonts.googleapis.com/css", ORIGIN)).toBe(
      "external",
    );
    expect(classifyUrl("https://cdn.example.com/x.js", ORIGIN)).toBe(
      "external",
    );
    expect(classifyUrl("http://192.168.1.9:8000/api", ORIGIN)).toBe(
      "external",
    );
  });

  it("ignores non-http(s), invalid and same-origin-relative URLs", () => {
    expect(classifyUrl("ws://127.0.0.1:3000/_next/webpack-hmr", ORIGIN)).toBe(
      "ignore",
    );
    expect(classifyUrl("data:image/png;base64,AAA", ORIGIN)).toBe("ignore");
    expect(classifyUrl("blob:http://127.0.0.1:3000/abc", ORIGIN)).toBe(
      "ignore",
    );
    expect(classifyUrl("/api/health", "::::")).toBe("ignore");
  });
});

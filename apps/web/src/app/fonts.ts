import localFont from "next/font/local";

/**
 * Inter — vendored, variable weight (100–900), latin subset (~48 KB).
 *
 * WHY LOCAL, NOT next/font/google: `next/font/google` downloads the font from
 * Google at build time. NIRVA is air-gapped by contract (COMMON.md — "Zero
 * internet calls"), so a build-time fetch from fonts.googleapis.com is both a
 * sovereignty violation and a silent-fallback risk. The files live in
 * `src/app/fonts/` and are committed, so an offline build is byte-identical.
 */
const inter = localFont({
  src: "./fonts/Inter-Variable-latin.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
  fallback: [
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
});

export const interFont = inter;
export default inter;

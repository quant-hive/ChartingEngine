import type { Theme } from "./types";

// ── Flash Dark Theme (default) ──────────────────────────────────────────
// Extracted from the current Figma-matched aesthetic.

export const FLASH_DARK: Theme = {
  name: "flash-dark",
  background: "#121212",
  surface: "#0f0f0f",
  text: {
    primary: "#ffffff",
    secondary: "#8f8f8f",
    muted: "#494949",
    axis: "#494949",
  },
  grid: {
    color: "#2a2a2a",
    width: 0.3,
  },
  axis: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: "-0.12px",
  },
  title: {
    fontFamily: "var(--font-eb-garamond), 'EB Garamond', 'Times New Roman', Georgia, serif",
    fontSize: 18,
    fontWeight: 400,
    letterSpacing: "-0.2px",
    color: "#ffffff",
  },
  subtitle: {
    fontFamily: "var(--font-eb-garamond), 'EB Garamond', 'Times New Roman', Georgia, serif",
    fontSize: 11,
    fontWeight: 400,
    letterSpacing: "-0.1px",
    color: "#555555",
  },
  legend: {
    fontFamily: "var(--font-eb-garamond), 'EB Garamond', 'Times New Roman', Georgia, serif",
    fontSize: 11,
  },
  tooltip: {
    background: "#1a1a1a",
    border: "#2a2a2a",
    text: "#a0a0a0",
    header: "#808080",
    fontFamily: "'Inter', sans-serif",
  },
  defaultColors: [
    "#d4d4d4",
    "#707070",
    "#4ECDC4",
    "#FFD93D",
    "#FF6B6B",
    "#C084FC",
    "#67E8F9",
    "#FCA5A5",
  ],
  bar: {
    defaultFill: "#1e1f24",
    styles: [
      {
        fill: "#EF8CFF",
        sideGlow: "#624096",
        topGlow: "#763AA4",
        bottomGlow: "#7B42DD",
        leftEdge: "#7432E6",
        sparkle: "#E49BFF",
        gradTop: "#e586fa",
        gradBottom: "#884f94",
      },
      {
        fill: "#8CA5FF",
        sideGlow: "#405A96",
        topGlow: "#3A5FA4",
        bottomGlow: "#427BDD",
        leftEdge: "#3268E6",
        sparkle: "#9BB6FF",
        gradTop: "#86bafa",
        gradBottom: "#4f7194",
      },
    ],
  },
  area: {
    gradientOpacityTop: 0.15,
    gradientOpacityBottom: 0.05,
  },
};

// ── Theme Registry ──────────────────────────────────────────────────────

const themes: Record<string, Theme> = {
  "flash-dark": FLASH_DARK,
};

export function registerTheme(name: string, theme: Theme) {
  themes[name] = theme;
}

export function getTheme(name: string): Theme {
  return themes[name] ?? FLASH_DARK;
}

export function listThemes(): string[] {
  return Object.keys(themes);
}

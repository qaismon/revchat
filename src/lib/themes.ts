export type ThemeId = "matrix" | "neon" | "amber" | "cyan";

export interface ThemeColors {
  name: string;
  accent: string;
  accent2: string;
  bg: string;
  border: string;
  glow: string;
}

export const themes: Record<ThemeId, ThemeColors> = {
  matrix: {
    name: "MATRIX",
    accent: "#7EE787",
    accent2: "#238636",
    bg: "#07090c",
    border: "#0f1520",
    glow: "rgba(126,231,135,0.03)",
  },
  neon: {
    name: "NEON",
    accent: "#a78bfa",
    accent2: "#6e40c9",
    bg: "#090610",
    border: "#1f1240",
    glow: "rgba(167,139,250,0.05)",
  },
  amber: {
    name: "AMBER",
    accent: "#FFB000",
    accent2: "#b87300",
    bg: "#080600",
    border: "#2a1f00",
    glow: "rgba(255,176,0,0.04)",
  },
  cyan: {
    name: "CYAN",
    accent: "#58A6FF",
    accent2: "#0066CC",
    bg: "#000a12",
    border: "#002a4a",
    glow: "rgba(88,166,255,0.04)",
  },
};

/** Design tokens for AfterCare's "Broadsheet" visual system — kept as JS constants so
 *  components can reference them directly, in addition to the CSS custom properties
 *  defined in global.css (which is the source of truth for actual rendering). */
export const theme = {
  color: {
    bg: "var(--color-bg)",
    surface: "var(--color-surface)",
    text: "var(--color-text)",
    accent: "var(--color-accent)",
    accent2: "var(--color-accent-2)",
    divider: "var(--color-divider)",
  },
  space: { 1: "5px", 2: "10px", 3: "15px", 4: "20px", 6: "30px", 8: "40px" },
  radius: "2px",
} as const;

export type Theme = typeof theme;

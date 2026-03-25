// Tommy — Personal Advisor Color System
// Modern indigo-dark + violet accent

const palette = {
  // Backgrounds — deep indigo-tinted dark
  bg: "#09090E",
  surface: "#11111A",
  surfaceRaised: "#18182280",
  overlay: "#1F1F2C",

  // Accent — soft violet (trust, calm, intelligence)
  accent: "#7C6EFA",
  accentLight: "#A393FB",
  accentSoft: "rgba(124,110,250,0.12)",
  accentBorder: "rgba(124,110,250,0.22)",
  accentGlow: "rgba(124,110,250,0.07)",

  // Money — warm amber
  money: "#F59E0B",
  moneySoft: "rgba(245,158,11,0.12)",
  moneyBorder: "rgba(245,158,11,0.2)",

  // Semantics
  positive: "#10B981",
  positiveSoft: "rgba(16,185,129,0.12)",
  negative: "#EF4444",
  negativeSoft: "rgba(239,68,68,0.12)",
  warning: "#F97316",
  warningSoft: "rgba(249,115,22,0.12)",

  // Text — warm white
  text: "#F0F0F8",
  textSub: "rgba(240,240,248,0.55)",
  textMuted: "rgba(240,240,248,0.3)",
  textFaint: "rgba(240,240,248,0.12)",

  // Borders / Lines
  line: "rgba(255,255,255,0.06)",
  lineStrong: "rgba(255,255,255,0.1)",
  lineMedium: "rgba(255,255,255,0.08)",

  // Nav
  tabActive: "#7C6EFA",
  tabInactive: "rgba(240,240,248,0.32)",

  // Chat (estilo web: faixas + bolha usuário)
  chatAssistantBand: "rgba(255,255,255,0.035)",
  chatUserBubble: "rgba(124,110,250,0.22)",
  chatBorder: "rgba(255,255,255,0.08)",
  composerBg: "#12121C",
};

export const Colors = palette;
export default Colors;

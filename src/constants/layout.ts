import { Platform } from "react-native";

/** Height of the bottom tab bar (excluding safe area inset) */
export const TAB_BAR_HEIGHT = Platform.select({
  ios: 49,
  android: 56,
  web: 84,
  default: 49,
}) as number;

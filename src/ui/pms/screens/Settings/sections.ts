export const SETTINGS_SECTIONS = [
  { id: "property", label: "업장 정보" },
  { id: "channels", label: "채널 연동" },
  { id: "accounts", label: "직원 계정·권한" },
  { id: "notifications", label: "알림" },
  { id: "billing", label: "구독·결제" },
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["id"];

export const isSettingsSection = (v: string): v is SettingsSection => SETTINGS_SECTIONS.some((s) => s.id === v);

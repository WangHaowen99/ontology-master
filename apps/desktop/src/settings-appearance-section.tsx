import type { ThemeMode } from "./desktop-state";
import { SettingsGroup, SettingsRow } from "./settings-utils";

interface SettingsAppearanceSectionProps {
  readonly themeMode: ThemeMode;
  readonly onSetThemeMode: (mode: ThemeMode) => void;
}

const THEME_OPTIONS: { mode: ThemeMode; label: string; description: string }[] = [
  { mode: "system", label: "跟随系统", description: "自动跟随操作系统外观设置" },
  { mode: "light", label: "浅色", description: "始终使用浅色主题" },
  { mode: "dark", label: "深色", description: "始终使用深色主题" },
];

export function SettingsAppearanceSection({ themeMode, onSetThemeMode }: SettingsAppearanceSectionProps) {
  return (
    <SettingsGroup title="主题">
      {THEME_OPTIONS.map((option) => (
        <SettingsRow key={option.mode} title={option.label} description={option.description}>
          <input
            checked={themeMode === option.mode}
            name="theme"
            type="radio"
            onChange={() => onSetThemeMode(option.mode)}
          />
        </SettingsRow>
      ))}
    </SettingsGroup>
  );
}

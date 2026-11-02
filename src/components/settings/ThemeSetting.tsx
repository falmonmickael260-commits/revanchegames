"use client";

import { Moon, Sun } from "lucide-react";
import { useThemePreference, type AppTheme } from "@/components/theme/ThemePreference";

const choices: { value: AppTheme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Clair", Icon: Sun },
  { value: "dark", label: "Sombre", Icon: Moon },
];

export function ThemeSetting() {
  const [theme, setTheme] = useThemePreference();

  return (
    <section className="rg-theme-setting" aria-labelledby="theme-setting-title">
      <div className="rg-theme-setting-copy">
        <span className="rg-theme-setting-mark"><Sun className="h-5 w-5" /></span>
        <div>
          <h2 id="theme-setting-title">Apparence</h2>
          <p>Choisis le thème de Revanche Games sur cet appareil.</p>
        </div>
      </div>
      <div className="rg-theme-choices" role="radiogroup" aria-labelledby="theme-setting-title">
        {choices.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            className={theme === value ? "is-selected" : ""}
            onClick={() => setTheme(value)}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

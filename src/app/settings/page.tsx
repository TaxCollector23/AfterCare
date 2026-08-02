"use client";

import { Settings as SettingsIcon, Moon, Contrast, Type, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/components/providers/settings-provider";

export default function SettingsPage() {
  const { theme, setTheme, contrast, setContrast, textSize, setTextSize, motion, setMotion } = useSettings();

  return (
    <div className="mx-auto max-w-[760px] px-6 py-8 lg:px-10 lg:py-10">
      <header className="mb-8 flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-(--color-blue-tint) text-(--color-blue)">
          <SettingsIcon className="h-7 w-7" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-h1">Settings</h1>
          <p className="text-body text-(--color-text-secondary)">Make AfterCare comfortable for you</p>
        </div>
      </header>

      <Card className="flex flex-col divide-y divide-(--color-border) p-0">
        <SettingRow
          icon={Moon}
          title="Dark Mode"
          description="Switch to a darker color palette"
          id="setting-dark-mode"
          checked={theme === "dark"}
          onCheckedChange={(v) => setTheme(v ? "dark" : "system")}
        />
        <SettingRow
          icon={Contrast}
          title="High Contrast"
          description="Increase color contrast for better readability"
          id="setting-high-contrast"
          checked={contrast === "high"}
          onCheckedChange={(v) => setContrast(v ? "high" : "normal")}
        />
        <SettingRow
          icon={Type}
          title="Large Text"
          description="Increase text size throughout the app"
          id="setting-large-text"
          checked={textSize === "large"}
          onCheckedChange={(v) => setTextSize(v ? "large" : "normal")}
        />
        <SettingRow
          icon={Sparkles}
          title="Reduce Motion"
          description="Minimize animations and transitions"
          id="setting-reduce-motion"
          checked={motion === "reduced"}
          onCheckedChange={(v) => setMotion(v ? "reduced" : "system")}
        />
      </Card>

      <p className="mt-6 text-small text-(--color-text-secondary)">
        Your preferences are saved on this device and applied automatically each time you visit.
      </p>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  title,
  description,
  id,
  checked,
  onCheckedChange,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  id: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-(--color-bg) text-(--color-text-secondary)">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-body font-medium text-(--color-text-primary)">{title}</span>
        <span className="block text-small text-(--color-text-secondary)">{description}</span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} label={title} />
    </div>
  );
}

"use client";

import * as React from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Due now";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function useCountdown(targetIso: string) {
  const [remaining, setRemaining] = React.useState(() => new Date(targetIso).getTime() - Date.now());

  React.useEffect(() => {
    const id = setInterval(() => {
      setRemaining(new Date(targetIso).getTime() - Date.now());
    }, 30000);
    return () => clearInterval(id);
  }, [targetIso]);

  return { remaining, label: formatRemaining(remaining), due: remaining <= 0 };
}

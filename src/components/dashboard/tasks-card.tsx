"use client";

import * as React from "react";
import { Pill, Footprints, Bandage, Droplet, Moon, Stethoscope, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { tasks as initialTasks, type Task, type Priority } from "@/lib/data";
import { cn } from "@/lib/utils";

const ICONS: Record<Task["icon"], React.ElementType> = {
  pill: Pill,
  walk: Footprints,
  bandage: Bandage,
  droplet: Droplet,
  moon: Moon,
  stethoscope: Stethoscope,
};

const PRIORITY_STYLE: Record<Priority, { variant: "red" | "amber" | "blue"; label: string }> = {
  high: { variant: "red", label: "High priority" },
  medium: { variant: "amber", label: "Medium priority" },
  low: { variant: "blue", label: "Low priority" },
};

export function TasksCard() {
  const [items, setItems] = React.useState<Task[]>(initialTasks);
  const remaining = items.filter((t) => !t.done).length;

  function toggle(id: string) {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>Today&rsquo;s Tasks</CardTitle>
          <CardDescription>{remaining === 0 ? "All done for today — nice work" : `${remaining} remaining`}</CardDescription>
        </div>
      </CardHeader>
      <ul className="flex flex-col gap-2" role="list">
        {items.map((task) => {
          const Icon = ICONS[task.icon];
          const priority = PRIORITY_STYLE[task.priority];
          return (
            <li key={task.id}>
              <div
                className={cn(
                  "flex items-center gap-4 rounded-xl border border-transparent p-3 transition-colors duration-150",
                  task.done ? "opacity-60" : "hover:border-(--color-border) hover:bg-black/[0.015] dark:hover:bg-white/[0.02]"
                )}
              >
                <Checkbox
                  id={`task-${task.id}`}
                  checked={task.done}
                  onCheckedChange={() => toggle(task.id)}
                  label={`Mark "${task.title}" as ${task.done ? "not done" : "done"}`}
                />
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-(--color-blue-tint) text-(--color-blue)">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <label htmlFor={`task-${task.id}`} className="min-w-0 flex-1 cursor-pointer">
                  <span
                    className={cn(
                      "block text-body font-medium text-(--color-text-primary)",
                      task.done && "line-through decoration-(--color-text-tertiary)"
                    )}
                  >
                    {task.title}
                  </span>
                  <span className="flex items-center gap-1.5 text-small text-(--color-text-secondary)">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {task.time} · {task.minutes} min
                  </span>
                </label>
                {!task.done && (
                  <Badge variant={priority.variant} className="shrink-0">
                    {priority.label}
                  </Badge>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

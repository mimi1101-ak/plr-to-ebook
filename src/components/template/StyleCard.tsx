"use client";

import { cn } from "@/lib/utils";

interface StyleCardProps<T extends string> {
  value: T;
  selected: boolean;
  label: string;
  description: string;
  icon: React.ReactNode;
  onSelect: (value: T) => void;
}

export default function StyleCard<T extends string>({
  value,
  selected,
  label,
  description,
  icon,
  onSelect,
}: StyleCardProps<T>) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        "relative w-full rounded-xl border-2 p-4 text-left transition-all duration-150 hover:shadow-sm active:scale-[0.99]",
        selected
          ? "border-brand-500 bg-brand-50 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300"
      )}
    >
      {/* 선택 체크 */}
      {selected && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 6L9 17l-5-5"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}

      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
            selected ? "bg-brand-100 text-brand-600" : "bg-gray-100 text-gray-500"
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm font-semibold",
              selected ? "text-brand-800" : "text-gray-800"
            )}
          >
            {label}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}

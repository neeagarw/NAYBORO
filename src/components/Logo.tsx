type Props = { size?: number; withWord?: boolean };

/** The two-house Nayboro mark (orange + green), from design/mockups. */
export function LogoMark({ size = 30, left = "#EE8A35", right = "#1E6B4A", label = "Nayboro" }: { size?: number; left?: string; right?: string; label?: string | null }) {
  return (
    <svg role={label ? "img" : undefined} aria-label={label ?? undefined} aria-hidden={label ? undefined : true} width={size} height={(size * 100) / 120} viewBox="0 0 120 100">
      <path
        fillRule="evenodd"
        fill={left}
        d="M10 96 Q6 96 6 92 V46 Q6 44 7.5 42.5 L28 21 Q31 18 34 21 L54.5 42.5 Q56 44 56 46 V92 Q56 96 52 96 Z M22 96 V78 A9 9 0 0 1 40 78 V96 Z"
      />
      <path
        fillRule="evenodd"
        fill={right}
        d="M68 96 Q64 96 64 92 V38 Q64 36 65.5 34.5 L86 11 Q89 8 92 11 L112.5 34.5 Q114 36 114 38 V92 Q114 96 110 96 Z M80 96 V74 A9 9 0 0 1 98 74 V96 Z"
      />
    </svg>
  );
}

export function Logo({ size = 30, withWord = true }: Props) {
  return (
    <span className="inline-flex items-center gap-[7px] font-display text-[20px] font-extrabold tracking-[-0.4px] text-ink">
      <LogoMark size={size} />
      {withWord && "nayboro"}
    </span>
  );
}

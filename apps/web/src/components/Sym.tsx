'use client';
/**
 * Renders a Material Symbols glyph. When `filled` is true the icon switches
 * to its filled variant (FILL=1) — Google nav rails fill the icon for the
 * selected item, which is part of the signature Workspace look.
 */
export function Sym({
  name,
  size = 22,
  filled = false,
}: {
  name: string;
  size?: number;
  filled?: boolean;
}) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        lineHeight: 1,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
    >
      {name}
    </span>
  );
}

import { useEffect, useRef, useState } from 'react';

const buildSquirclePath = (w: number, h: number, r: number, n: number, topOnly = false): string => {
  const cr = Math.min(r, w / 2, h / 2);
  if (cr === 0) return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
  // Bezier control-point ratio derived by matching the superellipse at its 45° parameter.
  // n=2 (circle) → k≈0.552 | n=4 (Apple squircle) → k≈0.909
  const f  = Math.pow(Math.SQRT1_2, 2 / n);
  const k  = Math.min((f - 0.5) / 0.375, 1);
  const kc = cr * k;
  const p  = (v: number) => v.toFixed(2);
  if (topOnly) {
    return [
      `M ${p(cr)} 0`,
      `L ${p(w - cr)} 0`,
      `C ${p(w - cr + kc)} 0 ${p(w)} ${p(cr - kc)} ${p(w)} ${p(cr)}`,
      `L ${p(w)} ${p(h)}`,
      `L 0 ${p(h)}`,
      `L 0 ${p(cr)}`,
      `C 0 ${p(cr - kc)} ${p(cr - kc)} 0 ${p(cr)} 0`,
      `Z`,
    ].join(' ');
  }
  return [
    `M ${p(cr)} 0`,
    `L ${p(w - cr)} 0`,
    `C ${p(w - cr + kc)} 0 ${p(w)} ${p(cr - kc)} ${p(w)} ${p(cr)}`,
    `L ${p(w)} ${p(h - cr)}`,
    `C ${p(w)} ${p(h - cr + kc)} ${p(w - cr + kc)} ${p(h)} ${p(w - cr)} ${p(h)}`,
    `L ${p(cr)} ${p(h)}`,
    `C ${p(cr - kc)} ${p(h)} 0 ${p(h - cr + kc)} 0 ${p(h - cr)}`,
    `L 0 ${p(cr)}`,
    `C 0 ${p(cr - kc)} ${p(cr - kc)} 0 ${p(cr)} 0`,
    `Z`,
  ].join(' ');
};

interface SquircleBoxProps extends React.HTMLAttributes<HTMLElement>, Pick<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'> {
  as?: React.ElementType;
  r?: number;
  n?: number;
  disabled?: boolean;
  topOnly?: boolean;
}

export default function SquircleBox({ as: Tag = 'div', r = 40, n = 4, disabled = false, topOnly = false, className, style, children, ...props }: SquircleBoxProps) {
  const ref = useRef<HTMLElement>(null);
  const [clipPath, setClipPath] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (disabled) { setClipPath(undefined); return; }
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.offsetWidth, h = el.offsetHeight;
      if (w > 0 && h > 0)
        setClipPath(`path("${buildSquirclePath(w, h, r, n, topOnly)}")`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [r, n, disabled, topOnly]);

  return (
    <Tag
      ref={ref}
      className={className}
      style={clipPath ? { ...style, clipPath, borderRadius: 0 } : style}
      {...props}
    >
      {children}
    </Tag>
  );
}

import type { SVGProps } from "react";

type BrandMarkProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  label?: string;
};

/**
 * The canonical Conf Simple mark: a folded document with a small C-shaped
 * counter cut into the page. Keep this geometry in sync with public/favicon.svg.
 */
export function BrandMark({ label, ...props }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...props}
    >
      <rect width="24" height="24" rx="5" fill="#ff6b00" />
      <path d="M6.75 4.5h7.4l3.1 3.1v11.9H6.75z" fill="#fff" />
      <path d="M14.15 4.5v3.1h3.1" fill="#ffd2b3" />
      <path d="M14.7 11.05a4.05 4.05 0 1 0 0 5.9" fill="none" stroke="#ff6b00" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function BrandLockup() {
  return (
    <div className="brand-lockup">
      <BrandMark className="brand-mark" />
      <span>Conf Simple</span>
    </div>
  );
}

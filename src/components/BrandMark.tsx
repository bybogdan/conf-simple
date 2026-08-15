import type { SVGProps } from "react";

type BrandMarkProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  label?: string;
};

/**
 * The canonical Pagecairn mark: three deliberately placed page markers.
 * Keep this geometry in sync with public/favicon.svg.
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
      <path d="M8.25 6.25h7.5v2.5h-7.5zM6.75 10.75h10.5v2.5H6.75zM5.25 15.25h13.5v2.5H5.25z" fill="#fff" />
    </svg>
  );
}

export function BrandLockup() {
  return (
    <div className="brand-lockup">
      <BrandMark className="brand-mark" />
      <span>Pagecairn</span>
    </div>
  );
}

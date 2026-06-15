import type { ReactNode } from "react";

/** White rounded card with the standard soft purple shadow. */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-card bg-white p-5 shadow-card ${className}`}>
      {children}
    </div>
  );
}

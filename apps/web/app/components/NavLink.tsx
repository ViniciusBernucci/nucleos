"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, code, children }: { href: string; code: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link href={href} className="nav-button" aria-current={active ? "page" : undefined}>
      <span className="nav-code" aria-hidden="true">
        {code}
      </span>
      {children}
    </Link>
  );
}

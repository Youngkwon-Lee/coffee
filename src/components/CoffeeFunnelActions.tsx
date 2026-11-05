"use client";

import type { ComponentProps } from "react";
import { useEffect, useRef } from "react";
import Link from "next/link";
import type { CoffeeFunnelEvent } from "@/lib/coffeeFunnelEvents";
import { markChangesFunnelOrigin, reportCoffeeFunnel } from "@/lib/reportCoffeeFunnel";

export function ChangesViewSignal() {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    markChangesFunnelOrigin();
    reportCoffeeFunnel("changes_view");
  }, []);
  return null;
}

type LinkProps = Omit<ComponentProps<typeof Link>, "onClick"> & { event: CoffeeFunnelEvent };

export function TrackedLink({ event, ...props }: LinkProps) {
  return <Link {...props} onClick={() => reportCoffeeFunnel(event)} />;
}

type ExternalLinkProps = Omit<ComponentProps<"a">, "onClick" | "href"> & {
  href: string;
  event: CoffeeFunnelEvent;
};

export function TrackedExternalLink({ event, ...props }: ExternalLinkProps) {
  return <a {...props} onClick={() => reportCoffeeFunnel(event)} />;
}

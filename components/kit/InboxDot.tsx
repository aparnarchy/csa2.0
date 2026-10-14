"use client";

import { useEffect, useState } from "react";
import { UNREAD_KEY } from "./RecommendationStack";

/** Small dot on the Inbox tab while there are recommendations not yet seen
 *  (device-local count kept by RecommendationStack). */
export function InboxDot() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const read = () => {
      try {
        setN(Number(localStorage.getItem(UNREAD_KEY) ?? 0) || 0);
      } catch {}
    };
    read();
    window.addEventListener("csa-recs-unread", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("csa-recs-unread", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  if (n <= 0) return null;
  return <span aria-label={`${n} new`} className="absolute -right-1 top-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand" />;
}

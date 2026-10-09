"use client";
import { useEffect } from "react";
export default function Pwa() {
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* App remains usable without installation. */
      });
  }, []);
  return null;
}

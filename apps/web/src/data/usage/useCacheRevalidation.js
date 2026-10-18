import { useEffect, useRef } from "react";

export function useCacheRevalidation(expiresAt, onRevalidate, enabled = true) {
  const callback = useRef(onRevalidate);

  useEffect(() => {
    callback.current = onRevalidate;
  }, [onRevalidate]);

  useEffect(() => {
    if (!enabled || !Number.isFinite(expiresAt)) return undefined;
    let triggered = false;
    const revalidateIfDue = () => {
      if (triggered || document.visibilityState !== "visible" || Date.now() < expiresAt) return;
      triggered = true;
      callback.current();
    };
    const timer = setTimeout(revalidateIfDue, Math.max(0, expiresAt - Date.now()));
    window.addEventListener("focus", revalidateIfDue);
    document.addEventListener("visibilitychange", revalidateIfDue);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", revalidateIfDue);
      document.removeEventListener("visibilitychange", revalidateIfDue);
    };
  }, [enabled, expiresAt]);
}

"use client";

import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * The viewport is a browser store, not React state: reading it through
 * `useSyncExternalStore` keeps the server render and the hydrating render
 * agreeing on "not mobile" and lets the real answer take over immediately
 * afterwards - copying it into state from an effect does the same thing a
 * render later, and trips `react-hooks/set-state-in-effect` on the way.
 */
function subscribe(onStoreChange: () => void) {
  const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function getSnapshot(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

/** The server has no viewport; desktop is the layout that degrades gracefully. */
function getServerSnapshot(): boolean {
  return false;
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

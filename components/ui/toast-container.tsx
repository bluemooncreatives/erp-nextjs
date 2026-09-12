"use client";

import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import { useTheme } from "@/context/ThemeContext";

/**
 * The toast surface — react-toastify's container, themed off the app's own
 * popover/border/primary tokens (bound via CSS custom properties in
 * `theme.css`) rather than react-toastify's generic default palette, so a
 * toast reads as a native part of the product in both themes.
 */
const Toaster = () => {
  const { theme } = useTheme();

  return (
    <ToastContainer
      theme={theme}
      position="bottom-right"
      autoClose={4000}
      newestOnTop
      closeOnClick
      pauseOnHover
    />
  );
};

export { Toaster };

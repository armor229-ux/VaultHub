"use client";

import * as React from "react";

type ThemeProviderProps = React.ComponentProps<typeof ThemeProviderInner>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <ThemeProviderInner {...props}>{children}</ThemeProviderInner>;
}

function ThemeProviderInner({
  children,
  attribute = "class",
  defaultTheme = "dark",
  disableTransitionOnChange = false,
}: {
  children: React.ReactNode;
  attribute?: string;
  defaultTheme?: string;
  disableTransitionOnChange?: boolean;
}) {
  const [theme, setTheme] = React.useState(defaultTheme);

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme, attribute]);

  return (
    <div
      className={`${disableTransitionOnChange ? "" : ""}`}
      suppressHydrationWarning
    >
      {children}
    </div>
  );
}

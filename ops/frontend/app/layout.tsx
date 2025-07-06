import "../globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: 'Ops Panel',
  description: 'Operations Panel for managing YukLive deployments',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" >
      <body>{children}</body>
    </html>
  );
}

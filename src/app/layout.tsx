import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AEMS — Asset Entry Management System",
  description: "Asset Entry Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EZTIME — Payroll POC",
  description: "Holdings company cross-subsidiary payroll management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

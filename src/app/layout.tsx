import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meeting → Execution",
  description: "Turn meeting transcripts into decisions, owners, deadlines and executed actions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

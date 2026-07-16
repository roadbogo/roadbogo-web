import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthContext";
import { LogoutProvider } from "@/components/auth/LogoutProvider";

export const metadata: Metadata = {
  title: "Roadbogo",
  description: "Roadbogo web application"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body><AuthProvider><LogoutProvider>{children}</LogoutProvider></AuthProvider></body>
    </html>
  );
}

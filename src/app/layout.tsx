import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthContext";
import { LogoutProvider } from "@/components/auth/LogoutProvider";
import { NotificationProvider } from "@/features/notifications/NotificationContext";
import { AccessHandoffToast } from "@/components/auth/AccessHandoffToast";

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
      <body><AuthProvider><NotificationProvider><LogoutProvider>{children}<AccessHandoffToast /></LogoutProvider></NotificationProvider></AuthProvider></body>
    </html>
  );
}

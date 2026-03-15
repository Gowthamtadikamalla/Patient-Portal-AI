import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kyron Medical Partners — Patient Portal",
  description: "Schedule appointments, check prescriptions, and connect with your healthcare team through our AI-powered patient portal.",
  keywords: "medical, appointments, healthcare, patient portal, Kyron Medical",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {/* Animated Background Orbs */}
        <div className="animated-bg">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
          <div className="orb orb-4" />
        </div>
        {children}
      </body>
    </html>
  );
}

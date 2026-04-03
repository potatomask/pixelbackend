import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { NotificationProvider } from "@/components/notifications";
import { Bytesized, Nunito, Space_Mono, Tiny5 } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-work-sans",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

const tiny5 = Tiny5({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-tiny5",
  display: "swap",
});

const bytesized = Bytesized({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bytesized",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "MyPixelPage",
  description: "Build your own 2D world landing page",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`h-full ${nunito.variable} ${spaceMono.variable} ${tiny5.variable} ${bytesized.variable}`} suppressHydrationWarning>
      <body className="font-sans min-h-full bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-200 antialiased m-0 p-0 transition-colors duration-300" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

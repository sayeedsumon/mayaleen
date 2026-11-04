import "./globals.css";
import type { ReactNode } from "react";
import { cookies } from "next/headers";

export const metadata = {
  title: "Mayaleen · Floating villa on Kaptai Lake",
  description: "Glass-walled cabins, a rooftop deck and a jacuzzi on Kaptai Lake, Rangamati. Book shared cabins or the whole boat.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang = (await cookies()).get("lang")?.value === "bn" ? "bn" : "en";
  return (
    <html lang={lang}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=Hind+Siliguri:wght@400;500;600&family=Noto+Serif+Bengali:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

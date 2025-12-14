import type { Metadata } from "next";
import { Montserrat, Oswald } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "600", "800"],
});

const oswald = Oswald({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Portail Recrutement | Pillbox Hill Medical Center",
  description: "Portail officiel de recrutement pour les services médicaux d'urgence de San Andreas.",
  icons: {
    icon: "/logo_phmc.webp",
    apple: "/logo_phmc.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${montserrat.variable} ${oswald.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

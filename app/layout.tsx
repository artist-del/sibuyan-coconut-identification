import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Providers } from "@/components/providers";
import "./globals.css";
import { Leaf } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cajidiocan Coconut Identification System",
  description: "Municipal-grade coconut variety records and identification for Cajidiocan Island.",
  icons: {
    // Kinonvert natin ang vector lines ng Lucide leaf icon papuntang browser-readable data
    icon: "/coconut.ico"
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

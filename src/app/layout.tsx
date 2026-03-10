import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Firplak - Consulta de Pedidos",
  description: "Portal de consulta de pedidos para clientes internos y externos de Firplak.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${outfit.variable} antialiased font-sans bg-gray-50`}
      >
        {children}
      </body>
    </html>
  );
}

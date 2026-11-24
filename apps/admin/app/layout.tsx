import "./globals.css";

export const metadata = {
  title: "GoBert Admin",
  description: "GoBert administration console",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
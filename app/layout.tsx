import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vault - Portfolio Command Centre",
  description: "Personal finance dashboard for managing MF, stocks, and net worth.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('vaulted-theme') || 'obsidian';
                  var darkThemes = ['obsidian','midnight','graphite','aurora','forest',
                    'ocean','rose','slate','ember','mocha'];
                  document.documentElement.setAttribute('data-theme', t);
                  if (darkThemes.includes(t)) {
                    document.documentElement.classList.add('theme-dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=IBM+Plex+Mono:wght@300;400;500;600&family=Outfit:wght@300;400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

// app/layout.tsx
import './globals.css';
export const metadata = { title: 'Barnis', description: 'Ledige barnehageplasser i Oslo' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body>{children}</body>
    </html>
  );
}

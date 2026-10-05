import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tech With Salman | Social Media OS',
  description:
    'Full-stack modern multi-platform social media operating system for creators and brands.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#060608] text-neutral-100 min-h-screen antialiased selection:bg-red-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}


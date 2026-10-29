import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'LifeStyle Image Studio', description: 'A beautiful workspace for AI-powered image creation.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }

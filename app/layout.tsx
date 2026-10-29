import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata:Metadata={title:'LifeStyle Image Studio | Product Workspace',description:'Organize product images, color variants and creative references.'};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#0D0916'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}

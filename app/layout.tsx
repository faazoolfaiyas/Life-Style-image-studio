import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'LifeStyle Image Studio | Product Workspace',description:'Organize product images, color variants and creative references.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}

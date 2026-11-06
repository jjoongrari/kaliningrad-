import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Снять вайб — балтийская игра про цену ночи',
  description: 'Угадай цену одной ночи в Калининграде по фотографиям. 10 квартир, балтийский вайб и реальные объявления.',
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/icon.svg` },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#113F43', viewportFit: 'cover' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}

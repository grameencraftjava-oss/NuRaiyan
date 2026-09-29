import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nuraiyan Social Network',
    short_name: 'Nuraiyan',
    description: 'An everlasting sanctuary of love and connection, crafted for Raiyan & Nusrat.',
    start_url: '/',
    display: 'standalone',
    background_color: '#070A12',
    theme_color: '#E11D48',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}

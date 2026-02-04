import './globals.css';
import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat Service - Dev Dashboard',
  description: 'Development dashboard for testing the Chat Service microservice',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

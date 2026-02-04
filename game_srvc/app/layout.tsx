import './globals.css';

export const metadata = {
    title: 'Game Service',
    description: 'Play games hosted by the game service',
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

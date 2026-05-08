import type { ReactNode } from "react";

export const metadata = {
  title: "AgentMesh",
  description: "Decentralized multi-agent economy on Solana",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

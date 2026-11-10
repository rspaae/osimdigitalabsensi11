import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | OSIS MPK SMKN 11 BANDUNG",
    default: "OSIS MPK SMKN 11 BANDUNG",
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-layout">
      {children}
    </div>
  );
}

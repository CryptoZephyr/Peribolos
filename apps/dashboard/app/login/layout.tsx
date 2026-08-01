import type { ReactNode } from "react";
import { SupabaseAuthProvider } from "@/app/auth/SupabaseAuthProvider";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>;
}

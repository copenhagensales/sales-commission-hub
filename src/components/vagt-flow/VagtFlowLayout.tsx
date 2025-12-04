import { ReactNode } from "react";
import { MainLayout } from "@/components/layout/MainLayout";

interface VagtFlowLayoutProps {
  children: ReactNode;
}

export function VagtFlowLayout({ children }: VagtFlowLayoutProps) {
  return <MainLayout>{children}</MainLayout>;
}

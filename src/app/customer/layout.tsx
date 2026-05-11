import DashboardLayout from "@/components/layout/DashboardLayout";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout role="customer">{children}</DashboardLayout>;
}

import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 px-8 py-7 max-w-[1180px]">{children}</main>
    </div>
  );
}

import Sidebar from "@/components/Sidebar";
import { MobileTopBar, MobileBottomNav } from "@/components/MobileNav";
import NextMeetingBanner from "@/components/NextMeetingBanner";
import PresenceHeartbeat from "@/components/PresenceHeartbeat";
import FloatingAiChat from "@/components/FloatingAiChat";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <PresenceHeartbeat />
      <NextMeetingBanner />
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        <MobileTopBar />
        <Sidebar />
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto px-3 py-3 pb-16 md:px-8 md:py-7 md:pb-7 max-w-[1180px]">
          {children}
        </main>
        <MobileBottomNav />
      </div>
      <FloatingAiChat />
    </div>
  );
}

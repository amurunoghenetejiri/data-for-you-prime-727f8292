import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { AuthModal } from "../AuthModal";
import { LiveActivity } from "../LiveActivity";
import { AccountStatusGate } from "../AccountStatusGate";

export default function Layout() {
  return (
    <AccountStatusGate>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 animate-fade-in">
          <Outlet />
        </main>
        <Footer />
        <AuthModal />
        <LiveActivity />
      </div>
    </AccountStatusGate>
  );
}
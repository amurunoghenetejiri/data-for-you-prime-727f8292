import { Link } from "react-router-dom";
import { Sparkles, Twitter, Facebook, Instagram, Mail } from "lucide-react";
import { Logo } from "../Logo";

/**
 * Footer Component
 * Displays the official DATA4ME logo and company information
 */
export function Footer() {
  const cols = [
    { title: "Product", links: [["Buy Data", "/buy-data"], ["Buy Airtime", "/buy-airtime"], ["Pricing", "/pricing"], ["Networks", "/networks"]] },
    { title: "Account", links: [["Wallet", "/wallet"], ["Transactions", "/transactions"], ["Settings", "/settings"], ["Support", "/support"]] },
    { title: "Company", links: [["About Us", "/about"], ["Contact", "/contact"], ["FAQ", "/faq"]] },
    { title: "Legal", links: [["Terms", "/terms"], ["Privacy", "/privacy"]] },
  ];
  
  return (
    <footer className="mt-24 border-t border-border bg-muted/30">
      <div className="container py-14 grid gap-10 md:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          {/* Official DATA4ME Logo - Single source of truth */}
          <div className="mb-3">
            <Logo size="default" showText={true} />
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">Instant, affordable data & airtime for MTN, Glo, Airtel and 9mobile. Built for Nigeria.</p>
          <div className="flex gap-3 mt-4">
            {[Twitter, Facebook, Instagram, Mail].map((Icon, i) => (
              <a 
                key={i} 
                href="#" 
                className="h-9 w-9 rounded-full bg-background border border-border grid place-items-center hover:bg-accent hover:text-primary transition"
                aria-label={`Social media link ${i + 1}`}
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h4 className="font-semibold mb-3 text-sm">{c.title}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {c.links.map(([l, t]) => (
                <li key={t}>
                  <Link to={t} className="story-link hover:text-foreground">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="container py-5 flex flex-col sm:flex-row gap-2 justify-between text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} <span className="font-semibold text-foreground">Jaskiti D.O.</span> — Computer Engineer, Delta State. All Rights Reserved.</p>
          <p>Data4Me · Built with ♥ in Nigeria.</p>
        </div>
      </div>
    </footer>
  );
}

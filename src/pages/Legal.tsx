import { Card } from "@/components/ui/card";

export function Terms() {
  return <LegalPage title="Terms of Service" updated="June 1, 2026">
    {sections.map((s) => (<section key={s.h}><h2>{s.h}</h2><p>{s.p}</p></section>))}
  </LegalPage>;
}

export function Privacy() {
  return <LegalPage title="Privacy Policy" updated="June 1, 2026">
    {privacy.map((s) => (<section key={s.h}><h2>{s.h}</h2><p>{s.p}</p></section>))}
  </LegalPage>;
}

function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="container py-12 max-w-3xl">
      <h1 className="text-4xl font-bold">{title}</h1>
      <p className="text-sm text-muted-foreground mt-2">Last updated: {updated}</p>
      <Card className="mt-6 p-8 shadow-card prose prose-sm max-w-none [&_h2]:font-semibold [&_h2]:text-lg [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:text-muted-foreground [&_p]:leading-relaxed">
        {children}
      </Card>
    </div>
  );
}

const sections = [
  { h: "1. Acceptance of terms", p: "By accessing Data4Me you agree to these terms. If you do not agree, please do not use our services." },
  { h: "2. Eligibility", p: "You must be at least 18 years old and able to enter into binding contracts to use Data4Me." },
  { h: "3. Wallet & payments", p: "Funds added to your Data4Me wallet are non-refundable except where stated. Transactions are final once the network confirms delivery." },
  { h: "4. Service availability", p: "We aim for 99.9% uptime but cannot guarantee uninterrupted service. Delays from carrier networks are outside our control." },
  { h: "5. Acceptable use", p: "Do not use Data4Me for fraud, money laundering, or any unlawful activity. Accounts violating these terms are suspended." },
  { h: "6. Liability", p: "Data4Me is not liable for indirect or consequential damages. Our maximum liability is capped at the amount of the disputed transaction." },
  { h: "7. Changes", p: "We may update these terms at any time. Material changes will be announced via email and in-app notification." },
];

const privacy = [
  { h: "Information we collect", p: "Name, email, phone number, transaction history, device and usage data necessary to deliver our services." },
  { h: "How we use it", p: "To process transactions, prevent fraud, send important account notifications, and improve our products." },
  { h: "Sharing", p: "We share data only with network operators (to deliver data/airtime), payment processors, and as required by law." },
  { h: "Security", p: "We encrypt data at rest and in transit, enforce 2FA where enabled, and follow industry best practices." },
  { h: "Your rights", p: "You can request access, correction, or deletion of your data by emailing privacy@data4me.ng." },
  { h: "Cookies", p: "We use cookies for authentication and analytics. You can disable non-essential cookies in your browser." },
];
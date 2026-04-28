import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ShoppingCart,
  Package,
  TrendingUp,
  Receipt,
  Bell,
  Shield,
  Smartphone,
  Check,
  Store,
  Coffee,
  Scissors,
  Wifi,
  WifiOff,
  ArrowRight,
  Star,
  Sparkles,
  Banknote,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
              <Package className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">
              StockMaster <span className="text-gold">Pro</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">
              Features
            </a>
            <a href="#who" className="text-sm text-muted-foreground hover:text-foreground">
              Who it's for
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Pricing
            </a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/setup-system-owner">
              <Button variant="outline" size="sm">
                <Users className="mr-1.5 h-4 w-4" /> Register cashier
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="bg-primary hover:bg-primary/90">
                Start free trial
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-gold/10" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--foreground) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="container relative mx-auto px-4 pt-16 pb-12 lg:pt-24 lg:pb-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-medium text-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                Built in Lesotho, for Lesotho
              </div>
              <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight text-foreground md:text-5xl lg:text-6xl">
                Run your shop with{" "}
                <span className="bg-gradient-to-br from-primary to-primary-glow bg-clip-text text-transparent">
                  confidence.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                A point-of-sale, inventory, and profit tracker built for everyday shops.
                Accept cash, M-Pesa or EcoCash. See real profit at the end of the day.
              </p>
              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row">
                <Link to="/signup">
                  <Button
                    size="lg"
                    className="bg-primary shadow-lg shadow-primary/25 hover:bg-primary/90"
                  >
                    Start 7-day free trial
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="outline">
                    I already have an account
                  </Button>
                </Link>
                <Link to="/setup-system-owner">
                  <Button size="lg" variant="outline">
                    Register cashier
                  </Button>
                </Link>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                No credit card. Setup in under 5 minutes. M 200 / month after trial.
              </p>

              {/* Mini trust strip */}
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" />
                  Works on any phone
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" />
                  English & Sesotho ready
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" />
                  Your data stays private
                </div>
              </div>
            </div>

            {/* Hero mockup */}
            <HeroMockup />
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-border bg-card">
        <div className="container mx-auto grid grid-cols-2 gap-y-6 px-4 py-8 md:grid-cols-4">
          {[
            { v: "5 min", l: "Setup time" },
            { v: "M 200", l: "Per month" },
            { v: "7 days", l: "Free trial" },
            { v: "3", l: "Payment methods" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <p className="font-display text-2xl font-bold text-foreground md:text-3xl">{s.v}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-20 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Features</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-foreground md:text-4xl">
            Everything your shop needs.
            <span className="text-muted-foreground"> Nothing it doesn't.</span>
          </h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: ShoppingCart,
              title: "Fast POS",
              desc: "Search products, accept cash or mobile money, print or share receipts in one tap.",
            },
            {
              icon: Package,
              title: "Live inventory",
              desc: "Stock auto-deducts after every sale. Track cost, selling price, and expiry dates.",
            },
            {
              icon: Receipt,
              title: "Real expenses",
              desc: "Record rent, electricity, transport. Profit = sales − cost of goods − expenses.",
            },
            {
              icon: TrendingUp,
              title: "Daily reports",
              desc: "See today, this week, this month. Export sales to CSV for your accountant.",
            },
            {
              icon: Bell,
              title: "Smart alerts",
              desc: "Low-stock warnings and 5-day expiry alerts so you never lose a sale.",
            },
            {
              icon: Shield,
              title: "Cashier accounts",
              desc: "Cashiers ring up sales. Only owners see profit, expenses, and reports.",
            },
          ].map((f) => (
            <Card
              key={f.title}
              className="group relative overflow-hidden p-6 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/5"
            >
              <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-primary/5 transition-all group-hover:scale-150 group-hover:bg-primary/10" />
              <div className="relative flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="relative mt-4 font-display text-lg font-semibold text-foreground">
                {f.title}
              </h3>
              <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.desc}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section id="who" className="bg-secondary/40 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Who it's for
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold text-foreground md:text-4xl">
              Made for the shops on every street.
            </h2>
            <p className="mt-3 text-muted-foreground">
              From spaza shops to salons — if you sell things and want to know what you actually
              made today, this is for you.
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
            {[
              { icon: Store, t: "Mini markets & spazas", d: "Track stock by item or barcode." },
              { icon: Coffee, t: "Cafés & take-aways", d: "Quick sales, mobile money ready." },
              { icon: Scissors, t: "Salons & services", d: "Mix products and services in one bill." },
            ].map((p) => (
              <Card
                key={p.t}
                className="border-2 border-border/60 bg-card/80 p-6 backdrop-blur transition-colors hover:border-gold/40"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gold/15 text-foreground">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{p.t}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{p.d}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Connectivity reassurance */}
      <section className="container mx-auto px-4 py-20">
        <Card className="overflow-hidden border-2 border-primary/15 bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
          <div className="grid gap-8 p-8 md:grid-cols-2 md:p-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-gold">
                <Sparkles className="h-3 w-3" />
                Built for Lesotho realities
              </div>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight md:text-4xl">
                Slow internet?
                <br />
                Power cuts? Sorted.
              </h2>
              <p className="mt-4 text-primary-foreground/80">
                StockMaster Pro runs in any modern browser on any phone, tablet or laptop. Lightweight,
                fast, and built to keep working when conditions are not perfect.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ReassureCard icon={Wifi} title="Lightweight" desc="Loads on slow 3G connections." />
              <ReassureCard icon={Smartphone} title="Any device" desc="Phone, tablet, or shop laptop." />
              <ReassureCard icon={WifiOff} title="Offline-aware" desc="Cached data keeps you moving." />
              <ReassureCard icon={Banknote} title="Local payments" desc="M-Pesa, EcoCash, cash." />
            </div>
          </div>
        </Card>
      </section>

      {/* Testimonials */}
      <section className="bg-secondary/40 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              From real shop owners
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold text-foreground md:text-4xl">
              People love how simple it is.
            </h2>
          </div>
          <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-3">
            {[
              {
                q: "I finally know what I'm actually making each day. The expense tracking is the part I didn't know I needed.",
                n: "Lerato M.",
                r: "Mini market, Maseru",
              },
              {
                q: "My cashier uses the POS, I see the reports. Profit went up just because I stopped guessing prices.",
                n: "Thabo K.",
                r: "Take-away, Leribe",
              },
              {
                q: "Setup took less than ten minutes. Stock alerts mean I never run out of bread anymore.",
                n: "Mpho R.",
                r: "Spaza shop, Mafeteng",
              },
            ].map((t) => (
              <Card key={t.n} className="flex flex-col p-6">
                <div className="flex gap-0.5 text-gold">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-foreground">"{t.q}"</p>
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-sm font-semibold text-foreground">{t.n}</p>
                  <p className="text-xs text-muted-foreground">{t.r}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container mx-auto px-4 py-20 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Pricing</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-foreground md:text-4xl">
            One simple price. No surprises.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Pay monthly or save by paying yearly. Cancel anytime.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
          <Card className="border-2 p-7">
            <p className="text-sm font-medium text-muted-foreground">Monthly</p>
            <p className="mt-2 font-display text-5xl font-bold text-foreground">
              M 200
              <span className="text-base font-normal text-muted-foreground">/month</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">7-day free trial included</p>
            <ul className="mt-7 space-y-3 text-sm">
              {[
                "Unlimited products",
                "POS with receipts",
                "Stock & expiry alerts",
                "Owner + cashier accounts",
                "Daily, weekly & monthly reports",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-success/15 text-success">
                    <Check className="h-3 w-3" />
                  </div>
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <Link to="/signup" className="mt-7 block">
              <Button className="w-full" variant="outline">
                Start free trial
              </Button>
            </Link>
          </Card>
          <Card className="relative border-2 border-gold bg-gradient-to-br from-card to-gold/5 p-7 shadow-xl shadow-gold/10">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-gold-foreground">
              Save 10%
            </div>
            <p className="text-sm font-medium text-muted-foreground">Yearly</p>
            <p className="mt-2 font-display text-5xl font-bold text-foreground">
              M 2,160
              <span className="text-base font-normal text-muted-foreground">/year</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Equivalent to M 180/month — 2 months free
            </p>
            <ul className="mt-7 space-y-3 text-sm">
              {[
                "Everything in Monthly",
                "Save M 240 every year",
                "Priority WhatsApp support",
                "Best for established shops",
                "Locked-in price for 12 months",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-success/15 text-success">
                    <Check className="h-3 w-3" />
                  </div>
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <Link to="/signup" className="mt-7 block">
              <Button className="w-full bg-primary hover:bg-primary/90">
                Start free trial
              </Button>
            </Link>
          </Card>
        </div>
      </section>

      {/* How payment works */}
      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              How payment works
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">
              Pay the way Lesotho actually pays.
            </h2>
            <p className="mt-3 text-primary-foreground/75">
              No credit card needed. Three simple steps.
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-5xl gap-8 md:grid-cols-3">
            {[
              {
                n: "01",
                t: "Pay your way",
                d: "Cash deposit, M-Pesa or EcoCash transfer. Use whatever works.",
              },
              {
                n: "02",
                t: "Upload proof",
                d: "Snap a receipt photo or screenshot inside the billing screen.",
              },
              {
                n: "03",
                t: "Get verified",
                d: "We review and activate your subscription within hours.",
              },
            ].map((s) => (
              <div key={s.n} className="relative">
                <p className="font-display text-6xl font-bold text-gold/40">{s.n}</p>
                <div className="absolute left-0 top-7 h-px w-12 bg-gold/40" />
                <h3 className="mt-4 font-display text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-primary-foreground/75">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container mx-auto px-4 py-20 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">FAQ</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-foreground md:text-4xl">
            Common questions
          </h2>
        </div>
        <div className="mx-auto mt-10 max-w-2xl">
          <Accordion type="single" collapsible className="space-y-3">
            {[
              {
                q: "Do I need to install anything?",
                a: "No. StockMaster Pro runs in your browser. Open it on your phone, tablet, or shop laptop and sign in.",
              },
              {
                q: "What if I have no internet during a sale?",
                a: "The app stays usable for short outages and syncs once you're back online. For most shops a basic mobile data plan is enough.",
              },
              {
                q: "How do my cashiers sign in?",
                a: "As the owner, you create cashier accounts from your settings. Cashiers only see the POS — they cannot view profit, expenses or reports.",
              },
              {
                q: "Can I export my sales data?",
                a: "Yes. The reports page lets you export sales as a CSV file you can open in Excel or send to your accountant.",
              },
              {
                q: "What happens after the 7-day trial?",
                a: "You can pay monthly (M 200) or yearly (M 2,160). Submit proof of payment from the billing screen and we activate your subscription within hours.",
              },
              {
                q: "Is my data safe?",
                a: "Each shop's data is fully isolated — only members of your shop can access your sales, products and expenses. Your records are backed up automatically.",
              },
            ].map((item, i) => (
              <AccordionItem
                key={item.q}
                value={`item-${i}`}
                className="rounded-xl border border-border bg-card px-5"
              >
                <AccordionTrigger className="text-left font-display text-base font-semibold hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 pb-20">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary via-primary to-primary-glow p-10 text-center text-primary-foreground md:p-16">
          <div
            aria-hidden
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, var(--gold) 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="relative mx-auto max-w-2xl">
            <Smartphone className="mx-auto h-10 w-10 text-gold" />
            <h2 className="mt-5 font-display text-3xl font-bold leading-tight md:text-4xl">
              Ready to know what your shop really makes?
            </h2>
            <p className="mt-4 text-primary-foreground/80">
              Start your 7-day free trial today. No credit card. Cancel anytime.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/signup">
                <Button size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90">
                  Start your free trial
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                >
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </section>

      <footer className="border-t border-border bg-card">
        <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Package className="h-3.5 w-3.5" />
            </div>
            <span className="font-display font-semibold text-foreground">
              StockMaster <span className="text-gold">Pro</span>
            </span>
          </div>
          <p>© {new Date().getFullYear()} StockMaster Pro · Made for shops in Lesotho.</p>
        </div>
      </footer>
    </div>
  );
}

function ReassureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-4 backdrop-blur">
      <Icon className="h-5 w-5 text-gold" />
      <p className="mt-2 font-display text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-primary-foreground/70">{desc}</p>
    </div>
  );
}

function HeroMockup() {
  return (
    <div className="relative">
      {/* Glow */}
      <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 via-gold/10 to-transparent blur-2xl" />

      {/* Browser frame */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/10">
        <div className="flex items-center gap-1.5 border-b border-border bg-secondary/60 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          <div className="ml-3 flex-1 truncate rounded-md bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground">
            stockmasterpro.ls / dashboard
          </div>
        </div>

        {/* Dashboard fake */}
        <div className="space-y-4 p-5">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2.5">
            <MockStat label="Today" value="M 4,820" tone="primary" />
            <MockStat label="Week" value="M 28,400" tone="gold" />
            <MockStat label="Profit" value="M 9,120" tone="success" />
          </div>

          {/* Chart */}
          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-muted-foreground">Sales · last 7 days</p>
              <p className="text-[11px] font-semibold text-success">+18%</p>
            </div>
            <div className="mt-2 flex h-20 items-end gap-1.5">
              {[35, 55, 42, 70, 50, 85, 95].map((h, i) => (
                <div key={i} className="flex-1">
                  <div
                    className="rounded-t bg-gradient-to-t from-primary to-primary-glow"
                    style={{ height: `${h}%` }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Row list */}
          <div className="space-y-1.5">
            {[
              { n: "Maluti Bread 700g", q: "12 sold", v: "M 144" },
              { n: "Coca-Cola 500ml", q: "8 sold", v: "M 112" },
              { n: "Surf 2kg", q: "3 sold", v: "M 195" },
            ].map((r) => (
              <div
                key={r.n}
                className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-primary/10" />
                  <p className="text-xs font-medium text-foreground">{r.n}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-[11px] text-muted-foreground">{r.q}</p>
                  <p className="text-xs font-semibold text-foreground">{r.v}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating receipt */}
      <div className="absolute -bottom-6 -left-4 hidden w-44 rotate-[-6deg] rounded-lg border border-border bg-card p-3 shadow-xl sm:block">
        <p className="font-display text-[10px] font-bold tracking-widest text-muted-foreground">
          RECEIPT · #00428
        </p>
        <div className="mt-2 space-y-1 border-t border-dashed border-border pt-2 text-[10px]">
          <div className="flex justify-between">
            <span>Bread × 1</span>
            <span>M 12</span>
          </div>
          <div className="flex justify-between">
            <span>Cola × 2</span>
            <span>M 28</span>
          </div>
          <div className="flex justify-between border-t border-dashed border-border pt-1 font-semibold text-foreground">
            <span>Total</span>
            <span>M 40</span>
          </div>
        </div>
      </div>

      {/* Floating badge */}
      <div className="absolute -top-3 -right-3 hidden items-center gap-2 rounded-full border border-gold/40 bg-card px-3 py-1.5 shadow-lg sm:flex">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        <span className="text-[11px] font-semibold text-foreground">Live sale</span>
      </div>
    </div>
  );
}

function MockStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "gold" | "success";
}) {
  const toneClass =
    tone === "primary"
      ? "from-primary/10 to-primary/5 text-primary"
      : tone === "gold"
        ? "from-gold/20 to-gold/5 text-foreground"
        : "from-success/15 to-success/5 text-success";
  return (
    <div className={`rounded-lg bg-gradient-to-br p-2.5 ${toneClass}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-0.5 font-display text-base font-bold text-foreground">{value}</p>
    </div>
  );
}

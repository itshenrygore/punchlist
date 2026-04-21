import { useEffect } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/logo";
import HeroQuotePreview from "../components/landing/HeroQuotePreview";
import InteractiveDemo from "../components/landing/InteractiveDemo";
import CustomerView from "../components/landing/CustomerView";
import WorkflowDepth from "../components/landing/WorkflowDepth";

/**
 * Landing page — composition only.
 * Each section is a self-contained component. This file owns the chrome
 * (nav, footer) and the section order. Nothing else.
 */
export default function LandingPage() {
  useEffect(() => {
    document.title = "Punchlist — Professional quotes, before you leave the job site";
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-slate-900 antialiased selection:bg-slate-900 selection:text-white">
      <Nav />

      {/* 1. Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(15,23,42,0.06),transparent_60%)]" />
        <div className="mx-auto max-w-7xl px-6 pt-20 pb-24 sm:pt-28 sm:pb-32 lg:px-8">
          <div className="grid gap-16 lg:grid-cols-[1.05fr_1fr] lg:items-center">
            <HeroCopy />
            <HeroQuotePreview />
          </div>
        </div>
      </section>

      {/* 2. Interactive demo — the page's center of gravity */}
      <section id="demo" className="border-y border-slate-200/70 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <SectionHeader
            eyebrow="Live demo"
            title="Describe the job. Get a quote that's 90% there."
            sub="Type a rough description like you'd send to a buddy. Watch the scope fill in. Edit anything. Keep every line."
          />
          <div className="mt-14">
            <InteractiveDemo />
          </div>
        </div>
      </section>

      {/* 3. What the customer sees */}
      <section className="bg-[#FAFAF8]">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <SectionHeader
            eyebrow="Customer view"
            title="Send something they can actually say yes to."
            sub="Branded, mobile-first, one-tap approval. No PDFs buried in email threads."
          />
          <div className="mt-14">
            <CustomerView />
          </div>
        </div>
      </section>

      {/* 4. Workflow depth */}
      <section className="border-t border-slate-200/70 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <SectionHeader
            eyebrow="Built for how contractors actually work"
            title="Three things that save you the whole evening."
          />
          <div className="mt-14">
            <WorkflowDepth />
          </div>
        </div>
      </section>

      {/* 5. Final CTA */}
      <section className="border-t border-slate-200/70 bg-[#FAFAF8]">
        <div className="mx-auto max-w-4xl px-6 py-28 text-center lg:px-8">
          <h2 className="text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Quote before you leave the driveway.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">
            Free to start. No credit card. Your first quote ready in under two minutes.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link
              to="/signup"
              className="rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              Start free
            </Link>
            <a
              href="#demo"
              className="rounded-full px-6 py-3 text-sm font-medium text-slate-700 transition hover:text-slate-900"
            >
              Try the demo →
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-[#FAFAF8]/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <Logo dark={false} />
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
          <a href="#demo" className="transition hover:text-slate-900">Demo</a>
          <a href="#pricing" className="transition hover:text-slate-900">Pricing</a>
          <Link to="/login" className="transition hover:text-slate-900">Log in</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to="/signup"
            className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}

function HeroCopy() {
  return (
    <div>
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        New — AI-assisted scope, in beta
      </div>

      <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl lg:text-[64px]">
        Create a professional quote in under 2 minutes — before you leave the job site.
      </h1>

      <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
        Describe the job in your own words. Punchlist drafts the scope, prices the line items,
        and sends a quote your customer can approve on their phone. You stay in control of every line.
      </p>

      <div className="mt-9 flex flex-wrap items-center gap-3">
        <Link
          to="/signup"
          className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          Start free
        </Link>
        <a
          href="#demo"
          className="group inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
        >
          See it work
          <span className="transition group-hover:translate-x-0.5">→</span>
        </a>
      </div>

      <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-slate-200 pt-8">
        <Stat value="<2 min" label="to first quote" />
        <Stat value="90%" label="scope captured" />
        <Stat value="1 tap" label="customer approval" />
      </dl>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div>
      <dt className="text-2xl font-semibold tracking-tight text-slate-900">{value}</dt>
      <dd className="mt-1 text-xs text-slate-500">{label}</dd>
    </div>
  );
}

function SectionHeader({ eyebrow, title, sub }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow && (
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
          {eyebrow}
        </div>
      )}
      <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
        {title}
      </h2>
      {sub && (
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">{sub}</p>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-slate-500 sm:flex-row lg:px-8">
        <div className="flex items-center gap-2">
          <Logo dark={false} />
        </div>
        <div className="flex items-center gap-6">
          <Link to="/privacy" className="hover:text-slate-900">Privacy</Link>
          <Link to="/terms" className="hover:text-slate-900">Terms</Link>
          <a href="mailto:hi@punchlist.ca" className="hover:text-slate-900">Contact</a>
        </div>
        <div>© {new Date().getFullYear()} Punchlist</div>
      </div>
    </footer>
  );
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Upload, Settings, FileText } from 'lucide-react'

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-navy text-cream">
      {/* NAVBAR */}
      <nav
        className={`sticky top-0 z-50 transition-all duration-200 ${
          scrolled
            ? 'bg-navy/95 backdrop-blur-md border-b border-border-col shadow-lg'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-accent font-bold text-xl">BiteNxt</span>
            <span className="text-cream font-normal text-xl">CaseReady™</span>
            <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-accent/20 text-accent border border-accent/40 rounded-full">
              BETA
            </span>
          </div>
          <Link
            href="/analyse"
            className="px-5 py-2 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-colors text-sm"
          >
            Run Analysis →
          </Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="min-h-screen flex items-center justify-center px-6 py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-1 h-5 bg-accent rounded-full" />
            <span className="text-cream-muted text-sm font-semibold uppercase tracking-widest">
              Scan Verification Engine
            </span>
          </div>

          <h1 className="text-5xl md:text-6xl font-semibold text-cream leading-tight mb-6">
            47% of crown preparations have{' '}
            <span className="text-accent">geometry errors</span>. We catch them
            before you mill.
          </h1>

          <p className="text-lg text-cream-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            BiteNxt CaseReady™ analyses your preparation STL against
            context-specific clinical parameters — marginal gap, occlusal
            clearance, undercut detection, taper angle. GREEN means mill. RED
            means rescan.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <Link
              href="/analyse/prep"
              className="px-7 py-3.5 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-colors text-base"
            >
              Upload &amp; Analyse Scan →
            </Link>
            <Link
              href="/report/demo-prep"
              className="px-7 py-3.5 border border-accent text-accent font-semibold rounded-lg hover:bg-accent/10 transition-colors text-base"
            >
              View Sample Report →
            </Link>
          </div>

          <p className="text-sm text-cream-muted/60">
            Used by dental labs in Hyderabad · Built on peer-reviewed parameters
          </p>
        </div>
      </section>

      {/* TWO PRODUCT PATHS */}
      <section className="py-16 px-6 border-t border-border-col">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-cream-muted mb-10">
            Choose your analysis type
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Crown Prep Card */}
            <Link
              href="/analyse/prep"
              className="group block bg-navy-light border border-border-col hover:border-accent/60 rounded-xl p-8 transition-all hover:bg-navy-elevated"
            >
              <div className="w-12 h-12 bg-accent/20 border border-accent/30 rounded-xl flex items-center justify-center mb-5">
                <span className="text-accent text-xl">⬡</span>
              </div>
              <h3 className="text-lg font-semibold text-cream mb-2 group-hover:text-accent transition-colors">
                Crown Prep Check
              </h3>
              <p className="text-cream-muted text-sm leading-relaxed mb-4">
                Upload an isolated tooth preparation STL. Detects undercuts, taper angle, and margin regularity before milling.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Undercut detection', 'Taper angle', 'Margin quality', 'Scan integrity'].map(t => (
                  <span key={t} className="text-xs px-2 py-1 bg-navy rounded-full border border-border-col text-cream-muted">{t}</span>
                ))}
              </div>
              <div className="mt-6 text-accent text-sm font-medium group-hover:translate-x-1 transition-transform inline-block">
                Start prep analysis →
              </div>
            </Link>

            {/* Implant Scan Card */}
            <Link
              href="/analyse/implant"
              className="group block bg-navy-light border border-border-col hover:border-accent/60 rounded-xl p-8 transition-all hover:bg-navy-elevated"
            >
              <div className="w-12 h-12 bg-accent/20 border border-accent/30 rounded-xl flex items-center justify-center mb-5">
                <span className="text-accent text-xl">⟳</span>
              </div>
              <h3 className="text-lg font-semibold text-cream mb-2 group-hover:text-accent transition-colors">
                Implant Scan Check
              </h3>
              <p className="text-cream-muted text-sm leading-relaxed mb-4">
                Upload a full arch IOS scan with scan body. Detects implant angulation, emergence angle, and crown space before design.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Scan body detection', 'Implant angulation', 'Emergence angle', 'Crown space'].map(t => (
                  <span key={t} className="text-xs px-2 py-1 bg-navy rounded-full border border-border-col text-cream-muted">{t}</span>
                ))}
              </div>
              <div className="mt-6 text-accent text-sm font-medium group-hover:translate-x-1 transition-transform inline-block">
                Start implant analysis →
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* METRICS ROW */}
      <section className="py-16 px-6 border-t border-border-col">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-navy-light border border-border-col rounded-lg p-8 text-center">
            <div className="text-5xl font-bold text-accent mb-3">47%</div>
            <div className="text-cream-muted text-sm leading-relaxed">
              of preps have inadequate occlusal clearance
            </div>
          </div>
          <div className="bg-navy-light border border-border-col rounded-lg p-8 text-center">
            <div className="text-5xl font-bold text-accent mb-3">₹5,000+</div>
            <div className="text-cream-muted text-sm leading-relaxed">
              average cost per crown remake in material and time
            </div>
          </div>
          <div className="bg-navy-light border border-border-col rounded-lg p-8 text-center">
            <div className="text-5xl font-bold text-accent mb-3">2–4 hrs</div>
            <div className="text-cream-muted text-sm leading-relaxed">
              from scan upload to CaseReady™ report in your WhatsApp
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-semibold text-cream text-center mb-16">
            How CaseReady™ Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="text-center">
              <div className="w-14 h-14 bg-accent/20 border border-accent/30 rounded-xl flex items-center justify-center mx-auto mb-5">
                <Upload className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-cream mb-3">
                Upload Your Prep Scan
              </h3>
              <p className="text-cream-muted text-sm leading-relaxed">
                Drag and drop your preparation STL. Opposing arch optional —
                enables occlusal clearance measurement.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-accent/20 border border-accent/30 rounded-xl flex items-center justify-center mx-auto mb-5">
                <Settings className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-cream mb-3">
                Set Clinical Context
              </h3>
              <p className="text-cream-muted text-sm leading-relaxed">
                Tooth number, case type, zirconia grade, patient risk flags.
                Context determines the ideal parameters.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-accent/20 border border-accent/30 rounded-xl flex items-center justify-center mx-auto mb-5">
                <FileText className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-cream mb-3">
                Receive Your Report
              </h3>
              <p className="text-cream-muted text-sm leading-relaxed">
                GREEN means mill immediately. YELLOW means we have a question.
                RED means we save you a remake.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border-col py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-cream-muted">
            BiteNxt CaseReady™ — Scan verification for Indian dental labs
          </div>
          <div className="text-sm text-cream-muted/50">
            Prototype v0.1 — Clinical calibration in progress
          </div>
        </div>
      </footer>
    </div>
  )
}

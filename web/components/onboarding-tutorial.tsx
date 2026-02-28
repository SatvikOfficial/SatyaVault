"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "satyavault_tutorial_seen_v2";

interface TourStep {
  title: string;
  description: string;
  target: string;
}

const STEPS: TourStep[] = [
  {
    title: "Connect Wallet",
    description: "Start here. Connect MetaMask so SatyaVault can read your on-chain access profile.",
    target: "connect-wallet"
  },
  {
    title: "System Readiness",
    description: "Confirm RPC, contract, and IPFS health before operating in production mode.",
    target: "system-setup"
  },
  {
    title: "Access Control",
    description:
      "Roles are enforced by smart contract. Ministry Admin can provision Investigator, FSL Officer, Court Officer, and Auditor profiles.",
    target: "role-admin"
  },
  {
    title: "Evidence Intake",
    description: "Upload file, compute local SHA-256, pin to IPFS, and register immutable metadata on-chain.",
    target: "evidence-intake"
  },
  {
    title: "Custody Transfer",
    description: "Every handoff requires current custodian signature and records from/to agency details.",
    target: "custody-transfer"
  },
  {
    title: "Investigative Actions",
    description: "Record forensic actions on-chain so each investigative step is verifiable and timestamped.",
    target: "action-log"
  },
  {
    title: "Integrity Verification",
    description: "Run normal and tamper checks to confirm whether file bytes still match the on-chain hash.",
    target: "verification"
  },
  {
    title: "Search & Retrieval",
    description: "Use full-text and filters to retrieve evidence records fast across agencies and case notes.",
    target: "search"
  },
  {
    title: "Audit Timeline",
    description: "This panel gives the complete custody + investigative timeline and exports for legal proceedings.",
    target: "evidence-detail"
  }
];

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function OnboardingTutorial() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetBox, setTargetBox] = useState<Box | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const step = STEPS[stepIndex];

  useEffect(() => {
    setMounted(true);
    setViewport({ width: window.innerWidth, height: window.innerHeight });

    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      // Open once per browser profile for first-time onboarding.
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open || !step) {
      setTargetBox(null);
      return;
    }

    let raf = 0;
    const findAndMeasure = () => {
      const element = document.querySelector(`[data-tour-id="${step.target}"]`) as HTMLElement | null;
      if (!element) {
        setTargetBox(null);
        return;
      }

      // Keep the focused area visible while advancing the tour.
      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

      const rect = element.getBoundingClientRect();
      const pad = 10;
      setTargetBox({
        top: Math.max(0, rect.top - pad),
        left: Math.max(0, rect.left - pad),
        width: Math.min(window.innerWidth, rect.width + pad * 2),
        height: Math.min(window.innerHeight, rect.height + pad * 2)
      });
    };

    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setViewport({ width: window.innerWidth, height: window.innerHeight });
        findAndMeasure();
      });
    };

    const timer = window.setTimeout(update, 60);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      cancelAnimationFrame(raf);
    };
  }, [open, step]);

  const tooltipStyle = useMemo(() => {
    const width = Math.min(360, Math.max(280, viewport.width - 24));

    if (!targetBox) {
      return {
        top: Math.max(16, viewport.height / 2 - 110),
        left: Math.max(12, (viewport.width - width) / 2),
        width
      };
    }

    const belowTop = targetBox.top + targetBox.height + 14;
    const prefersTop = belowTop + 210 > viewport.height;
    const top = prefersTop ? Math.max(12, targetBox.top - 220) : belowTop;

    const left = clamp(targetBox.left, 12, Math.max(12, viewport.width - width - 12));
    return { top, left, width };
  }, [targetBox, viewport.height, viewport.width]);

  const closeTour = (persist: boolean) => {
    if (persist) {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
    setOpen(false);
    setStepIndex(0);
  };

  const advance = () => {
    if (stepIndex >= STEPS.length - 1) {
      closeTour(true);
      return;
    }
    setStepIndex((value) => value + 1);
  };

  if (!open) {
    return (
      <button
        onClick={() => {
          setStepIndex(0);
          setOpen(true);
        }}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
      >
        Guided Tour
      </button>
    );
  }

  if (!mounted) return null;

  const box = targetBox;

  return createPortal(
    <div className="fixed inset-0 z-[2147483000]" aria-modal="true" role="dialog">
      {box ? (
        <>
          <div className="fixed left-0 top-0 bg-slate-950/58" style={{ width: "100%", height: box.top }} />
          <div
            className="fixed left-0 bg-slate-950/58"
            style={{ top: box.top, width: box.left, height: box.height }}
          />
          <div
            className="fixed bg-slate-950/58"
            style={{
              top: box.top,
              left: box.left + box.width,
              width: Math.max(0, viewport.width - (box.left + box.width)),
              height: box.height
            }}
          />
          <div
            className="fixed left-0 bg-slate-950/58"
            style={{ top: box.top + box.height, width: "100%", height: Math.max(0, viewport.height - (box.top + box.height)) }}
          />
          <div
            className="pointer-events-none fixed rounded-2xl border-2 border-white/85 shadow-[0_0_0_1px_rgba(15,23,42,0.35)]"
            style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-slate-950/58" />
      )}

      <div
        className="fixed rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
        style={{ top: tooltipStyle.top, left: tooltipStyle.left, width: tooltipStyle.width }}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">SatyaVault Guided Walkthrough</p>
        <h3 className="mt-1 font-heading text-xl font-semibold text-slate-900">{step.title}</h3>
        <p className="mt-1 text-sm text-slate-600">{step.description}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            Step {stepIndex + 1} of {STEPS.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => closeTour(true)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
            >
              Skip
            </button>
            <button
              onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
              disabled={stepIndex === 0}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 disabled:opacity-40"
            >
              Back
            </button>
            <button
              onClick={advance}
              className="rounded-lg bg-base px-3 py-1.5 text-xs font-semibold text-white"
            >
              {stepIndex >= STEPS.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

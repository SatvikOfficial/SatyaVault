"use client";

interface MobilePreviewProps {
  verifyUrl?: string;
}

export function MobilePreview({ verifyUrl }: MobilePreviewProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-gov">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Mobile Officer Preview</p>
      <div className="mx-auto mt-3 w-[220px] rounded-[2rem] border-[10px] border-slate-900 bg-slate-950 p-3">
        <div className="rounded-[1.4rem] bg-white p-3">
          <p className="text-xs font-semibold text-slate-700">SatyaVault Verify</p>
          <p className="mt-2 text-[10px] text-slate-500">Scan QR on evidence packet.</p>
          <div className="mt-3 rounded-xl bg-slate-100 p-2 text-[10px] text-slate-600">
            {verifyUrl ? verifyUrl : "Generate QR to preview secure link"}
          </div>
        </div>
      </div>
    </div>
  );
}

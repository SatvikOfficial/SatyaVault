import { notFound } from "next/navigation";
import { format } from "date-fns";
import { decodeVerifyToken } from "@/lib/token";
import { getEvidenceWithHistory } from "@/lib/db";

interface VerifyPageProps {
  params: { token: string };
}

export default function VerifyPage({ params }: VerifyPageProps) {
  const payload = decodeVerifyToken(params.token);
  if (!payload) {
    notFound();
  }

  const data = getEvidenceWithHistory(payload.evidenceId);
  if (!data.evidence) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white">
      <section className="mx-auto max-w-md rounded-3xl bg-slate-900 p-4 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">SatyaVault Mobile Verify</p>
        <h1 className="mt-2 text-xl font-semibold text-white">Evidence #{data.evidence.evidenceId}</h1>
        <p className="mt-1 text-sm text-slate-300">Case: {data.evidence.caseId}</p>
        <p className="text-sm text-slate-300">Investigator: {data.evidence.investigatorId}</p>

        <div className="mt-3 rounded-xl border border-emerald-600/40 bg-emerald-600/20 p-3 text-sm text-emerald-100">
          Verified Token Active
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-slate-800 p-2 text-slate-200">
            Custody Events: <span className="font-semibold text-white">{data.history.length}</span>
          </div>
          <div className="rounded-lg bg-slate-800 p-2 text-slate-200">
            Action Logs: <span className="font-semibold text-white">{data.actions.length}</span>
          </div>
        </div>

        <h2 className="mt-4 text-sm font-semibold text-slate-200">Custody Timeline</h2>
        <div className="mt-2 space-y-2">
          {data.history.map((event, index) => (
            <article key={`${event.evidenceId}-${index}`} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <p className="text-sm font-medium text-white">{event.action}</p>
              <p className="text-xs text-slate-300">
                {event.fromOrg} {"->"} {event.toOrg}
              </p>
              <p className="mt-1 text-xs text-slate-400">{format(new Date(event.occurredAt), "dd MMM yyyy, HH:mm")}</p>
            </article>
          ))}
        </div>

        {data.actions.length > 0 ? (
          <>
            <h2 className="mt-4 text-sm font-semibold text-slate-200">Investigative Actions</h2>
            <div className="mt-2 space-y-2">
              {data.actions.map((action, index) => (
                <article key={`${action.evidenceId}-action-${index}`} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                  <p className="text-sm font-medium text-white">{action.actionType}</p>
                  <p className="text-xs text-slate-300">{action.agency}</p>
                  <p className="mt-1 text-xs text-slate-400">{format(new Date(action.occurredAt), "dd MMM yyyy, HH:mm")}</p>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}

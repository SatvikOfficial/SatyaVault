"use client";

import { motion } from "framer-motion";
import { format } from "date-fns";
import { AGENCY_MAP } from "@/lib/agencies";
import type { CustodyEvent, InvestigationAction } from "@/lib/types";

interface TimelineProps {
  history: CustodyEvent[];
  actions: InvestigationAction[];
}

interface TimelineItem {
  type: "CUSTODY" | "ACTION";
  occurredAt: string;
  color: string;
  title: string;
  subtitle: string;
  notes: string;
  actor: string;
  actionRef?: string;
}

function buildTimeline(history: CustodyEvent[], actions: InvestigationAction[]): TimelineItem[] {
  const custodyItems: TimelineItem[] = history.map((event) => ({
    type: "CUSTODY",
    occurredAt: event.occurredAt,
    color: AGENCY_MAP[event.toOrg]?.color || "#0f172a",
    title: event.action,
    subtitle: `${event.fromOrg} -> ${event.toOrg}`,
    notes: event.notes,
    actor: event.toActor
  }));

  const actionItems: TimelineItem[] = actions.map((action) => ({
    type: "ACTION",
    occurredAt: action.occurredAt,
    color: AGENCY_MAP[action.agency]?.color || "#334155",
    title: action.actionType,
    subtitle: `Investigative Action | ${action.agency}`,
    notes: action.actionNotes,
    actor: action.actor,
    actionRef: action.actionRef
  }));

  return [...custodyItems, ...actionItems].sort((a, b) => {
    const at = new Date(a.occurredAt).getTime();
    const bt = new Date(b.occurredAt).getTime();
    return at - bt;
  });
}

export function Timeline({ history, actions }: TimelineProps) {
  const items = buildTimeline(history, actions);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        No chain events yet.
      </div>
    );
  }

  return (
    <div className="relative space-y-4 pl-6">
      <div className="absolute left-2 top-0 h-full w-px bg-gradient-to-b from-saffron via-police to-green" />
      {items.map((item, index) => (
        <motion.div
          key={`${item.type}-${index}-${item.occurredAt}-${item.title}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: index * 0.04 }}
          className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-gov"
        >
          <span
            className="absolute -left-[1.45rem] top-5 h-3 w-3 rounded-full border-2 border-white"
            style={{ backgroundColor: item.color }}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-heading text-sm font-bold text-slate-900">{item.title}</h4>
            <span className="text-xs text-slate-500">{format(new Date(item.occurredAt), "dd MMM yyyy, HH:mm")}</span>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                item.type === "CUSTODY" ? "bg-police/10 text-police" : "bg-slate-700/10 text-slate-700"
              }`}
            >
              {item.type}
            </span>
            <p className="text-sm text-slate-600">{item.subtitle}</p>
          </div>

          <p className="mt-2 text-sm text-slate-700">{item.notes}</p>
          <p className="mt-2 text-xs text-slate-500">By: {item.actor}</p>
          {item.actionRef ? <p className="mt-1 break-all text-[10px] text-slate-400">Ref: {item.actionRef}</p> : null}
        </motion.div>
      ))}
    </div>
  );
}

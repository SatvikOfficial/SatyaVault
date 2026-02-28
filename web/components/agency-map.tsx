"use client";

import dynamic from "next/dynamic";
import type { CustodyEvent } from "@/lib/types";

const DynamicLeafletMap = dynamic(
  () => import("@/components/leaflet-map").then((mod) => mod.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[320px] animate-pulse rounded-2xl bg-slate-200" />
    )
  }
);

interface AgencyMapProps {
  history: CustodyEvent[];
}

export function AgencyMap({ history }: AgencyMapProps) {
  return <DynamicLeafletMap history={history} />;
}

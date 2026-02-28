// @ts-nocheck
"use client";

import "leaflet/dist/leaflet.css";
import { useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";
import { AGENCY_MAP } from "@/lib/agencies";
import type { CustodyEvent } from "@/lib/types";

interface LeafletMapProps {
  history: CustodyEvent[];
}

export function LeafletMap({ history }: LeafletMapProps) {
  const points = useMemo(() => {
    const locations = history
      .map((event) => AGENCY_MAP[event.toOrg])
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (locations.length === 0) {
      return [AGENCY_MAP["Cyber Crime Cell"], AGENCY_MAP["Forensic Science Laboratory"]];
    }

    return locations;
  }, [history]);

  const center = points[0] ? [points[0].lat, points[0].lng] : [22.9734, 78.6569];

  return (
    <MapContainer
      center={center as [number, number]}
      zoom={4.5}
      style={{ height: 320, width: "100%", borderRadius: "16px" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.length >= 2 && (
        <Polyline
          pathOptions={{ color: "#ff9933", weight: 4 }}
          positions={points.map((point) => [point.lat, point.lng])}
        />
      )}
      {points.map((point, idx) => (
        <CircleMarker
          key={`${point.name}-${idx}`}
          center={[point.lat, point.lng]}
          radius={8}
          pathOptions={{ color: point.color, fillColor: point.color, fillOpacity: 0.9 }}
        >
          <Tooltip>{point.name}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

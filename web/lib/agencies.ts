export interface AgencyLocation {
  name: string;
  lat: number;
  lng: number;
  color: string;
}

export const AGENCY_MAP: Record<string, AgencyLocation> = {
  "Cyber Crime Cell": {
    name: "Cyber Crime Cell",
    lat: 28.6139,
    lng: 77.209,
    color: "#0057b8"
  },
  "Forensic Science Laboratory": {
    name: "Forensic Science Laboratory",
    lat: 17.385,
    lng: 78.4867,
    color: "#b54708"
  },
  "e-Courts": {
    name: "e-Courts",
    lat: 28.7041,
    lng: 77.1025,
    color: "#7e22ce"
  },
  "Digital Evidence Locker": {
    name: "Digital Evidence Locker",
    lat: 19.076,
    lng: 72.8777,
    color: "#138808"
  },
  "Ministry of Home Affairs": {
    name: "Ministry of Home Affairs",
    lat: 28.6143,
    lng: 77.1996,
    color: "#111827"
  },
  "Audit & Compliance Wing": {
    name: "Audit & Compliance Wing",
    lat: 12.9716,
    lng: 77.5946,
    color: "#475569"
  }
};

export const ROLE_AGENCIES = {
  INVESTIGATOR: ["Cyber Crime Cell"],
  FSL_OFFICER: ["Forensic Science Laboratory"],
  COURT_OFFICER: ["e-Courts"],
  AUDITOR: ["Audit & Compliance Wing"],
  MINISTRY_ADMIN: [
    "Ministry of Home Affairs",
    "Cyber Crime Cell",
    "Forensic Science Laboratory",
    "e-Courts",
    "Audit & Compliance Wing"
  ],
  NONE: []
};

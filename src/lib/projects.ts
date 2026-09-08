export type StageId =
  | "brief"
  | "design"
  | "development"
  | "review"
  | "testing"
  | "launch";

export const STAGES: Array<{ id: StageId; label: string }> = [
  { id: "brief", label: "Brief" },
  { id: "design", label: "Design" },
  { id: "development", label: "Development" },
  { id: "review", label: "Review" },
  { id: "testing", label: "Testing" },
  { id: "launch", label: "Launch" },
];

export type StageState = {
  status: "pending" | "in-progress" | "done";
  approved: boolean;
  approvedBy?: string;
  comments: string[];
};

export type Project = {
  id: string;
  name: string;
  client: string;
  status: "In Progress" | "Pending" | "Completed";
  progress: number;
  deadline: string;
  team: string[];
  stages: Record<StageId, StageState>;
};

const DEFAULT_STAGES: Record<StageId, StageState> = {
  brief: { status: "done", approved: true, comments: [] },
  design: { status: "done", approved: true, comments: [] },
  development: { status: "in-progress", approved: false, comments: [] },
  review: { status: "pending", approved: false, comments: [] },
  testing: { status: "pending", approved: false, comments: [] },
  launch: { status: "pending", approved: false, comments: [] },
};

export const PROJECTS: Project[] = [
  {
    id: "PRJ-1007",
    name: "Website Corporativo — Amplius",
    client: "Amplius Consulting",
    status: "In Progress",
    progress: 65,
    deadline: "30 Set 2026",
    team: ["Pedro D.", "Ana S."],
    stages: DEFAULT_STAGES,
  },
  {
    id: "PRJ-1008",
    name: "Loja Online — Kaya",
    client: "Kaya Colectivo",
    status: "In Progress",
    progress: 40,
    deadline: "15 Out 2026",
    team: ["Pedro D.", "Tiago M.", "Rita F."],
    stages: {
      brief: { status: "done", approved: true, comments: [] },
      design: { status: "in-progress", approved: true, comments: [] },
      development: { status: "pending", approved: false, comments: [] },
      review: { status: "pending", approved: false, comments: [] },
      testing: { status: "pending", approved: false, comments: [] },
      launch: { status: "pending", approved: false, comments: [] },
    },
  },
  {
    id: "PRJ-1009",
    name: "Marca + Website — Hotel Castel",
    client: "Hotel Castel",
    status: "In Progress",
    progress: 20,
    deadline: "10 Nov 2026",
    team: ["Ana S.", "Rita F."],
    stages: {
      brief: { status: "done", approved: true, comments: [] },
      design: { status: "in-progress", approved: false, comments: [] },
      development: { status: "pending", approved: false, comments: [] },
      review: { status: "pending", approved: false, comments: [] },
      testing: { status: "pending", approved: false, comments: [] },
      launch: { status: "pending", approved: false, comments: [] },
    },
  },
];

export const PROJECTS_META: Record<string, { revenue: number; startDate: string }> = {
  "PRJ-1007": { revenue: 55000, startDate: "01 Ago 2026" },
  "PRJ-1008": { revenue: 85000, startDate: "15 Ago 2026" },
  "PRJ-1009": { revenue: 60000, startDate: "01 Set 2026" },
};

// ─── Persistência no cliente ──────────────────────────────────────────
const KEY_PREFIX = "idesign-projects-v1";

type ProjectOverrides = Partial<Record<StageId, Partial<StageState>>>;

const listeners = new Set<() => void>();

function readOverrides(projectId: string): ProjectOverrides {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(`${KEY_PREFIX}:${projectId}`);
    return raw ? (JSON.parse(raw) as ProjectOverrides) : {};
  } catch {
    return {};
  }
}

function writeOverrides(projectId: string, overrides: ProjectOverrides) {
  try {
    window.localStorage.setItem(`${KEY_PREFIX}:${projectId}`, JSON.stringify(overrides));
  } catch {
    // ignore
  }
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getServerState(): Project[] {
  return PROJECTS;
}

export function getProjectState(project: Project): Project {
  try {
    const overrides = readOverrides(project.id);
    let changed = false;
    const stages = { ...project.stages };
    for (const [stageId, patch] of Object.entries(overrides)) {
      if (patch) {
        stages[stageId as StageId] = { ...stages[stageId as StageId], ...patch };
        changed = true;
      }
    }
    return changed ? { ...project, stages } : project;
  } catch {
    return project;
  }
}

export function toggleApproval(projectId: string, stageId: StageId, userId: string) {
  const overrides = readOverrides(projectId);
  const prev = overrides[stageId];
  const newState: Partial<StageState> = {
    approved: !(prev?.approved ?? false),
    comments: prev?.comments ?? [],
  };
  if (newState.approved) {
    newState.approvedBy = userId;
  } else {
    delete newState.approvedBy;
  }
  overrides[stageId] = newState;
  writeOverrides(projectId, overrides);
}

export function addComment(projectId: string, stageId: StageId, text: string, userName: string) {
  const overrides = readOverrides(projectId);
  const prev = overrides[stageId];
  const comment = `${userName}: ${text.trim()}`;
  overrides[stageId] = {
    approved: prev?.approved ?? false,
    comments: [...(prev?.comments ?? []), comment],
  };
  writeOverrides(projectId, overrides);
}
/** A pointer from a profile line back to the passage it came from. */
export interface Citation {
  sourceId: string;
  passageId: string;
  title: string;
}

export interface ProfileLine {
  id: string;
  text: string;
  citations: Citation[];
}

export interface ProposedInitiative {
  id: string;
  title: string;
  summary: string;
  citations: Citation[];
  /** proposed until a person accepts it; accepted ones exist in the work engine. */
  status: 'proposed' | 'accepted' | 'dismissed';
  /** The initiative's id in the work engine once accepted. */
  workId: string | null;
  /** Adopted by the organization's governance, when governance is on. */
  adopted: boolean;
}

/** The organization profile Inertia drafts from what it has been told. */
export interface OrgProfile {
  mission: ProfileLine | null;
  programs: ProfileLine[];
  people: ProfileLine[];
  recent: ProfileLine[];
  initiatives: ProposedInitiative[];
}

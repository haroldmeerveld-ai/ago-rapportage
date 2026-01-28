
export interface GoalEntry {
  title: string;
  content: string;
}

export interface ReportData {
  childName: string;
  begeleiderInitials: string;
  activitiesGeneral: string;
  activitiesStart: string;
  activitiesMid: string;
  activitiesEnd: string;
  needsSignalsIndruk: string;
  needsSignalsCamera: string;
  needsWhat: string;
  needsAction: string;
  goals: GoalEntry[];
  incidents: string;
  extraContext: string;
  reflection: string;
  reflectionQuestion: string;
}

export type StepKey = keyof ReportData;

export interface StepConfig {
  id: number;
  key: StepKey;
  label: string;
  description: string;
  placeholder: string;
  optional?: boolean;
  tooltip?: string;
}

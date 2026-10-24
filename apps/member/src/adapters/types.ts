export type SourceRef = {
  kind: 'meeting' | 'chat' | 'proposal' | 'task' | 'initiative' | 'share' | 'event' | 'document';
  id: string;
  title: string;
  url?: string;
};

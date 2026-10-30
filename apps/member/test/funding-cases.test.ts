import { describe, it, expect } from 'vitest';
import { caseState, caseTitle, isFundingCase, officialSource } from '../src/funding/cases';

describe('grant cases from the work engine', () => {
  it('recognises the funding workflow’s case issues by how they are briefed', () => {
    expect(isFundingCase('Prepare preliminary funding case binding 24c461b7 from official source https://futo.tech/grants. Use funding_case_work')).toBe(true);
    expect(isFundingCase('Prepare this explicitly bound funding case incrementally through the protected funding_case tools')).toBe(true);
    expect(isFundingCase('Continue INTERNAL funding discovery reconciliation using existing INE52 results')).toBe(false);
    expect(isFundingCase(null)).toBe(false);
  });

  it('names the program without the workflow lead-in', () => {
    expect(caseTitle('Prepare funding case — Transport Phenomena (TP)')).toBe('Transport Phenomena (TP)');
    expect(caseTitle('FUTO Grants')).toBe('FUTO Grants');
  });

  it('finds the official page, without trailing punctuation', () => {
    expect(officialSource('Prepare preliminary funding case binding x from official source https://futo.tech/grants. Use funding_case_work')).toBe('https://futo.tech/grants');
    expect(officialSource('Prepare this explicitly bound funding case incrementally')).toBeNull();
  });

  it('says where each case stands in plain words, never that it was submitted', () => {
    expect(caseState({ status: 'todo' })).toEqual({ state: 'queued', label: 'Queued' });
    expect(caseState({ status: 'in_progress' })).toEqual({ state: 'preparing', label: 'Being prepared' });
    expect(caseState({ status: 'in_review' })).toEqual({ state: 'agent-review', label: 'In agent review' });
    expect(caseState({ status: 'blocked', unblockDescriptor: { owner: { agentId: 'a1' }, action: 'Independently review the corrected source proposal' } })).toEqual({ state: 'agent-review', label: 'In agent review' });
    expect(caseState({ status: 'blocked', unblockDescriptor: { owner: { agentId: 'a1' }, action: 'Collect the missing budget figures' } })).toEqual({ state: 'waiting', label: 'Waiting on an agent' });
    expect(caseState({ status: 'blocked', unblockDescriptor: { owner: { userId: 'u1' }, action: 'Confirm the applicant' } })).toEqual({ state: 'needs-person', label: 'Needs a person' });
    expect(caseState({ status: 'blocked', unblockDescriptor: { owner: 'board', action: 'Reopen the extraction' } })).toEqual({ state: 'needs-person', label: 'Needs a person' });
    expect(caseState({ status: 'done' })).toEqual({ state: 'prepared', label: 'Prepared by agents' });
    expect(caseState({ status: 'cancelled' })).toBeNull();
  });
});

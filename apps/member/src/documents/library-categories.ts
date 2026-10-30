/** The library's shelves, in display order. Shared with the client. */
export type LibraryCategory = 'one-pager' | 'policy' | 'brand' | 'finance' | 'other';

export const LIBRARY_CATEGORIES: { category: LibraryCategory; label: string }[] = [
  { category: 'one-pager', label: 'One-pagers' },
  { category: 'policy', label: 'Policies' },
  { category: 'brand', label: 'Brand' },
  { category: 'finance', label: 'Finance' },
  { category: 'other', label: 'Other' },
];

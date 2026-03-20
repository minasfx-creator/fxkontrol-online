

# Fix: Marketplace Search Filtering Bug

## Problem
The fallback search in both `getFabFallbackResults()` and `getWarehouseFallbackResults()` in `src/lib/marketplaceApi.ts` checks if a tag contains the entire query string (e.g., `"stage concert venue"`). Since no single tag contains that full phrase, searches with multiple words return 0 results despite matching catalog entries existing.

## Fix
**File**: `src/lib/marketplaceApi.ts`

Split the query into individual words and check if ANY word matches ANY tag or appears in the title/description. This is a standard tokenized search approach.

### Changes

**Lines 246-249** (`getFabFallbackResults` filter) and **Lines 416-419** (`getWarehouseFallbackResults` filter):

Replace the single-string match:
```typescript
const filtered = catalog.filter(a =>
  !lower || a.title.toLowerCase().includes(lower) ||
  a.tags.some(t => t.includes(lower)) ||
  a.description.toLowerCase().includes(lower)
);
```

With tokenized word matching:
```typescript
const words = lower.split(/\s+/).filter(Boolean);
const filtered = catalog.filter(a => {
  if (words.length === 0) return true;
  const title = a.title.toLowerCase();
  const desc = a.description.toLowerCase();
  return words.some(w =>
    title.includes(w) ||
    a.tags.some(t => t.includes(w)) ||
    desc.includes(w)
  );
});
```

This ensures "stage concert venue" matches any asset containing "stage" OR "concert" OR "venue" in its title, tags, or description.


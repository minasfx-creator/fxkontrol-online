

## Google Places API Integration in GeoLocationSetup

### What
Add live Google Places autocomplete search to GeoLocationSetup so users can find any address worldwide, not just preset cities. Typed queries hit a new edge function that proxies Google Places API, and results appear alongside the existing presets.

### Architecture

```text
User types "Torre Eiffel"
  → GeoLocationSetup (debounced 400ms)
    → Edge Function: google-places-search
      → Google Places Text Search API (New)
        ← results with name, lat, lng, formatted_address
      ← JSON response
    ← Show results in list below presets
```

### Changes

**1. New Edge Function: `supabase/functions/google-places-search/index.ts`**
- Accepts `{ query: string }` POST body
- Uses `GOOGLE_MAPS_API_KEY` (already configured) to call Google Places API (Text Search)
- URL: `https://places.googleapis.com/v1/places:searchText`
- Returns array of `{ name, lat, lng, formattedAddress }` (max 5 results)
- Full CORS headers

**2. Update `src/components/editor/GeoLocationSetup.tsx`**
- Add state: `apiResults` (array), `searching` (boolean)
- Add debounced effect: when `search` changes and length >= 3, call the edge function via `supabase.functions.invoke('google-places-search', { body: { query: search } })`
- Display API results in a separate section below presets, with a `Globe` icon and formatted address subtitle
- Clicking an API result calls the same `handleSelect` logic (fly-to + store update)
- Show a subtle "Searching..." loader while fetching
- If no presets match AND no API results, show "No results found"

### Files Changed
| File | Action |
|------|--------|
| `supabase/functions/google-places-search/index.ts` | **CREATE** — proxy edge function |
| `src/components/editor/GeoLocationSetup.tsx` | **EDIT** — add API search integration |


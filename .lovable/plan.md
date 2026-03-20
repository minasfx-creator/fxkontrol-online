

# Plan: Features for International Artist/DJ Producers

## Context
FX KONTROL already has a powerful 3D editor, timeline, live firing, and event agenda. But for a **producer managing international artists/DJs**, key workflow gaps exist: no setlist management, no technical rider builder, no multi-currency budgeting, no timezone-aware scheduling, and no quick way to share show previews with clients abroad.

## New Features (5 modules)

### 1. Setlist Manager Panel (`SetlistPanel.tsx`)
A draggable track list synced to the timeline:
- Add songs with title, artist, BPM, duration, key
- Drag to reorder; total runtime auto-calculated
- Each song maps to a timeline segment (start/end markers)
- "Sync to Timeline" button auto-creates segment markers
- Import from Spotify/text paste (CSV: title, duration)
- Color-coded blocks on the timeline track
- Export as PDF rundown for stage manager

### 2. Technical Rider Builder (`RiderPanel.tsx`)
Generate professional technical riders:
- Equipment checklist with quantities (power, DMX universes, firing modules, CO2 tanks, etc.)
- Auto-populated from current project (reads positions, effects, DMX channels, racks)
- Venue requirements section (min clearance, safety distances from NFPA panel)
- Power calculation (amps per circuit, total kW)
- Export as branded PDF with event logo
- Share link for venue technical director

### 3. Multi-Currency Budget Panel (`BudgetPanel.tsx`)
Financial tracking for international tours:
- Line items: equipment rental, transport, crew, pyro materials, permits
- Auto-cost from inventory/supplier panels (reads existing data)
- Multi-currency support (USD, EUR, BRL, GBP) with live conversion
- Budget vs actual tracking
- Per-event and tour-total views
- Export as spreadsheet

### 4. Tour Schedule View (enhance `Agenda.tsx`)
Upgrade the agenda for international touring:
- Map view showing all tour dates with route lines
- Timezone display per event (already have timezone field)
- Travel time estimates between venues
- Countdown to next event on Dashboard
- Status pipeline: Negotiation → Confirmed → Rider Sent → Mounted → Executed → Invoiced
- Quick-duplicate event (same setup, new city/date)

### 5. Client Preview Share (`ShowPreviewPanel.tsx`)
One-tap shareable show preview for artists/managers:
- Generate a video recording of the 3D show (uses existing VideoRecorderPanel)
- Add branded overlay (event name, artist, date)
- Generate shareable link (upload to storage, public URL)
- QR code generation for on-site sharing
- Approval workflow: client can approve/request changes (ties into existing ClientApprovalPanel)
- WhatsApp/Email share buttons

## Database Changes
New tables needed:
- `setlists` (id, project_id, user_id, tracks JSONB, created_at)
- `budgets` (id, event_id, user_id, currency, line_items JSONB, created_at)
- `rider_templates` (id, user_id, name, sections JSONB, created_at)

## Files Summary

| File | Action |
|------|--------|
| `src/components/editor/SetlistPanel.tsx` | Create — setlist manager |
| `src/components/editor/RiderPanel.tsx` | Create — technical rider builder |
| `src/components/editor/BudgetPanel.tsx` | Create — multi-currency budget |
| `src/components/editor/ShowPreviewPanel.tsx` | Create — shareable preview generator |
| `src/pages/Agenda.tsx` | Edit — add map view, tour pipeline statuses |
| `src/pages/Dashboard.tsx` | Edit — add tour countdown, next-event widget |
| `src/components/editor/MobileMoreMenu.tsx` | Edit — add new panels to menu |
| `src/components/editor/PanelTabBar.tsx` | Edit — register new panel IDs |
| `src/pages/Index.tsx` | Edit — wire new panels |
| DB migration | Create setlists, budgets, rider_templates tables |

## Priority Order
1. **Setlist Manager** — most immediate value for DJ producers
2. **Technical Rider** — saves hours of manual document creation
3. **Client Preview Share** — closes deals faster
4. **Tour Schedule** — essential for multi-city planning
5. **Budget Panel** — financial control for tour managers


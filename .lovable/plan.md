

# Plan: Add UE5 T3D / COPY Format Support to DMX Importer

## Context

You uploaded `DMXLib_v4-2.COPY` -- a UE5 T3D text export of the DMX Library containing 800+ fixture patches. This is the native format you get when you select fixtures in UE5 and press Ctrl+C (Copy). The current importer only supports CSV and JSON but not this T3D format.

The file contains rich structured data per fixture:
- `Name` (e.g. "SpotMH2_345", "Pyro_11", "AudienceStrip_12", "MatrixStripRGB_90", "CatwalkStrip_7")
- `UniverseID` and `StartingChannel`
- `FixtureID` and `ActiveMode`
- `EditorColor` as linear RGBA (e.g. `R=0.007812,G=0.000000,B=1.000000,A=1.000000`)
- `ParentFixtureTypeTemplate` reference (e.g. `DMXEntityFixtureType_0`, `_9`, etc.)
- `MVRFixtureUUID`

## Changes

### 1. Add T3D Parser to `src/lib/ue5DmxPrevisParser.ts`

New function `parseUE5T3D(text: string): UE5DMXParseResult` that:
- Detects T3D format by checking for `Begin Object Class=/Script/DMXRuntime`
- Uses regex to extract each `Begin Object Name="DMXEntityFixturePatch_..."` block with its properties
- Parses `Name`, `UniverseID` (default 1), `StartingChannel`, `FixtureID`, `ActiveMode`, `MVRFixtureUUID`
- Converts `EditorColor=(R=...,G=...,B=...,A=...)` from linear float to hex CSS color
- Maps `ParentFixtureTypeTemplate` references to fixture type IDs
- Also extracts `DMXEntityFixtureType` entries to build a type-to-name lookup
- Uses existing `inferUE5Profile()` for profile mapping based on fixture name keywords
- Expected to parse all 800+ fixtures from the uploaded file

Update `parseUE5DMXLibrary()` auto-detect to check for T3D format before JSON/CSV.

### 2. Update `src/components/editor/UE5DMXPrevisImporter.tsx`

- Accept `.copy` and `.t3d` file extensions in addition to `.csv`/`.json`
- Update file input `accept` attribute and drop zone text
- No other UI changes needed -- the parser returns the same `UE5DMXParseResult`

### 3. Update Viewport Drag-and-Drop in `src/pages/Index.tsx`

- Add `.copy` and `.t3d` to `SUPPORTED_DROP_EXTENSIONS`
- Map them to the `ue5json` drop type so they open the UE5 DMX importer

### 4. Update Toolbar drop handler in `src/components/editor/Toolbar.tsx`

- Handle `.copy` and `.t3d` extensions in the `viewport-file-drop` event listener

## Technical Details

T3D fixture block structure:
```text
Begin Object Name="DMXEntityFixturePatch_734"
   UniverseID=13          (optional, default 1)
   StartingChannel=53
   ParentFixtureTypeTemplate="...DMXEntityFixtureType_0"
   FixtureID=76
   ActiveMode=4            (optional)
   MVRFixtureUUID=8D50...
   EditorColor=(R=0.000000,G=1.000000,B=0.648438,A=1.000000)
   Name="SpotMH1_205"
   ParentLibrary="..."
End Object
```

Fixture types found in this file: SpotMH1, SpotMH2, WashMH2, Pyro, Audience, AudienceStrip, CatwalkStrip, MatrixStripRGB, ScenicWash -- all map well to existing profile keywords.


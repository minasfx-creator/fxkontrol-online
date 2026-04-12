/**
 * Shared UE5 DMX types — extracted to break circular dependency
 * between ue5DmxPrevisParser ↔ ue5T3dParser.
 */

export interface UE5DMXFixture {
  name: string;
  fixtureType: string;
  universe: number;
  startChannel: number;
  channelCount: number;
  mode: string;
  gdtfSource: string;
  profileId: string;
  category: string;
  color: string;
}

export interface UE5DMXParseResult {
  fixtures: UE5DMXFixture[];
  libraryName: string;
  format: 'csv' | 'json' | 't3d';
  warnings: string[];
}

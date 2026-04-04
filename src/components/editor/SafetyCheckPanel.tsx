/**
 * SafetyCheckPanel — DEPRECATED
 * 
 * This component has been unified into SafetyPanel (Flight Check tab).
 * This file re-exports the FlightCheckTab for backward compatibility.
 * 
 * @deprecated Use SafetyPanel instead (which includes both tabs).
 */
import FlightCheckTab from './safety/FlightCheckTab';

export default function SafetyCheckPanel() {
  return (
    <div className="p-1">
      <FlightCheckTab />
    </div>
  );
}

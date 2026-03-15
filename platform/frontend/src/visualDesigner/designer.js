/**
 * FX KONTROL · Visual Show Designer
 * Timeline-based show composition with drag-and-drop effect placement.
 */

export function initShowDesigner(scene) {
  const timeline = {
    duration: 180, // seconds
    bpm: 120,
    tracks: [],
    cues: [],
  };

  function addCue(time, effectType, position) {
    const cue = {
      id: `cue_${Date.now()}`,
      time,
      effectType,
      position,
      duration: 3.0,
      color: [1, 0.8, 0.2],
    };
    timeline.cues.push(cue);
    console.log(`[Designer] Added ${effectType} cue at t=${time}s`);
    return cue;
  }

  function removeCue(id) {
    timeline.cues = timeline.cues.filter(c => c.id !== id);
  }

  function getCuesAtTime(time) {
    return timeline.cues.filter(c => time >= c.time && time < c.time + c.duration);
  }

  console.log("[Designer] Show Designer initialized");
  return { timeline, addCue, removeCue, getCuesAtTime };
}

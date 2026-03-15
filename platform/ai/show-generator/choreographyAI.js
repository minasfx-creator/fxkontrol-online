/**
 * FX KONTROL · Choreography AI
 * Generates drone formations, pyro events, and light programs from narrative arc.
 * by Minas FX
 */

const FORMATION_LIBRARY = [
  "grid", "circle", "sphere", "helix", "wave", "heart",
  "star", "spiral", "phoenix", "crown", "diamond", "cross",
  "cascade", "fountain", "tornado", "fireball",
];

export function generateChoreography({ arc, droneCount, style, pyroEnabled }) {
  const timeline = [];
  const formations = [];
  const pyroEvents = [];
  const lightProgram = [];

  let formationIdx = 0;

  for (const segment of arc) {
    // Pick formation based on energy and phase
    const formation = selectFormation(segment, formationIdx++);
    formations.push({
      time: segment.time,
      duration: segment.duration,
      shape: formation,
      droneCount,
      transitionType: segment.energy > 0.7 ? "burst" : "smooth",
      transitionDuration: 3.0,
    });

    // Light color based on phase
    const color = getPhaseColor(segment.phase, segment.energy);
    lightProgram.push({
      time: segment.time,
      duration: segment.duration,
      color,
      effect: segment.energy > 0.8 ? "strobe" : segment.energy > 0.5 ? "pulse" : "static",
      intensity: segment.energy,
    });

    // Pyro events at high energy moments
    if (pyroEnabled && segment.energy > 0.6) {
      const pyroCount = Math.floor(segment.energy * 8);
      for (let i = 0; i < pyroCount; i++) {
        pyroEvents.push({
          time: segment.time + (i / pyroCount) * segment.duration,
          type: segment.energy > 0.9 ? "shell" : segment.energy > 0.7 ? "comet" : "mine",
          caliber: 50 + segment.energy * 100,
          position: [
            (Math.random() - 0.5) * 40,
            0,
            (Math.random() - 0.5) * 20,
          ],
          color: color,
        });
      }
    }

    timeline.push({
      time: segment.time,
      event: "formation_change",
      data: { formation, energy: segment.energy },
    });
  }

  console.log(`[ChoreographyAI] Generated: ${formations.length} formations, ${pyroEvents.length} pyro cues`);
  return { timeline, formations, pyroEvents, lightProgram };
}

function selectFormation(segment, index) {
  if (segment.phase === "finale") return "phoenix";
  if (segment.phase === "intro") return "grid";
  if (segment.energy > 0.8) return FORMATION_LIBRARY[index % FORMATION_LIBRARY.length];
  return FORMATION_LIBRARY[(index * 3) % FORMATION_LIBRARY.length];
}

function getPhaseColor(phase, energy) {
  switch (phase) {
    case "intro": return [0, 0.9, 1.0];      // FXK Cyan
    case "build": return [1.0, 0.6, 0.0];     // FXK Orange
    case "develop": return [0.8, 0.2, 1.0];   // Purple
    case "finale": return [1.0, 0.85, 0.0];   // FXK Gold
    default: return [1, 1, 1];
  }
}

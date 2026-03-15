/**
 * FX KONTROL · AI Show Generator
 * Generates complete drone + fireworks show from music and parameters.
 * by Minas FX
 */

import { analyzeMusicStructure } from "./musicAnalyzer.js";
import { generateChoreography } from "./choreographyAI.js";

export async function generateShow(config) {
  const {
    duration = 180,
    droneCount = 500,
    musicUrl = null,
    style = "cinematic",
    intensity = 0.7,
    pyroEnabled = true,
  } = config;

  console.log(`[ShowGenerator] Creating ${style} show: ${duration}s, ${droneCount} drones`);

  // Step 1: Analyze music (if provided)
  let musicStructure = null;
  if (musicUrl) {
    musicStructure = await analyzeMusicStructure(musicUrl);
  }

  // Step 2: Generate narrative arc
  const arc = generateNarrativeArc(duration, intensity, musicStructure);

  // Step 3: Generate choreography
  const choreography = generateChoreography({
    arc,
    droneCount,
    style,
    pyroEnabled,
  });

  // Step 4: Compile show file
  const show = {
    version: "2.0",
    platform: "FX KONTROL",
    creator: "Minas FX AI Generator",
    duration,
    droneCount,
    timeline: choreography.timeline,
    formations: choreography.formations,
    pyroEvents: choreography.pyroEvents,
    lightProgram: choreography.lightProgram,
    metadata: {
      style,
      intensity,
      generatedAt: new Date().toISOString(),
      musicStructure,
    },
  };

  console.log(`[ShowGenerator] Show compiled: ${show.timeline.length} events, ${show.formations.length} formations`);
  return show;
}

function generateNarrativeArc(duration, intensity, music) {
  const segments = [];
  const segmentDuration = 15; // seconds per segment

  for (let t = 0; t < duration; t += segmentDuration) {
    const progress = t / duration;
    let energy;

    // Classic show arc: intro → build → climax → finale
    if (progress < 0.15) energy = 0.3 * intensity;
    else if (progress < 0.4) energy = (0.3 + progress * 0.8) * intensity;
    else if (progress < 0.75) energy = (0.5 + Math.sin(progress * Math.PI * 4) * 0.3) * intensity;
    else if (progress < 0.9) energy = 0.9 * intensity;
    else energy = 1.0 * intensity; // Grand finale

    // Sync to music beats if available
    if (music?.beats) {
      const nearestBeat = music.beats.find(b => Math.abs(b.time - t) < 0.5);
      if (nearestBeat) energy *= 1.2;
    }

    segments.push({
      time: t,
      duration: segmentDuration,
      energy: Math.min(energy, 1.0),
      phase: progress < 0.15 ? "intro" : progress < 0.4 ? "build" : progress < 0.9 ? "develop" : "finale",
    });
  }

  return segments;
}

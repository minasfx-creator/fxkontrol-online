'use strict';

const ORB_PRESET = {
  IDLE: { primaryColor: '#55C8FF', secondaryColor: '#FF9E45', glow: 0.45, pulseHz: 0.6, opacity: 0.58 },
  GUIDING: { primaryColor: '#6CE0FF', secondaryColor: '#FFA35C', glow: 0.58, pulseHz: 0.9, opacity: 0.62 },
  ALERT: { primaryColor: '#FF9A4D', secondaryColor: '#FFC66E', glow: 0.82, pulseHz: 1.3, opacity: 0.75 },
  CINEMATIC: { primaryColor: '#38D6FF', secondaryColor: '#FFAA66', glow: 0.65, pulseHz: 0.7, opacity: 0.6 },
};

function getAssistantOrbVisual(state) {
  return ORB_PRESET[state];
}

module.exports = { getAssistantOrbVisual };

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { AICoPilot } = require('../modules/ai/AICoPilot.cjs');
const { AIDecisionEngine } = require('../modules/ai/AIDecisionEngine.cjs');
const { FXKAssistant } = require('../modules/ai/FXKAssistant.cjs');
const { getAssistantOrbVisual } = require('../modules/ai/AssistantOrb.cjs');
const { DEFAULT_AI_CONTROLS, updateAIControlState } = require('../modules/ai/AIControls.cjs');
const { buildHologramFrame, getHologramUXTokens } = require('../modules/ai/HologramAssistantUX.cjs');

const baseState = {
  position: { x: 0, y: 0, z: 10 },
  velocity: { x: 1, y: 0, z: 0 },
  batteryPct: 78,
  windMps: 2,
  signalQuality: 0.9,
};

test('AIDecisionEngine gera trajetória segura e hint cinematográfico', () => {
  const engine = new AIDecisionEngine();
  const out = engine.computeSafeTrajectory(baseState, [], {
    mode: 'HOLD_FRAME',
    target: { x: 20, y: 0, z: 12 },
    dropComing: true,
  });

  assert.equal(out.riskDetected, false);
  assert.equal(out.assistantHint, 'wide_framing');
  assert.equal(out.safeTrajectory.length, 3);
});

test('AICoPilot aplica override em risco quando não está MANUAL', () => {
  const copilot = new AICoPilot('ASSISTED');
  const out = copilot.processInput(
    { pitch: 1, roll: 1, yaw: 1, throttle: 1 },
    { ...baseState, position: { x: 0, y: 0, z: 1 } },
    [{ id: 'tower', position: { x: 0, y: 0, z: 1 }, radius: 2 }],
    { mode: 'TRANSIT', target: { x: 10, y: 0, z: 10 } },
  );

  assert.equal(out.overrideActive, true);
  assert.ok(out.smoothedInput.pitch < 1);
});

test('FXKAssistant entrega frame holográfico premium e não intrusivo', () => {
  const assistant = new FXKAssistant();
  assistant.setVoiceEnabled(true);

  const out = assistant.update({ mode: 'CINEMATIC', riskDetected: false, signalQuality: 0.9, windMps: 3, dropComing: true });
  assert.equal(out.state, 'CINEMATIC');
  assert.match(out.hudMessage, /cinematic/i);
  assert.equal(typeof out.voiceMessage, 'string');
  assert.equal(out.hologram.mood, 'CINEMATIC');
  assert.ok(out.uxTokens.card.backdropBlur >= 18);
});

test('AssistantOrb muda preset por estado', () => {
  const alertOrb = getAssistantOrbVisual('ALERT');
  const idleOrb = getAssistantOrbVisual('IDLE');

  assert.ok(alertOrb.glow > idleOrb.glow);
  assert.ok(alertOrb.opacity > idleOrb.opacity);
});

test('AIControls expõe toggles de co-piloto/assistência/voz', () => {
  const updated = updateAIControlState(DEFAULT_AI_CONTROLS, {
    enabled: true,
    assistLevel: 0.9,
    voiceEnabled: true,
    mode: 'AI_CONTROL',
  });

  assert.equal(updated.enabled, true);
  assert.equal(updated.voiceEnabled, true);
  assert.equal(updated.mode, 'AI_CONTROL');
  assert.equal(updated.assistLevel, 0.9);
});

test('HologramAssistantUX gera tema ALERT e tokens de UX', () => {
  const frame = buildHologramFrame({ riskDetected: true, cinematic: false, signalQuality: 0.8, windMps: 2 });
  const tokens = getHologramUXTokens();

  assert.equal(frame.mood, 'ALERT');
  assert.equal(frame.chip, 'OVERRIDE');
  assert.equal(tokens.motion.uiMs, 240);
});

test('HologramAssistantUX FOCUS mood for high wind', () => {
  const frame = buildHologramFrame({ riskDetected: false, cinematic: false, signalQuality: 0.9, windMps: 12 });
  assert.equal(frame.mood, 'FOCUS');
  assert.equal(frame.chip, 'ASSIST');
});

test('HologramAssistantUX CALM mood for nominal state', () => {
  const frame = buildHologramFrame({ riskDetected: false, cinematic: false, signalQuality: 0.9, windMps: 2 });
  assert.equal(frame.mood, 'CALM');
  assert.equal(frame.chip, 'OK');
});

// ═══ Edge cases ═══

test('EDGE: Battery critical + obstacle simultaneously', () => {
  const engine = new AIDecisionEngine();
  const out = engine.computeSafeTrajectory(
    { ...baseState, batteryPct: 5, position: { x: 0, y: 0, z: 10 } },
    [{ id: 'wall', position: { x: 1, y: 0, z: 10 }, radius: 2 }],
    { mode: 'TRANSIT', target: { x: 20, y: 0, z: 10 } },
  );

  assert.equal(out.riskDetected, true);
  const types = out.adjustments.map(a => a.type);
  assert.ok(types.includes('battery'));
  assert.ok(types.includes('obstacle'));
});

test('EDGE: Signal lost during CINEMATIC mode', () => {
  const copilot = new AICoPilot('CINEMATIC');
  const out = copilot.processInput(
    { pitch: 0.5, roll: 0.3, yaw: 0.2, throttle: 0.7 },
    { ...baseState, signalQuality: 0.1 },
    [],
    { mode: 'CINEMATIC' },
  );

  assert.equal(out.overrideActive, true);
  assert.ok(out.decision.riskDetected);
});

test('EDGE: Multiple obstacles from different directions', () => {
  const engine = new AIDecisionEngine();
  const obstacles = [
    { id: 'obs1', position: { x: 1, y: 0, z: 10 }, radius: 1 },
    { id: 'obs2', position: { x: 0, y: 1, z: 10 }, radius: 1 },
    { id: 'obs3', position: { x: -1, y: -1, z: 10 }, radius: 1.5 },
  ];
  const out = engine.computeSafeTrajectory(baseState, obstacles, {
    mode: 'TRANSIT', target: { x: 30, y: 0, z: 10 },
  });

  assert.equal(out.riskDetected, true);
  assert.ok(out.adjustments.filter(a => a.type === 'obstacle').length >= 2);
});

test('EDGE: All risks simultaneously', () => {
  const engine = new AIDecisionEngine();
  const out = engine.computeSafeTrajectory(
    { ...baseState, batteryPct: 3, signalQuality: 0.1, position: { x: 0, y: 0, z: 1 } },
    [{ id: 'tower', position: { x: 0.5, y: 0, z: 1 }, radius: 1 }],
    { mode: 'HOLD_FRAME' },
  );

  assert.equal(out.riskDetected, true);
  const types = out.adjustments.map(a => a.type);
  assert.ok(types.includes('altitude'));
  assert.ok(types.includes('battery'));
  assert.ok(types.includes('signal'));
  assert.ok(types.includes('obstacle'));
  assert.equal(out.assistantHint, 'evasion');
});

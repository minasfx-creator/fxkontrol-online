'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { AICoPilot } = require('../modules/ai/AICoPilot.cjs');
const { AIDecisionEngine } = require('../modules/ai/AIDecisionEngine.cjs');
const { FXKAssistant } = require('../modules/ai/FXKAssistant.cjs');
const { getAssistantOrbVisual } = require('../modules/ai/AssistantOrb.cjs');
const { DEFAULT_AI_CONTROLS, updateAIControlState } = require('../modules/ai/AIControls.cjs');

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
  assert.ok(out.decision, 'should return decision object');
  assert.ok(out.suggestedCameraTarget, 'should return suggestedCameraTarget');
});

test('AICoPilot CINEMATIC mode dampens input extra', () => {
  const copilot = new AICoPilot('CINEMATIC');
  const out = copilot.processInput(
    { pitch: 1, roll: 1, yaw: 1, throttle: 1 },
    baseState,
    [],
    { mode: 'CINEMATIC' },
  );

  assert.equal(out.overrideActive, false);
  assert.ok(out.smoothedInput.pitch < 0.8, 'CINEMATIC should dampen pitch');
  assert.ok(out.smoothedInput.yaw < 0.7, 'CINEMATIC should dampen yaw');
});

test('AICoPilot MANUAL passes through raw input', () => {
  const copilot = new AICoPilot('MANUAL');
  const input = { pitch: 0.8, roll: 0.6, yaw: 0.4, throttle: 0.9 };
  const out = copilot.processInput(input, baseState, [], {});

  assert.equal(out.overrideActive, false);
  assert.equal(out.smoothedInput.pitch, input.pitch);
  assert.equal(out.smoothedInput.roll, input.roll);
});

test('FXKAssistant retorna mensagens não intrusivas de estado com orb visuals', () => {
  const assistant = new FXKAssistant();
  assistant.setVoiceEnabled(true);

  const out = assistant.update({ mode: 'CINEMATIC', riskDetected: false, signalQuality: 0.9, windMps: 3, dropComing: true });
  assert.equal(out.state, 'CINEMATIC');
  assert.match(out.hudMessage, /cinematic/i);
  assert.equal(typeof out.voiceMessage, 'string');
  assert.equal(typeof out.orbColor, 'string');
  assert.equal(typeof out.orbOpacity, 'number');
});

test('FXKAssistant GUIDING state for high wind', () => {
  const assistant = new FXKAssistant();
  const out = assistant.update({ mode: 'TRANSIT', riskDetected: false, signalQuality: 0.9, windMps: 12, dropComing: false });
  assert.equal(out.state, 'GUIDING');
  assert.match(out.hudMessage, /wind/i);
});

test('FXKAssistant ALERT takes priority over everything', () => {
  const assistant = new FXKAssistant();
  const out = assistant.update({ mode: 'CINEMATIC', riskDetected: true, signalQuality: 0.2, windMps: 15, dropComing: true });
  assert.equal(out.state, 'ALERT');
  assert.match(out.hudMessage, /risk/i);
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

// ═══ Edge case tests ═══

test('EDGE: Battery critical + obstacle simultaneously', () => {
  const engine = new AIDecisionEngine();
  const out = engine.computeSafeTrajectory(
    { ...baseState, batteryPct: 5, position: { x: 0, y: 0, z: 10 } },
    [{ id: 'wall', position: { x: 1, y: 0, z: 10 }, radius: 2 }],
    { mode: 'TRANSIT', target: { x: 20, y: 0, z: 10 } },
  );

  assert.equal(out.riskDetected, true);
  const types = out.adjustments.map(a => a.type);
  assert.ok(types.includes('battery'), 'should detect battery risk');
  assert.ok(types.includes('obstacle'), 'should detect obstacle risk');
  assert.ok(out.safeTrajectory[1].z > 10, 'midpoint should be elevated to avoid obstacle');
});

test('EDGE: Signal lost during CINEMATIC mode', () => {
  const copilot = new AICoPilot('CINEMATIC');
  const out = copilot.processInput(
    { pitch: 0.5, roll: 0.3, yaw: 0.2, throttle: 0.7 },
    { ...baseState, signalQuality: 0.1 },
    [],
    { mode: 'CINEMATIC' },
  );

  assert.equal(out.overrideActive, true, 'should override in CINEMATIC when signal is lost');
  assert.ok(out.decision.riskDetected, 'decision should detect signal risk');
  assert.ok(out.decision.adjustments.some(a => a.type === 'signal'), 'should have signal adjustment');
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
  const obsAdj = out.adjustments.filter(a => a.type === 'obstacle');
  assert.ok(obsAdj.length >= 2, `should detect multiple obstacles, found ${obsAdj.length}`);
});

test('EDGE: Below minimum altitude forces throttle override', () => {
  const copilot = new AICoPilot('ASSISTED');
  const out = copilot.processInput(
    { pitch: 0.3, roll: 0.2, yaw: 0.1, throttle: 0.3 },
    { ...baseState, position: { x: 0, y: 0, z: 1 } },
    [],
    { mode: 'TRANSIT' },
  );

  assert.equal(out.overrideActive, true);
  assert.ok(out.smoothedInput.throttle >= 0.8, 'throttle should be forced up for altitude correction');
});

test('EDGE: All risks simultaneously (battery + signal + altitude + obstacle)', () => {
  const engine = new AIDecisionEngine();
  const out = engine.computeSafeTrajectory(
    { ...baseState, batteryPct: 3, signalQuality: 0.1, position: { x: 0, y: 0, z: 1 } },
    [{ id: 'tower', position: { x: 0.5, y: 0, z: 1 }, radius: 1 }],
    { mode: 'HOLD_FRAME' },
  );

  assert.equal(out.riskDetected, true);
  const types = out.adjustments.map(a => a.type);
  assert.ok(types.includes('altitude'), 'altitude risk');
  assert.ok(types.includes('battery'), 'battery risk');
  assert.ok(types.includes('signal'), 'signal risk');
  assert.ok(types.includes('obstacle'), 'obstacle risk');
  assert.equal(out.assistantHint, 'evasion', 'hint should be evasion when risk detected');
});

test('EDGE: FXKAssistant signal degraded appended to non-IDLE state', () => {
  const assistant = new FXKAssistant();
  const out = assistant.update({ mode: 'CINEMATIC', riskDetected: false, signalQuality: 0.3, windMps: 3, dropComing: true });
  assert.equal(out.state, 'CINEMATIC');
  assert.match(out.hudMessage, /signal degraded/i, 'should append signal warning');
});

test('EDGE: getMode returns current mode', () => {
  const copilot = new AICoPilot('AI_CONTROL');
  assert.equal(copilot.getMode(), 'AI_CONTROL');
  copilot.setMode('MANUAL');
  assert.equal(copilot.getMode(), 'MANUAL');
});

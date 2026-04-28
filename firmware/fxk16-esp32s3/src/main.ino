// ─── FXK16 — ESP32-S3 v1.3 firmware entrypoint ────────────────────
// Boot order is SAFETY-CRITICAL:
//   1. Drive all 16 relay pins to OPEN (HIGH).
//   2. Configure ESTOP/jumper inputs.
//   3. Bring up USB-CDC + BLE.
//   4. Enable hardware watchdog.
#include <Arduino.h>
#include <NimBLEDevice.h>
#include <esp_mac.h>
#include <esp_task_wdt.h>

#include "fxk16_config.h"
#include "fxk16_relay.h"
#include "fxk16_protocol.h"

// ── BLE UART (matches FireOneHardwareBridge UUIDs) ────────────────
static const char* SVC_UUID  = "0000ffe0-0000-1000-8000-00805f9b34fb";
static const char* CHAR_TX   = "0000ffe1-0000-1000-8000-00805f9b34fb"; // host -> module (write)
static const char* CHAR_RX   = "0000ffe2-0000-1000-8000-00805f9b34fb"; // module -> host (notify)

static NimBLECharacteristic* g_bleRx = nullptr;
static volatile bool          g_bleConnected = false;

// ── Response sinks ────────────────────────────────────────────────
static void sinkSerial(const char* line) {
  Serial.print(line);
  Serial.print('\n');
}
static void sinkBle(const char* line) {
  if (!g_bleRx || !g_bleConnected) return;
  char out[128];
  size_t n = snprintf(out, sizeof(out), "%s\n", line);
  g_bleRx->setValue((uint8_t*)out, n);
  g_bleRx->notify();
}
static void sinkBoth(const char* line) {
  sinkSerial(line);
  sinkBle(line);
}

class TxCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* c, NimBLEConnInfo&) override {
    std::string v = c->getValue();
    for (char ch : v) fxk16::protocolFeedByte((uint8_t)ch, sinkBoth);
  }
};

// Identification banner emitted on every fresh link-up (USB-CDC boot and
// each BLE connect). Single-line, semicolon-separated tokens — parsed by
// FireOneHardwareBridge so the app recognizes the module as FXK16 (16ch)
// before the host even sends its first VERSION/STATUS query.
static void emitIdentifyBanner(void (*sink)(const char*)) {
  char line[96];
  snprintf(line, sizeof(line),
           "MODEL:%s;CH:%u;FW:%s;ID:%s",
           FXK16_MODEL, (unsigned)FXK16_CHANNELS,
           FXK16_FW_VERSION, FXK16_MODEL);
  sink(line);
}

class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer*, NimBLEConnInfo&) override {
    g_bleConnected = true;
    // Push identification immediately so the app's handshake captures
    // MODEL/CH on the first frame, regardless of which command it sends.
    emitIdentifyBanner(sinkBle);
  }
  void onDisconnect(NimBLEServer*, NimBLEConnInfo&, int) override { g_bleConnected = false;
    NimBLEDevice::startAdvertising();
  }
};

static void bleInit() {
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_BT);
  char name[24];
  snprintf(name, sizeof(name), "%s-%02X%02X%02X",
           FXK16_BLE_NAME_PREFIX, mac[3], mac[4], mac[5]);

  NimBLEDevice::init(name);
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);
  auto* server = NimBLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  auto* svc = server->createService(SVC_UUID);
  auto* tx  = svc->createCharacteristic(CHAR_TX, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  tx->setCallbacks(new TxCallbacks());
  g_bleRx = svc->createCharacteristic(CHAR_RX, NIMBLE_PROPERTY::NOTIFY | NIMBLE_PROPERTY::READ);
  svc->start();

  auto* adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(SVC_UUID);
  adv->setName(name);
  adv->start();
}

void setup() {
  // 1. SAFETY FIRST — relays open before anything else.
  fxk16::relayInit();

  // 2. Inputs
  pinMode(ESTOP_BUTTON_PIN,    INPUT_PULLUP);
  pinMode(UNSAFE_GPIO_JUMPER,  INPUT_PULLUP);
  pinMode(LED_HEARTBEAT_PIN,   OUTPUT);
  digitalWrite(LED_HEARTBEAT_PIN, LOW);

  // 3. Transports
  Serial.begin(115200);
  // do not block on Serial — host may not be attached yet
  bleInit();

  // 4. Watchdog
  const esp_task_wdt_config_t wdtConfig = {
    .timeout_ms = WATCHDOG_TIMEOUT_S * 1000,
    .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
    .trigger_panic = true,
  };
  esp_task_wdt_init(&wdtConfig);
  esp_task_wdt_add(NULL);

  // 5. Boot banner — host's USB-CDC may not be open yet, but as soon as it
  //    attaches the buffered line will arrive and identify the module. Cheap
  //    and idempotent: even if the host misses it, the explicit handshake
  //    (`VERSION`) replies with the same MODEL/CH tokens.
  emitIdentifyBanner(sinkSerial);

  // 6. Optional boot self-test (bench bring-up only).
  //    Compile-time flag + physical jumper + ESTOP-clear. See fxk16_config.h.
#ifdef FXK16_BOOT_SELFTEST
  runBootSelfTest();
#endif
}

#ifdef FXK16_BOOT_SELFTEST
// Sequentially pulses C1..C16 for FXK16_SELFTEST_PULSE_MS each, with a
// FXK16_SELFTEST_GAP_MS quiet window between channels. Aborts immediately
// if ESTOP latches mid-sweep. Watchdog is fed each iteration.
//
// REFUSAL CONDITIONS (logged, then return without firing):
//   - ESTOP button already held LOW at boot
//   - UNSAFE_GPIO_JUMPER not shorted to GND (no physical authorization)
//
// This keeps a deployed unit from auto-firing if the flag was accidentally
// left in the build. Bench operators short the jumper before powering on.
static void runBootSelfTest() {
  if (digitalRead(ESTOP_BUTTON_PIN) == LOW) {
    sinkSerial("SELFTEST:SKIP:ESTOP_HELD");
    return;
  }
  if (digitalRead(UNSAFE_GPIO_JUMPER) != LOW) {
    sinkSerial("SELFTEST:SKIP:NO_JUMPER");
    return;
  }

  char line[48];
  snprintf(line, sizeof(line),
           "SELFTEST:START:CH=%u:PULSE=%ums",
           (unsigned)FXK16_CHANNELS, (unsigned)FXK16_SELFTEST_PULSE_MS);
  sinkSerial(line);

  for (uint8_t ch = 1; ch <= FXK16_CHANNELS; ++ch) {
    if (fxk16::isEstopLatched() || digitalRead(ESTOP_BUTTON_PIN) == LOW) {
      sinkSerial("SELFTEST:ABORT:ESTOP");
      return;
    }
    const char* err = nullptr;
    const bool ok = fxk16::firePin(ch, FXK16_SELFTEST_PULSE_MS, &err);
    snprintf(line, sizeof(line),
             "SELFTEST:CH:%u:%s", (unsigned)ch, ok ? "OK" : (err ? err : "ERR"));
    sinkSerial(line);

    // Wait pulse + gap with the timer service running so the relay
    // auto-opens exactly at FXK16_SELFTEST_PULSE_MS.
    const uint32_t until = millis() + FXK16_SELFTEST_PULSE_MS + FXK16_SELFTEST_GAP_MS;
    while ((int32_t)(millis() - until) < 0) {
      fxk16::serviceTimers();
      esp_task_wdt_reset();
      delay(1);
    }
  }
  sinkSerial("SELFTEST:DONE");
}
#endif  // FXK16_BOOT_SELFTEST

void loop() {
  esp_task_wdt_reset();

  // Hardware ESTOP button (active LOW)
  if (digitalRead(ESTOP_BUTTON_PIN) == LOW && !fxk16::isEstopLatched()) {
    fxk16::estopLatch();
    sinkBoth("OK:ESTOP");
  }

  // Drain USB-CDC
  while (Serial.available() > 0) {
    fxk16::protocolFeedByte((uint8_t)Serial.read(), sinkBoth);
  }

  // Auto-open expired pulses (independent of host parser)
  fxk16::serviceTimers();

  // Heartbeat LED
  static uint32_t lastBlink = 0;
  const uint32_t now = millis();
  if (now - lastBlink >= HEARTBEAT_BLINK_MS) {
    lastBlink = now;
    digitalWrite(LED_HEARTBEAT_PIN, !digitalRead(LED_HEARTBEAT_PIN));
  }

  // Yield to BLE / Wi-Fi tasks
  delay(1);
}

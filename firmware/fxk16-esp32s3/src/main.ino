// ─── FXK16 — ESP32-S3 v1.3 firmware entrypoint ────────────────────
// Boot order is SAFETY-CRITICAL:
//   1. Drive all 16 relay pins to OPEN (HIGH).
//   2. Configure ESTOP/jumper inputs.
//   3. Bring up USB-CDC + BLE.
//   4. Enable hardware watchdog.
#include <Arduino.h>
#include <NimBLEDevice.h>
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
  void onWrite(NimBLECharacteristic* c) override {
    std::string v = c->getValue();
    for (char ch : v) fxk16::protocolFeedByte((uint8_t)ch, sinkBoth);
  }
};

class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer*)    override { g_bleConnected = true;  }
  void onDisconnect(NimBLEServer*) override { g_bleConnected = false;
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
  adv->setScanResponse(true);
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
  esp_task_wdt_init(WATCHDOG_TIMEOUT_S, true);
  esp_task_wdt_add(NULL);
}

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

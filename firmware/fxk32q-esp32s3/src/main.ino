// ─── FXK32Q — ESP32-S3 firmware entrypoint (32 canais) ──────────
// Ordem de boot SAFETY-CRITICAL:
//   1. Dirige todos os 32 relés para OPEN (HIGH).
//   2. Configura ESTOP / jumper.
//   3. Sobe transportes: USB-CDC, BLE NimBLE, Wi-Fi STA+AP, Art-Net, RS-485.
//   4. Habilita watchdog.
#include <Arduino.h>
#include <NimBLEDevice.h>
#include <esp_mac.h>
#include <esp_task_wdt.h>
#include <WiFi.h>

#include "fxk32q_config.h"
#include "fxk32q_relay.h"
#include "fxk32q_protocol.h"
#include "fxk32q_rs485.h"
#include "fxk32q_artnet.h"

// ── BLE UART (mesmas UUIDs do FXK16 — handshake genérico) ────────
static const char* SVC_UUID  = "0000ffe0-0000-1000-8000-00805f9b34fb";
static const char* CHAR_TX   = "0000ffe1-0000-1000-8000-00805f9b34fb";
static const char* CHAR_RX   = "0000ffe2-0000-1000-8000-00805f9b34fb";

static NimBLECharacteristic* g_bleRx = nullptr;
static volatile bool          g_bleConnected = false;

static void sinkSerial(const char* line) {
  Serial.print(line);
  Serial.print('\n');
}
static void sinkBle(const char* line) {
  if (!g_bleRx || !g_bleConnected) return;
  char out[160];
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
    for (char ch : v) fxk32q::protocolFeedByte((uint8_t)ch, sinkBoth);
  }
};

static void emitIdentifyBanner(void (*sink)(const char*)) {
  char line[120];
  snprintf(line, sizeof(line),
           "MODEL:%s;CH:%u;FW:%s;ID:%s",
           FXK32Q_MODEL, (unsigned)FXK32Q_CHANNELS,
           FXK32Q_FW_VERSION, FXK32Q_MODEL);
  sink(line);
}

class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer*, NimBLEConnInfo&) override {
    g_bleConnected = true;
    emitIdentifyBanner(sinkBle);
  }
  void onDisconnect(NimBLEServer*, NimBLEConnInfo&, int) override {
    g_bleConnected = false;
    NimBLEDevice::startAdvertising();
  }
};

static void bleInit() {
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_BT);
  char name[24];
  snprintf(name, sizeof(name), "%s-%02X%02X%02X",
           FXK32Q_BLE_NAME_PREFIX, mac[3], mac[4], mac[5]);

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

// Wi-Fi modo AP de fábrica para configuração inicial; o operador
// promove para STA via portal embutido (fora do escopo desta v1.0).
static void wifiInit() {
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  char ssid[24];
  snprintf(ssid, sizeof(ssid), "FXK32Q-%02X%02X%02X", mac[3], mac[4], mac[5]);
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ssid);  // open SSID — ambiente de bench/preflight
  fxk32q::artnetInit();
}

void setup() {
  // 1. SAFETY FIRST — relés abertos antes de qualquer outra coisa.
  fxk32q::relayInit();

  // 2. Inputs
  pinMode(ESTOP_BUTTON_PIN,    INPUT_PULLUP);
  pinMode(UNSAFE_GPIO_JUMPER,  INPUT_PULLUP);

  // 3. Transportes
  Serial.begin(115200);
  bleInit();
  wifiInit();
  fxk32q::rs485Init();

  // 4. Watchdog
  const esp_task_wdt_config_t wdtConfig = {
    .timeout_ms = WATCHDOG_TIMEOUT_S * 1000,
    .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
    .trigger_panic = true,
  };
  esp_task_wdt_init(&wdtConfig);
  esp_task_wdt_add(NULL);

  emitIdentifyBanner(sinkSerial);
}

void loop() {
  esp_task_wdt_reset();

  // ESTOP físico (active LOW)
  if (digitalRead(ESTOP_BUTTON_PIN) == LOW && !fxk32q::isEstopLatched()) {
    fxk32q::estopLatch();
    sinkBoth("OK:ESTOP:HW");
  }

  // USB-CDC
  while (Serial.available()) {
    fxk32q::protocolFeedByte((uint8_t)Serial.read(), sinkBoth);
  }

  // RS-485 FireOne XLII+ slave
  fxk32q::rs485Service();

  // Art-Net / sACN
  fxk32q::artnetService();

  // Auto-open de pulsos expirados
  fxk32q::serviceTimers();
}

/**
 * MineGuard ESP32 Smart Helmet Firmware v2.2
 * --------------------------------------------------
 * Sensors supported:
 *   - DHT11     : Temperature & Humidity  (Pin 4)
 *   - MQ-2      : Combustible Gas          (Pin 34 ADC)
 *   - MQ-5      : LPG/Methane Gas          (Pin 35 ADC)
 *   - MAX30102  : Heart Rate & SpO2 (HW827)(I2C SDA=21, SCL=22)
 *   - BMP280    : Atmospheric Pressure     (I2C SDA=21, SCL=22)
 *   - LDR       : Ambient Light             (Pin 32 ADC)
 *   - SOS button: Emergency               (Pin 27, INPUT_PULLUP)
 *   - BUZZER    : Audio Alert              (Pin 25)
 *
 * Required Arduino Libraries (install via Library Manager):
 *   - "DHT sensor library" by Adafruit
 *   - "Adafruit Unified Sensor" by Adafruit
 *   - "Adafruit BMP280 Library" by Adafruit
 *   - "SparkFun MAX3010x Pulse and Proximity Sensor Library" by SparkFun
 *   - "ArduinoJson" by Benoit Blanchon
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <Adafruit_BMP280.h>     // BMP280 atmospheric pressure sensor
#include "MAX30105.h"        // SparkFun MAX3010x (supports MAX30102 / HW827)
#include "heartRate.h"       // SparkFun BPM algorithm
#include "spo2_algorithm.h"  // SparkFun SpO2 algorithm

// ==================== USER CONFIGURATION ====================
const char* WIFI_SSID      = "Shweta";
const char* WIFI_PASSWORD  = "12345678";

// IMPORTANT: Set this to your laptop IP (run `ipconfig` on Windows, look for WiFi IPv4)
const char* SERVER_URL     = "http://10.222.97.63:5000/api/readings";
const char* DEVICE_API_KEY = "mineguard_device_secret_key_2026";

const char* WORKER_ID  = "W006";
const char* HELMET_ID  = "H-ESP32-LIVE";

// ==================== PIN DEFINITIONS =======================
#define DHTPIN       4
#define DHTTYPE      DHT11
#define MQ2_PIN      34
#define MQ5_PIN      35
#define LDR_PIN      32
#define SOS_PIN      27
#define BUZZER_PIN   25

// ==================== TIMING ================================
#define DHT_INTERVAL_MS     2500UL   // DHT11 MUST have >= 2s between reads
#define POST_INTERVAL_MS   10000UL   // Normal telemetry: every 10 seconds
#define BUFFER_LENGTH        100     // MAX30102 SpO2 algorithm buffer size

// ==================== GLOBALS ==============================
DHT      dht(DHTPIN, DHTTYPE);
MAX30105 particleSensor;
Adafruit_BMP280 bmp;    // BMP280 pressure sensor (shared I2C bus)

unsigned long lastPostMs    = 0;
unsigned long lastDhtMs     = 0;
bool          sosTriggered  = false;
bool          max30102OK    = false;
bool          bmp280OK      = false;

float cachedTemp = NAN;
float cachedHum  = NAN;

uint32_t irBuf[BUFFER_LENGTH];
uint32_t redBuf[BUFFER_LENGTH];
int32_t  spo2Val    = -1;
int8_t   spo2Valid  =  0;
int32_t  hrVal      = -1;
int8_t   hrValid    =  0;

struct SensorData {
  float temp, hum;
  int mq2_raw, mq2_mv;
  int mq5_raw, mq5_mv;
  int ldr_raw;
  int heart_rate, spo2;
  float pressure;          // hPa from BMP280
  int battery, rssi;
  bool sos, fall;
} sensor;

// ==================== ISR ==================================
void IRAM_ATTR onSosPress() { sosTriggered = true; }

// ==================== SETUP ================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n[MineGuard] Booting v2.1...");

  pinMode(SOS_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  attachInterrupt(digitalPinToInterrupt(SOS_PIN), onSosPress, FALLING);

  // DHT11
  dht.begin();
  Serial.println("[DHT11] Initialized on Pin " + String(DHTPIN));

  // MAX30102 / HW827
  Serial.println("[MAX30102] Initializing...");
  if (particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    particleSensor.setup(60, 4, 2, 100, 411, 4096);
    particleSensor.setPulseAmplitudeRed(0x0A);
    particleSensor.setPulseAmplitudeGreen(0);
    max30102OK = true;
    Serial.println("[MAX30102] Found! Filling buffer...");
    for (int i = 0; i < BUFFER_LENGTH; i++) {
      while (!particleSensor.available()) particleSensor.check();
      redBuf[i] = particleSensor.getRed();
      irBuf[i]  = particleSensor.getIR();
      particleSensor.nextSample();
    }
    maxim_heart_rate_and_oxygen_saturation(irBuf, BUFFER_LENGTH, redBuf,
      &spo2Val, &spo2Valid, &hrVal, &hrValid);
    Serial.println("[MAX30102] Buffer ready. SpO2 and HR streaming.");
  } else {
    Serial.println("[MAX30102] NOT FOUND. Wiring: SDA->GPIO21, SCL->GPIO22, VCC->3.3V");
    Serial.println("[MAX30102] HR & SpO2 will report -1 until sensor is connected.");
    max30102OK = false;
  }

  // BMP280 Atmospheric Pressure Sensor
  Serial.println("[BMP280] Initializing atmospheric pressure sensor...");
  if (bmp.begin(0x76) || bmp.begin(0x77)) {
    bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,
                   Adafruit_BMP280::SAMPLING_X2,
                   Adafruit_BMP280::SAMPLING_X16,
                   Adafruit_BMP280::FILTER_X16,
                   Adafruit_BMP280::STANDBY_MS_500);
    bmp280OK = true;
    Serial.printf("[BMP280] Found! Pressure: %.1f hPa\n", bmp.readPressure() / 100.0F);
  } else {
    Serial.println("[BMP280] NOT FOUND. Wiring: SDA->GPIO21, SCL->GPIO22, VCC->3.3V");
    Serial.println("[BMP280] Pressure will show as 0 (not connected).");
    bmp280OK = false;
  }

  // LDR
  Serial.println("[LDR] Enabled on Pin " + String(LDR_PIN));

  connectWiFi();

  // Double-beep = ready
  for (int i = 0; i < 2; i++) {
    digitalWrite(BUZZER_PIN, HIGH); delay(120);
    digitalWrite(BUZZER_PIN, LOW);  delay(100);
  }
  Serial.println("[MineGuard] Ready. Streaming every 10s.\n");
}

// ==================== MAIN LOOP ============================
void loop() {
  unsigned long now = millis();

  // DHT11: read every 2.5s minimum
  if (now - lastDhtMs >= DHT_INTERVAL_MS) {
    readDHT();
    lastDhtMs = now;
  }

  // MAX30102: sliding window update
  if (max30102OK) updateMAX30102();

  // Fast sensors: MQ-2, MQ-5, LDR, SOS, battery, RSSI
  readFastSensors();

  // Local buzzer (works even without WiFi)
  checkBuzzer();

  // HTTP POST on SOS or every 10s
  bool doPost = sensor.sos || sosTriggered || (now - lastPostMs >= POST_INTERVAL_MS);
  if (doPost) {
    if (sensor.sos || sosTriggered) {
      sensor.sos = true;
      Serial.println("\n[SOS] !!! IMMEDIATE SOS DISPATCH !!!");
    }
    String payload = buildJson();
    sendToServer(payload);
    lastPostMs   = millis();
    sosTriggered = false;
    sensor.sos   = false;
  }

  delay(50);
}

// ==================== WiFi =================================
void connectWiFi() {
  Serial.print("[WiFi] Connecting to "); Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries++ < 30) {
    delay(500); Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
    Serial.println("[WiFi] ** Make sure SERVER_URL uses this laptop IP **");
  } else {
    Serial.println("\n[WiFi] TIMEOUT. Offline mode: buzzer alerts still active.");
  }
}

// ==================== DHT11 ================================
void readDHT() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (isnan(t) || isnan(h)) {
    Serial.println("[DHT11] Read FAILED (NaN). Possible causes:");
    Serial.println("         1. Reads too fast - firmware now uses 2.5s interval");
    Serial.println("         2. Missing 10K pull-up resistor on data pin");
    Serial.println("         3. Faulty sensor or loose connection");
    if (!isnan(cachedTemp)) { // Keep last valid reading
      sensor.temp = cachedTemp;
      sensor.hum  = cachedHum;
    } else {
      sensor.temp = -999.0f;
      sensor.hum  = -999.0f;
    }
  } else {
    cachedTemp  = t;
    cachedHum   = h;
    sensor.temp = t;
    sensor.hum  = h;
    Serial.printf("[DHT11] Temp=%.1f C  Hum=%.1f%%\n", t, h);
  }
}

// ==================== MAX30102 =============================
void updateMAX30102() {
  // Slide the window: drop first 25, collect 25 new samples
  for (byte i = 25; i < BUFFER_LENGTH; i++) {
    redBuf[i - 25] = redBuf[i];
    irBuf[i - 25]  = irBuf[i];
  }
  byte n = 0;
  while (n < 25) {
    while (!particleSensor.available()) { particleSensor.check(); delay(1); }
    redBuf[75 + n] = particleSensor.getRed();
    irBuf[75 + n]  = particleSensor.getIR();
    particleSensor.nextSample();
    n++;
  }
  maxim_heart_rate_and_oxygen_saturation(irBuf, BUFFER_LENGTH, redBuf,
    &spo2Val, &spo2Valid, &hrVal, &hrValid);

  sensor.heart_rate = (hrValid  && hrVal  >= 40 && hrVal  <= 220) ? (int)hrVal  : -1;
  sensor.spo2       = (spo2Valid && spo2Val >= 70 && spo2Val <= 100) ? (int)spo2Val : -1;

  if (hrValid && spo2Valid) {
    Serial.printf("[MAX30102] HR=%d BPM  SpO2=%d%%\n", sensor.heart_rate, sensor.spo2);
  }
}

// ==================== FAST SENSORS =========================
void readFastSensors() {
  sensor.mq2_raw = analogRead(MQ2_PIN);
  sensor.mq2_mv  = analogReadMilliVolts(MQ2_PIN);
  sensor.mq5_raw = analogRead(MQ5_PIN);
  sensor.mq5_mv  = analogReadMilliVolts(MQ5_PIN);
  sensor.ldr_raw = analogRead(LDR_PIN);
  sensor.sos     = (digitalRead(SOS_PIN) == LOW) || sosTriggered;
  sensor.fall    = false;
  sensor.battery = 85; // TODO: Replace with real ADC battery voltage divider reading
  sensor.rssi    = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : -99;

  if (!max30102OK) { sensor.heart_rate = -1; sensor.spo2 = -1; }

  // BMP280 Atmospheric Pressure
  if (bmp280OK) {
    sensor.pressure = bmp.readPressure() / 100.0F; // Pa -> hPa
    Serial.printf("[BMP280] Pressure: %.1f hPa\n", sensor.pressure);
  } else {
    sensor.pressure = 0.0f;
  }
}

// ==================== BUZZER ==============================
void checkBuzzer() {
  bool buzz = sensor.sos || sosTriggered
           || sensor.mq2_mv >= 2500
           || sensor.mq5_mv >= 2500
           || (sensor.spo2 > 0 && sensor.spo2 < 90);
  digitalWrite(BUZZER_PIN, buzz ? HIGH : LOW);
}

// ==================== BUILD JSON ==========================
String buildJson() {
  StaticJsonDocument<640> doc;
  doc["worker_id"]  = WORKER_ID;
  doc["helmet_id"]  = HELMET_ID;

  if (sensor.temp > -900) doc["temperature"] = sensor.temp;
  if (sensor.hum  > -900) doc["humidity"]    = sensor.hum;

  doc["mq2_mv"]  = sensor.mq2_mv;
  doc["mq5_mv"]  = sensor.mq5_mv;
  doc["mq2_raw"] = sensor.mq2_raw;
  doc["mq5_raw"] = sensor.mq5_raw;
  doc["ldr_raw"] = sensor.ldr_raw;

  doc["sos"]           = sensor.sos;
  doc["fall"]          = sensor.fall;
  doc["battery"]       = sensor.battery;
  doc["communication"] = "wifi";
  doc["gateway_id"]    = "direct";
  doc["rssi"]          = sensor.rssi;

  if (sensor.heart_rate > 0) doc["heart_rate"] = sensor.heart_rate;
  if (sensor.spo2       > 0) doc["spo2"]       = sensor.spo2;
  if (sensor.pressure   > 0) doc["pressure"]   = sensor.pressure;

  String out;
  serializeJson(doc, out);
  Serial.println("[JSON] " + out);
  return out;
}

// ==================== HTTP POST ===========================
void sendToServer(String payload) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Reconnecting WiFi...");
    WiFi.reconnect();
    unsigned long t0 = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t0 < 5000) delay(200);
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[HTTP] Still offline. Skipping POST (local alert active).");
      return;
    }
  }

  WiFiClient client;
  HTTPClient http;
  http.begin(client, SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", DEVICE_API_KEY);
  http.setTimeout(8000);

  int code = http.POST(payload);
  if (code > 0) {
    Serial.printf("[HTTP] Response: %d %s\n", code, code == 201 ? "(OK - data accepted)" : "");
  } else {
    Serial.printf("[HTTP] Failed: %s\n", http.errorToString(code).c_str());
    Serial.println("[HTTP] Tip: Run `ipconfig` on laptop, update SERVER_URL with WiFi IP");
  }
  http.end();
}

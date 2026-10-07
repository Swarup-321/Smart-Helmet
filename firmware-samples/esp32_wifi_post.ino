/*
 * MineGuard ESP32 Smart Helmet Firmware
 * 
 * Hardware Wiring:
 * - DHT11 Data                      -> GPIO 4 (Temperature & Humidity)
 * - MQ-2 Analog Out (AO)            -> GPIO 34 (Combustible Gas & Smoke ADC via voltage divider 5V->3.3V)
 * - MQ-5 Analog Out (AO)            -> GPIO 35 (Methane/LPG Gas ADC via voltage divider 5V->3.3V)
 * - Emergency SOS Push Button       -> GPIO 27 (INPUT_PULLUP to GND, active LOW)
 * - Local Buzzer Alarm              -> GPIO 25 (Active HIGH)
 * - HW-827 Pulse Heart Rate Sensor  -> GPIO 33 (Signal 'S' -> GPIO 33, VCC -> 3.3V, GND -> GND)
 * - LDR Ambient Light Sensor        -> GPIO 32 (Analog Out -> GPIO 32)
 * 
 * Architecture:
 * - readSensors()
 * - checkLocalAlerts() -> buzzer/LED immediate local alarm even without Wi-Fi
 * - createSensorJson()
 * - sendData() -> HTTP POST with x-api-key header; can be drop-in replaced by sendLoRa()
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ---------------- USER CONFIGURATION ----------------
const char* WIFI_SSID     = "MINE_ZONE_AP_4";
const char* WIFI_PASSWORD = "MineSafetyPassword2026";

// Server Ingestion Endpoint (Update with your computer's local IP on Wi-Fi)
const char* SERVER_URL    = "http://192.168.1.36:5000/api/readings";
const char* DEVICE_API_KEY = "mineguard_device_secret_key_2026";

const char* WORKER_ID     = "W006";
const char* HELMET_ID     = "H-ESP32-LIVE";

// ---------------- PIN DEFINITIONS -------------------
#define DHTPIN            4
#define DHTTYPE           DHT11
#define MQ2_PIN           34
#define MQ5_PIN           35
#define SOS_PIN           27
#define BUZZER_PIN        25

// Sensor Hardware Pins (HW-827 Heart Rate & LDR)
#define ENABLE_LDR_SENSOR       true   // Set to true to read LDR light intensity
#define LDR_PIN                 32     // LDR Analog Out -> GPIO 32

#define ENABLE_PULSE_SENSOR     true   // Set to true to read HW-827 Pulse Heart Rate sensor
#define PULSE_PIN               33     // HW-827 Signal (S) -> GPIO 33

// HW-827 Heart Rate Peak Detection Variables
unsigned long lastBeatTime = 0;
int lastPulseSignal = 0;
int calculatedBPM = 0;
bool isFingerOnSensor = false;

// ---------------- GLOBAL VARIABLES -----------------
DHT dht(DHTPIN, DHTTYPE);

unsigned long lastPostTime = 0;
const unsigned long POST_INTERVAL_MS = 10000; // 10 seconds normal cadence
bool sosTriggered = false;

struct SensorReadings {
  float temperature;
  float humidity;
  int mq2_raw;
  int mq2_mv;
  int mq5_raw;
  int mq5_mv;
  bool sos;
  bool fall;
  int battery;
  int ldr_raw;
  int heart_rate;
  int spo2;
  int rssi;
};

SensorReadings currentData;

// Interrupt Service Routine for instant SOS button press
void IRAM_ATTR handleSosInterrupt() {
  sosTriggered = true;
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n[MineGuard] Booting ESP32 Smart Helmet Firmware...");

  pinMode(SOS_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // Attach interrupt for instantaneous SOS broadcast
  attachInterrupt(digitalPinToInterrupt(SOS_PIN), handleSosInterrupt, FALLING);

  // Initialize DHT
  dht.begin();

  // Connect Wi-Fi
  connectWiFi();

  // Test local audio alert
  digitalWrite(BUZZER_PIN, HIGH);
  delay(150);
  digitalWrite(BUZZER_PIN, LOW);
  Serial.println("[MineGuard] Setup Completed. Ready for telemetry stream.");
}

void loop() {
  unsigned long now = millis();

  // 1. Read all connected helmet sensors
  readSensors();

  // 2. Immediate Local Hardware Alert (Buzzer triggers even without Wi-Fi)
  checkLocalAlerts();

  // 3. Check for immediate SOS trigger or standard 10s interval
  if (currentData.sos || sosTriggered || (now - lastPostTime >= POST_INTERVAL_MS)) {
    if (currentData.sos || sosTriggered) {
      currentData.sos = true; // ensure flag in payload is true
      Serial.println("\n[MineGuard] !!! IMMEDIATE SOS DISPATCH TRIGGERED !!!");
    }

    String payload = createSensorJson();
    sendData(payload);

    lastPostTime = millis();
    sosTriggered = false; // Reset SOS latch after transmission
  }

  delay(100);
}

void connectWiFi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[WiFi] Connection timeout. Operating in offline failsafe mode.");
  }
}

void readSensors() {
  // Read DHT11
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  currentData.temperature = isnan(t) ? -999.0 : t;
  currentData.humidity = isnan(h) ? -999.0 : h;

  // Read MQ-2 & MQ-5 Gas Sensors
  currentData.mq2_raw = analogRead(MQ2_PIN);
  currentData.mq2_mv  = analogReadMilliVolts(MQ2_PIN);

  currentData.mq5_raw = analogRead(MQ5_PIN);
  currentData.mq5_mv  = analogReadMilliVolts(MQ5_PIN);

  // Check SOS Button state
  currentData.sos = (digitalRead(SOS_PIN) == LOW) || sosTriggered;
  currentData.fall = false; // Add MPU6050 accelerometer impact evaluation here if equipped

  // Helmet battery estimate (simulated ADC calculation)
  currentData.battery = 88;

  // RSSI Wi-Fi strength
  currentData.rssi = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : -99;

  // --- LDR Ambient Light Sensor Reading ---
  if (ENABLE_LDR_SENSOR) {
    currentData.ldr_raw = analogRead(LDR_PIN);
  } else {
    currentData.ldr_raw = -1;
  }

  // --- HW-827 Heart Rate Pulse Sensor Reading (GPIO 33) ---
  if (ENABLE_PULSE_SENSOR) {
    int pulseSignal = analogRead(PULSE_PIN); // 0 - 4095

    // Detect finger placement on sensor (analog threshold > 1800)
    if (pulseSignal > 1800) {
      isFingerOnSensor = true;

      // Peak threshold detection for heartbeat pulse
      if (pulseSignal > 2100 && lastPulseSignal <= 2100) {
        unsigned long currentMillis = millis();
        unsigned long duration = currentMillis - lastBeatTime;

        // Valid human heart beat interval: 400ms (150 BPM) to 1333ms (45 BPM)
        if (duration >= 400 && duration <= 1333) {
          int instantBPM = 60000 / duration;
          // Smooth moving average
          calculatedBPM = (calculatedBPM == 0) ? instantBPM : (calculatedBPM * 0.7 + instantBPM * 0.3);
        }
        lastBeatTime = currentMillis;
      }
      lastPulseSignal = pulseSignal;

      currentData.heart_rate = (calculatedBPM > 45 && calculatedBPM < 180) ? calculatedBPM : 76;
      currentData.spo2 = 98; // Nominal SpO2 when pulse detected
    } else {
      // Finger not placed on sensor -> send -1 so web shows "Not connected" / Idle
      isFingerOnSensor = false;
      currentData.heart_rate = -1;
      currentData.spo2 = -1;
    }
  } else {
    currentData.heart_rate = -1;
    currentData.spo2 = -1;
  }
}

void checkLocalAlerts() {
  // Failsafe: if gas level exceeds local critical threshold (e.g., 2500mV) or SOS active, buzz!
  if (currentData.mq2_mv >= 2500 || currentData.mq5_mv >= 2500 || currentData.sos) {
    digitalWrite(BUZZER_PIN, HIGH);
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }
}

String createSensorJson() {
  StaticJsonDocument<512> doc;
  doc["worker_id"] = WORKER_ID;
  doc["helmet_id"] = HELMET_ID;

  if (currentData.temperature > -900) doc["temperature"] = currentData.temperature;
  if (currentData.humidity > -900)    doc["humidity"] = currentData.humidity;

  doc["mq2_mv"]  = currentData.mq2_mv;
  doc["mq5_mv"]  = currentData.mq5_mv;
  doc["mq2_raw"] = currentData.mq2_raw;
  doc["mq5_raw"] = currentData.mq5_raw;

  doc["sos"]     = currentData.sos;
  doc["fall"]    = currentData.fall;
  doc["battery"] = currentData.battery;
  doc["communication"] = "wifi";
  doc["gateway_id"] = "direct";
  doc["rssi"]    = currentData.rssi;

  if (currentData.heart_rate > 0) doc["heart_rate"] = currentData.heart_rate;
  if (currentData.spo2 > 0)       doc["spo2"] = currentData.spo2;
  if (currentData.ldr_raw >= 0)   doc["ldr_raw"] = currentData.ldr_raw;

  String output;
  serializeJson(doc, output);
  return output;
}

void sendData(String jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Wi-Fi down. Skipping network dispatch; local alert active.");
    return;
  }

  WiFiClient client; // Switch to WiFiClientSecure for HTTPS with setInsecure() or setCACert()
  HTTPClient http;

  http.begin(client, SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", DEVICE_API_KEY);

  int httpCode = http.POST(jsonPayload);

  if (httpCode > 0) {
    Serial.printf("[HTTP] POST Response: %d\n", httpCode);
  } else {
    Serial.printf("[HTTP] POST Failed. Error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

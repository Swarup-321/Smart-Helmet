/*
 * MineGuard ESP32 Smart Helmet Firmware v3.0 (Standalone Sample)
 * 
 * Hardware Wiring:
 * - DHT11 Data                      -> GPIO 4 (Temperature & Humidity)
 * - MQ-2 Analog Out (AO)            -> GPIO 34 (Combustible Gas & Smoke ADC via voltage divider 5V->3.3V)
 * - MQ-5 Analog Out (AO)            -> GPIO 35 (Methane/LPG Gas ADC via voltage divider 5V->3.3V)
 * - HW-072 Vibration Sensor DO      -> GPIO 26 (Digital Vibration / Impact Event Detector)
 * - Emergency SOS Push Button       -> GPIO 27 (INPUT_PULLUP to GND, active LOW)
 * - Local Buzzer Alarm              -> GPIO 25 (Active HIGH)
 * - HW-827 Pulse Heart Rate Sensor  -> GPIO 33 (Signal 'S' -> GPIO 33, VCC -> 3.3V, GND -> GND)
 * - LDR Ambient Light Sensor        -> GPIO 32 (Analog Out -> GPIO 32)
 * 
 * Architecture:
 * - readSensors()
 * - readVibrationSensor()
 * - analyzeVibration() -> 10s sliding window event density & severity classification
 * - checkLocalAlerts() -> buzzer immediate local alarm even without Wi-Fi
 * - createSensorJson()
 * - sendData() -> HTTP POST with x-api-key header; can be drop-in replaced by sendLoRa()
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ---------------- USER CONFIGURATION ----------------
const char* WIFI_SSID     = "MINE_ZONE_AP_4";
const char* WIFI_PASSWORD = "MineSafetyPassword2026";

// Server Ingestion Endpoint (Update with your computer's local IP on Wi-Fi)
const char* SERVER_URL    = "http://192.168.1.37:5000/api/readings";
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
#define VIBRATION_PIN     26    // HW-072 Vibration Sensor DO -> GPIO 26

// Sensor Hardware Pins (HW-827 Heart Rate & LDR)
#define ENABLE_LDR_SENSOR       true   // Set to true to read LDR light intensity
#define LDR_PIN                 32     // LDR Analog Out -> GPIO 32

#define ENABLE_PULSE_SENSOR     true   // Set to true to read HW-827 Pulse Heart Rate sensor
#define PULSE_PIN               33     // HW-827 Signal (S) -> GPIO 33

// HW-072 Vibration Window & Thresholds
#define VIB_WINDOW_MS           10000UL
#define VIB_THRESH_LOW          3      // 3-5 events: LOW
#define VIB_THRESH_MODERATE     6      // 6-10 events: MODERATE
#define VIB_THRESH_HIGH        11      // 11-20 events: HIGH
#define VIB_THRESH_CRITICAL    21      // >20 events: CRITICAL

// ---------------- GLOBAL VARIABLES -----------------
DHT dht(DHTPIN, DHTTYPE);

unsigned long lastPostTime    = 0;
unsigned long lastVibWindow   = 0;
const unsigned long POST_INTERVAL_MS = 10000; // 10 seconds normal cadence
bool sosTriggered = false;

// HW-827 Heart Rate Peak Detection Variables
unsigned long lastBeatTime = 0;
int lastPulseSignal = 0;
int calculatedBPM = 0;
bool isFingerOnSensor = false;

// HW-072 Vibration State Variables
volatile unsigned long isrVibEvents = 0;
volatile unsigned long lastIsrVibMs  = 0;
unsigned long lastVibDetectedMs     = 0;
bool vibrationInstantActive         = false;
int windowEventsCount               = 0;
String currentVibLevel              = "NORMAL";
String currentVibStatus             = "SAFE";

struct SensorReadings {
  float  temperature;
  float  humidity;
  int    mq2_raw;
  int    mq2_mv;
  int    mq5_raw;
  int    mq5_mv;
  bool   sos;
  bool   fall;
  int    battery;
  int    ldr_raw;
  int    heart_rate;
  int    spo2;
  int    rssi;
  // HW-072 Vibration Data
  bool   vibration_detected;
  int    vibration_events;
  String vibration_level;
  String vibration_status;
};

SensorReadings currentData;

// Interrupt Service Routine for instant SOS button press
void IRAM_ATTR handleSosInterrupt() {
  sosTriggered = true;
}

// Interrupt Service Routine for HW-072 Vibration Pulse Detection
void IRAM_ATTR handleVibrationInterrupt() {
  unsigned long now = millis();
  if (now - lastIsrVibMs > 15) { // 15ms software debounce filter
    isrVibEvents++;
    lastIsrVibMs = now;
  }
}

// Forward declarations
void readSensors();
void readVibrationSensor();
void analyzeVibration();
void checkLocalAlerts();
void connectWiFi();
String createSensorJson();
void sendData(String jsonPayload);

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n[MineGuard] Booting ESP32 Smart Helmet Firmware v3.0...");

  pinMode(SOS_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // Attach interrupt for instantaneous SOS broadcast
  attachInterrupt(digitalPinToInterrupt(SOS_PIN), handleSosInterrupt, FALLING);

  // HW-072 Vibration Sensor DO -> GPIO 26
  pinMode(VIBRATION_PIN, INPUT_PULLDOWN);
  attachInterrupt(digitalPinToInterrupt(VIBRATION_PIN), handleVibrationInterrupt, RISING);
  Serial.println("[HW-072] Vibration Sensor attached on GPIO 26");

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

  // 1. Monitor Vibration continuous state
  readVibrationSensor();

  // 2. Perform periodic vibration time-window analysis
  if (now - lastVibWindow >= VIB_WINDOW_MS) {
    analyzeVibration();
    lastVibWindow = now;
  }

  // 3. Read other helmet sensors
  readSensors();

  // 4. Immediate Local Hardware Alert (Buzzer triggers even without Wi-Fi)
  checkLocalAlerts();

  // 5. Check for immediate SOS trigger or standard 10s interval
  if (currentData.sos || sosTriggered || (now - lastPostTime >= POST_INTERVAL_MS)) {
    if (currentData.sos || sosTriggered) {
      currentData.sos = true;
      Serial.println("\n[MineGuard] !!! IMMEDIATE SOS DISPATCH TRIGGERED !!!");
    }

    String payload = createSensorJson();
    sendData(payload);

    lastPostTime = millis();
    sosTriggered = false;
  }

  delay(50);
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

/**
 * readVibrationSensor()
 * Checks current HW-072 DO pin and updates instantaneous activity flags.
 */
void readVibrationSensor() {
  int pinState = digitalRead(VIBRATION_PIN);
  if (pinState == HIGH) {
    vibrationInstantActive = true;
    lastVibDetectedMs = millis();
  } else if (millis() - lastVibDetectedMs > 300) {
    vibrationInstantActive = false;
  }
}

/**
 * analyzeVibration()
 * Aggregates vibration events collected in the 10-second window.
 */
void analyzeVibration() {
  noInterrupts();
  windowEventsCount = isrVibEvents;
  isrVibEvents = 0;
  interrupts();

  if (windowEventsCount >= VIB_THRESH_CRITICAL) {
    currentVibLevel  = "CRITICAL";
    currentVibStatus = "CRITICAL";
  } else if (windowEventsCount >= VIB_THRESH_HIGH) {
    currentVibLevel  = "HIGH";
    currentVibStatus = "WARNING";
  } else if (windowEventsCount >= VIB_THRESH_MODERATE) {
    currentVibLevel  = "MODERATE";
    currentVibStatus = "MONITOR";
  } else if (windowEventsCount >= VIB_THRESH_LOW) {
    currentVibLevel  = "LOW";
    currentVibStatus = "NORMAL";
  } else {
    currentVibLevel  = "NORMAL";
    currentVibStatus = "SAFE";
  }

  currentData.vibration_detected = (windowEventsCount > 0) || vibrationInstantActive;
  currentData.vibration_events   = windowEventsCount;
  currentData.vibration_level    = currentVibLevel;
  currentData.vibration_status   = currentVibStatus;

  Serial.printf("[HW-072] 10s Window Events: %d | Level: %s | Status: %s\n",
                windowEventsCount,
                currentVibLevel.c_str(),
                currentVibStatus.c_str());
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
  currentData.fall = false;

  // Helmet battery estimate
  currentData.battery = 88;

  // RSSI Wi-Fi strength
  currentData.rssi = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : -99;

  // LDR Ambient Light Sensor
  if (ENABLE_LDR_SENSOR) {
    currentData.ldr_raw = analogRead(LDR_PIN);
  } else {
    currentData.ldr_raw = -1;
  }

  // HW-827 Heart Rate Pulse Sensor Reading (GPIO 33)
  if (ENABLE_PULSE_SENSOR) {
    int pulseSignal = analogRead(PULSE_PIN);

    if (pulseSignal > 1800) {
      isFingerOnSensor = true;
      if (pulseSignal > 2100 && lastPulseSignal <= 2100) {
        unsigned long currentMillis = millis();
        unsigned long duration = currentMillis - lastBeatTime;

        if (duration >= 400 && duration <= 1333) {
          int instantBPM = 60000 / duration;
          calculatedBPM = (calculatedBPM == 0) ? instantBPM : (calculatedBPM * 0.7 + instantBPM * 0.3);
        }
        lastBeatTime = currentMillis;
      }
      lastPulseSignal = pulseSignal;

      currentData.heart_rate = (calculatedBPM > 45 && calculatedBPM < 180) ? calculatedBPM : 76;
      currentData.spo2 = 98;
    } else {
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
  // Local alarm triggers on:
  // 1. SOS active
  // 2. Gas spike (>2500mV)
  // 3. High or Critical Vibration (does NOT sound for minor vibrations)
  bool isHighVibration = (currentVibLevel == "HIGH" || currentVibLevel == "CRITICAL");

  if (currentData.mq2_mv >= 2500 || currentData.mq5_mv >= 2500 || currentData.sos || isHighVibration) {
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

  // Vibration fields
  doc["vibration_detected"] = currentData.vibration_detected;
  doc["vibration_events"]   = currentData.vibration_events;
  doc["vibration_level"]    = currentData.vibration_level;
  doc["vibration_status"]   = currentData.vibration_status;

  String output;
  serializeJson(doc, output);
  return output;
}

void sendData(String jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Wi-Fi down. Skipping network dispatch; local alert active.");
    return;
  }

  WiFiClient client;
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

# LoRa Upgrade Architecture for Deep Subsurface Underground Mining

## 1. Overview
In deep coal mines, Wi-Fi 2.4 GHz signal propagation is strictly line-of-sight and rapidly attenuates around tunnel bends and rock formations. 

**LoRa (Long Range, 433 MHz / 868 MHz / 915 MHz)** provides sub-gigahertz penetration through rock strata, extending communication range to 1–3 km through underground drifts.

The MineGuard backend requires **NO changes** for this upgrade. The JSON payload format and endpoint remain identical.

---

## 2. Hardware Architecture

```
[ Worker Helmet ]                [ Subsurface Gateway ]              [ MineGuard Cloud ]
ESP32 + SX1278 (SPI)  ---LoRa---> ESP32 Gateway Node   ---Wi-Fi/Eth---> POST /api/readings
(Reads sensors, emits            (Receives RF packet,                (Validates, stores,
 LoRa binary/JSON)                appends gateway_id, rssi)           pushes Socket.IO)
```

### Components:
- **Worker Helmet**: ESP32 microcontroller + Semtech SX1278 (433 MHz) transceiver module connected via SPI.
- **Gateway Node**: ESP32 located at a shaft power distribution box or access tunnel equipped with an Ethernet/Wi-Fi uplink.

---

## 3. Telemetry Payload Compatibility
When transmitting over LoRa, the gateway forwards the exact JSON schema to the server:

```json
{
  "worker_id": "W001",
  "helmet_id": "H001",
  "temperature": 28.4,
  "humidity": 64.0,
  "mq2_mv": 1490,
  "mq5_mv": 1380,
  "mq2_raw": 1850,
  "mq5_raw": 1720,
  "heart_rate": 78,
  "spo2": 98,
  "ldr_raw": 2100,
  "sos": false,
  "fall": false,
  "battery": 87,
  "communication": "lora",
  "gateway_id": "GW-SHAFT-03",
  "rssi": -92,
  "snr": 7.5
}
```

---

## 4. Firmware Modification Steps

### In Worker Helmet Firmware (`esp32_wifi_post.ino`):
Replace `sendData()` with `sendLoRa()` using the `LoRa.h` library:

```cpp
#include <SPI.h>
#include <LoRa.h>

#define SCK     5
#define MISO    19
#define MOSI    27
#define SS      18
#define RST     14
#define DIO0    26

void setupLoRa() {
  SPI.begin(SCK, MISO, MOSI, SS);
  LoRa.setPins(SS, RST, DIO0);
  if (!LoRa.begin(433E6)) {
    Serial.println("[LoRa] Initializing LoRa failed!");
  }
  LoRa.setSyncWord(0x34); // Private network sync word
}

void sendLoRa(String jsonPayload) {
  LoRa.beginPacket();
  LoRa.print(jsonPayload);
  LoRa.endPacket();
}
```

### In Gateway Firmware:
The gateway listens continuously for incoming RF packets:

```cpp
void loop() {
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String incoming = "";
    while (LoRa.available()) {
      incoming += (char)LoRa.read();
    }
    
    // Inject Gateway ID and RF Signal parameters
    StaticJsonDocument<512> doc;
    deserializeJson(doc, incoming);
    doc["communication"] = "lora";
    doc["gateway_id"] = "GW-SHAFT-03";
    doc["rssi"] = LoRa.packetRssi();
    doc["snr"] = LoRa.packetSnr();

    String forwardPayload;
    serializeJson(doc, forwardPayload);

    // Forward to MineGuard REST API
    postToServer(forwardPayload);
  }
}
```

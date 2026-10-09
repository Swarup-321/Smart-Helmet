# 08 — Vibration / Seismic Monitoring (Phase 2 Deferred Specification)

## 1. Ratified Scope Status: DEFERRED TO PHASE 2
- **Current Implementation Status**: **DEFERRED**.
- **Rationale**: The codebase audit confirmed that vibration and seismic monitoring is completely absent from the entire repository:
  - No physical vibration sensor model exists.
  - No firmware acquisition code exists.
  - No backend Zod schema field exists.
  - No SQLite or Firestore storage column exists.
  - No dashboard UI component exists.
- **Strict Execution Prohibition**:
  - The project must **NOT** create fictional sensor readings.
  - The project must **NOT** introduce fake vibration values or simulated mock charts.
  - The project must **NOT** create software stubs or database columns for unsupported hardware assumptions during Phase 1.

---

## 2. Phase 2 Hardware Prerequisites
Before any vibration monitoring software can be developed, the hardware engineering team must physically deliver and confirm:
1. **Sensor Hardware Module**: Exact model (e.g., SW-420 digital vibration switch, ADXL345 3-axis I2C accelerometer, or 4–20 mA geophone).
2. **Electrical & Bus Interface**: GPIO pin, ADC channel, or I2C bus wiring on the fixed mine-zone gateway node.
3. **Sampling Cadence**: High-speed sampling rate (e.g., 50–500 Hz for waveform analysis, or pulse count integration).
4. **Physical Measurement Units**: Acceleration ($m/s^2$ or $g$), Peak Particle Velocity ($mm/s$), or RMS vibration level.
5. **Preprocessing & Filtering**: On-chip bandpass filtering or windowed Fast Fourier Transform (FFT) analysis.

---

## 3. Future Phase 2 Architecture Pipeline
Once physical hardware is delivered and verified on a mine-zone monitoring node:
```
[Fixed Zone Node / Geophone] ──> Firmware RMS Calculation ──> POST /api/readings ──> SQLite/Firestore ──> Socket.IO ──> Seismic Alert UI
```
Until hardware delivery, vibration monitoring remains deferred, and all engineering resources are focused on the gas telemetry and ML gas-surge early warning pipeline.

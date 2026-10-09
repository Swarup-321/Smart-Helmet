# MineGuard Smart Helmet — Project Implementation Contract & Architecture Index

These documents constitute the ratified technical contract for the MineGuard Smart Helmet project, derived from the codebase audit, validation report, and architectural ratification step. They are the binding specification for the future implementation agent.

---

## 1. Document Index & Reading Sequence
1. **[00_ARCHITECTURAL_DECISIONS.md](file:///c:/Users/abuna/Desktop/clg/IOT/Smart-Helmet/mineguard_project_docs/00_ARCHITECTURAL_DECISIONS.md)**: Ratified architectural decisions (branch alignment, gas semantics, ML surge objective, SQLite choice, vibration deferral).
2. **[FINAL_IMPLEMENTATION_CONTRACT.md](file:///c:/Users/abuna/Desktop/clg/IOT/Smart-Helmet/mineguard_project_docs/FINAL_IMPLEMENTATION_CONTRACT.md)**: Concise master specification for the implementation agent (what to build, what exists, what must change, what must not change).
3. **[DOCUMENT_VALIDATION_REPORT.md](file:///c:/Users/abuna/Desktop/clg/IOT/Smart-Helmet/mineguard_project_docs/DOCUMENT_VALIDATION_REPORT.md)**: Full validation audit comparing real codebase against specs.
4. **[01_ARCHITECTURE.md](file:///c:/Users/abuna/Desktop/clg/IOT/Smart-Helmet/mineguard_project_docs/01_ARCHITECTURE.md)**: End-to-end runtime flow and component architecture.
5. **[02_CURRENT_DATA_CONTRACT.md](file:///c:/Users/abuna/Desktop/clg/IOT/Smart-Helmet/mineguard_project_docs/02_CURRENT_DATA_CONTRACT.md)**: Physical sensor fields, electrical millivolt units, firmware variants, and SQLite pressure persistence.
6. **[03_ML_REQUIREMENTS.md](file:///c:/Users/abuna/Desktop/clg/IOT/Smart-Helmet/mineguard_project_docs/03_ML_REQUIREMENTS.md)**: Binary gas-surge early warning task definition, 5–15 min horizon, and safety alert separation.
7. **[04_ML_DATA_PIPELINE.md](file:///c:/Users/abuna/Desktop/clg/IOT/Smart-Helmet/mineguard_project_docs/04_ML_DATA_PIPELINE.md)**: 10-second cadence downsampling, normalized relative temporal feature extraction, chronological splits, and leakage controls.
8. **[05_ML_MODEL_SPEC.md](file:///c:/Users/abuna/Desktop/clg/IOT/Smart-Helmet/mineguard_project_docs/05_ML_MODEL_SPEC.md)**: Input/output contract for gas-surge classification and required evaluation metrics.
9. **[06_ML_INFERENCE_API.md](file:///c:/Users/abuna/Desktop/clg/IOT/Smart-Helmet/mineguard_project_docs/06_ML_INFERENCE_API.md)**: Python FastAPI microservice specification (`POST /predict/gas-trend`) and non-blocking Express hook.
10. **[07_DASHBOARD_ML_INTEGRATION.md](file:///c:/Users/abuna/Desktop/clg/IOT/Smart-Helmet/mineguard_project_docs/07_DASHBOARD_ML_INTEGRATION.md)**: React dashboard integration, ML advisory panel, and elimination of mock arrays.
11. **[08_VIBRATION_MONITORING.md](file:///c:/Users/abuna/Desktop/clg/IOT/Smart-Helmet/mineguard_project_docs/08_VIBRATION_MONITORING.md)**: Formal Phase 2 deferred specification; prohibition of mock stubs.
12. **[09_IMPLEMENTATION_PLAN.md](file:///c:/Users/abuna/Desktop/clg/IOT/Smart-Helmet/mineguard_project_docs/09_IMPLEMENTATION_PLAN.md)**: Phase-by-phase implementation sequence.
13. **[10_TEST_AND_VALIDATION.md](file:///c:/Users/abuna/Desktop/clg/IOT/Smart-Helmet/mineguard_project_docs/10_TEST_AND_VALIDATION.md)**: Acceptance test criteria, resilience tests, and graceful degradation assertions.

---

## 2. Core Ratified Facts
- **Active Branch**: Local branch `smart-helmet` tracking `origin/smart-helmet`.
- **Runtime Flow**: ESP32 HTTP POST `/api/readings` $\to$ Express Zod validation $\to$ Async ML hook $\to$ Dual SQLite/Firestore storage $\to$ Socket.IO $\to$ React dashboard. MQTT is not implemented.
- **Gas Telemetry**: MQ-2 and MQ-5 output raw electrical millivolts (`0–3300 mV`), not calibrated % CH4 or PPM.
- **ML Task**: Binary Gas-Surge Early Warning (5–15 min horizon) based on normalized relative temporal dynamics. No absolute concentration predictions.
- **Vibration**: Deferred to Phase 2; zero software stubs or fake data in Phase 1.
- **Primary Database**: Embedded SQLite (`server/data/mineguard.db`) for implementation and validation; Firestore adapter preserved.

---

## 3. Execution Rule
Do not implement from memory or unverified assumptions. The implementation agent must adhere strictly to these ratified contracts.

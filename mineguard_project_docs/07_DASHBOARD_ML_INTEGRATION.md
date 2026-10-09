# 07 — Dashboard ML Integration

## Current UI state
Existing real telemetry features should remain working. Two major areas are currently mocked:
- Overview gas dynamics chart
- Analytics View heatmaps/scatter/leaderboard

Historical WorkerDetail charts are already connected to real history data.

## ML UI goals
The ML layer should be visible as a first-class feature, while clearly separating:
- measured sensor values
- deterministic threshold alerts
- ML-derived early-warning outputs

## Overview
Replace the hardcoded gas dynamics data with live data. Add an ML early-warning section showing only actual available outputs, such as:
- current measured gas signal
- ML warning probability, if the model outputs it
- trend classification, if implemented
- ML status
- latest inference timestamp

## Worker Detail
Keep existing historical charts and add an ML overlay/panel using live Socket.IO inference data or a persisted inference history if that is later implemented.

Do not show invented future curves or breach times.

## Analytics View
Replace mock arrays only where the backend can supply real data. A feature is not considered complete because its chart renders; it must be driven by actual backend data.

## UX rules
- Do not hard-code operational thresholds in React.
- Display units exactly as defined by the live contract.
- Label model-derived information as ML/predicted.
- Show stale/unavailable state when no recent ML inference exists.
- Keep the existing emergency/SOS behaviour intact.

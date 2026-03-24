# Project Walkthrough: EHR Clinic Dashboard & API (Deep Technical Guide)

Companion guide:
- If you want the fast, high-level version, read `SIMPLE_WALKTHROUGH.md`.
- If you want detailed internals, API flow, and file-by-file behavior, use this file.

## 1. Executive Summary

This repository is a full-stack clinical decision support prototype with two core workflows:

1. Medication reconciliation across conflicting source records.
2. Data quality assessment for a patient chart.

The frontend is a React SPA (Vite). The backend is Express on Node.js. The backend calls OpenAI (`gpt-4o`) using strict JSON-mode responses and then validates response shape before returning data to the UI. Results are persisted to in-memory arrays (not durable storage).

The architecture is intentionally simple and prototype-oriented:
- Fast iteration.
- Clear separation of UI, API routes, business services, and external AI adapter.
- No persistent DB.
- No auth system; per-request API key forwarding is used.

---

## 2. Runtime Architecture

### 2.1 Logical Layers

1. Presentation Layer: `frontend/src/pages/*`, `frontend/src/components/*`
2. Client Integration Layer: `frontend/src/services/api.js`, `frontend/src/services/webhook.js`
3. Transport Layer: Express routes in `EHR/src/routes/*`
4. Domain/Prompt Layer: `EHR/src/services/reconcileService.js`, `EHR/src/services/dataQualityService.js`
5. External AI Adapter: `EHR/src/services/openaiService.js`
6. Persistence Stub: `EHR/src/models/*.js` (plain arrays)

### 2.2 Data Flow (Medication Reconciliation)

1. User edits form in `MedicationReconciliation.jsx`.
2. Frontend validates required fields and duplicate heuristics.
3. Frontend posts payload to `/api/reconcile/medication` through `api.js`.
4. Route validates schema and extracts bearer key.
5. Reconcile service builds system + user prompts.
6. OpenAI adapter calls model with JSON response format.
7. Route validates returned JSON fields.
8. Route stores audit record in array model.
9. Response returns to UI.
10. UI calibrates confidence with deterministic rules and renders `ConfidenceGauge`.

### 2.3 Data Flow (Data Quality)

1. User edits chart fields in `DataQuality.jsx`.
2. Frontend validates demographics/date formats.
3. Frontend posts payload to `/api/validate/data-quality`.
4. Route validates request and extracts bearer key.
5. Data quality service builds rubric prompt + record prompt.
6. OpenAI adapter calls model.
7. Route validates response schema.
8. Route stores result in in-memory array.
9. UI renders overall score, dimensional scores, and issue list.

---

## 3. Root-Level Files

## 3.1 `README.md`

Primary product documentation: setup, stack, endpoint contracts, scoring descriptions, and error semantics. It is mostly accurate and serves as API-level contract documentation.

## 3.2 `WALKTHROUGH.md`

This file (the one you are reading) is a deeper implementation walkthrough intended to match the actual code paths and explain interactions file-by-file.

## 3.3 `.env`

Local environment variables, loaded by backend startup in `EHR/src/server.js`.
- `OPENAI_API_KEY` may be used as fallback if request header key is not provided.
- `PORT` controls backend listen port.

Security note: keep this file out of source control; rotate any exposed key immediately.

## 3.4 `.gitignore`

Root ignore includes:
- `node_modules`
- `.env`

This is critical for dependency bloat and secret hygiene.

## 3.5 `docker-compose.yml`

Two services:
- `backend`: context `./EHR`, dockerfile `../Dockerfile.backend`, maps `3000:3000`.
- `frontend`: context `./frontend`, dockerfile `../Dockerfile.frontend`, maps `4173:4173`.

`frontend` depends on `backend` for startup ordering. `VITE_API_URL` is set for frontend runtime config.

## 3.6 `Dockerfile.backend`

Simple single-stage Node build:
- Base `node:20-alpine`
- Copy package manifests
- `npm install`
- Copy app source
- Expose 3000
- `npm start`

## 3.7 `Dockerfile.frontend`

Frontend build + preview image:
- Base `node:20-alpine`
- Install dependencies
- `npm run build`
- Expose 4173
- Run `vite preview --host`

## 3.8 `vercel.json` (root)

Mixed deployment routing:
- Frontend static build from `frontend/package.json`.
- Backend function from `EHR/src/app.js`.
- Routes `/api/*` to backend function.
- Routes all others to frontend shell.

---

## 4. Backend: `EHR/`

## 4.1 Package and Local Data Files

### 4.1.1 `EHR/package.json`

Defines backend runtime dependencies and one script:
- `start`: `node ./src/server.js`

Dependencies: `express`, `cors`, `morgan`, `openai`, `dotenv`, and helper packages.

### 4.1.2 `EHR/package-lock.json`

Dependency lockfile for reproducible installs.

### 4.1.3 `EHR/test1.json`, `EHR/test2.json`

Manual sample request payloads:
- `test1.json`: data quality payload.
- `test2.json`: medication reconciliation payload.

Useful for manual cURL/Postman testing.

### 4.1.4 `EHR/out1.json`, `EHR/out2.json`

Present as output placeholders; currently empty.

---

## 4.2 Backend Entry and App Composition

### 4.2.1 `EHR/src/server.js`

Backend process entrypoint.

Responsibilities:
1. Load root `.env` file.
2. Import configured Express app from `app.js`.
3. Log in-memory store readiness.
4. Normalize and set port.
5. Create Node HTTP server and start listening.
6. Handle common listen errors (`EACCES`, `EADDRINUSE`).

Design notes:
- This file does not enforce global auth.
- API key usage is delegated to service-level OpenAI client initialization.

### 4.2.2 `EHR/src/app.js`

Express app factory/configuration.

Middleware pipeline:
1. `cors()` for cross-origin browser requests.
2. `morgan('dev')` request logging.
3. `express.json()` body parser for JSON payloads.
4. `express.urlencoded()` parser.

Routers mounted:
- `indexRouter`
- `medicationRouter`
- `dataRouter`

Error handling:
1. 404 forwarding via `http-errors`.
2. Final JSON error serializer:
   - `message`
   - `error` object in development, empty otherwise.

---

## 4.3 Models (In-Memory Persistence)

### 4.3.1 `EHR/src/models/ReconciliationResult.js`

Exports `[]`.

Used as append-only runtime array for medication reconciliation audit records. Data disappears on process restart.

### 4.3.2 `EHR/src/models/DataQualityResult.js`

Exports `[]`.

Used similarly for data quality audit snapshots.

---

## 4.4 Routes

### 4.4.1 `EHR/src/routes/index.js`

Defines `GET /` that serves `../public/index.html`.

Purpose:
- Legacy SPA shell route from backend side.

Caveat:
- Verify file existence under runtime packaging. If absent, this endpoint may fail and should be aligned with actual deployment strategy.

### 4.4.2 `EHR/src/routes/medication.js`

Endpoint: `POST /api/reconcile/medication`.

Flow:
1. Extract `body` and bearer token key.
2. Validate request shape:
   - body must be object
   - `sources` must be non-empty array
   - `patient_context` must be object
3. Call `reconcileService.reconcileMedications(body, apiKey)`.
4. Validate AI schema using `openaiService.validateReconciliationResult`.
5. Build `record` object with request+response fields and timestamps.
6. Persist via `ReconciliationResult.push(record)`.
7. On persist failure, log and attach warning to response.
8. Return `200` JSON payload.

Error path:
- Any thrown error is delegated to Express error middleware via `next(err)`.

### 4.4.3 `EHR/src/routes/data.js`

Endpoint: `POST /api/validate/data-quality`.

Flow mirrors medication route, with specific validation:
- body object required
- `demographics` object required

Calls `dataQualityService.assessDataQuality(body, apiKey)`, validates with `validateDataQualityResult`, persists result to `DataQualityResult`, and returns response with optional warning on persist failure.

### 4.4.4 `EHR/src/routes/users.js`

Template scaffold route (`GET /` -> text response). Not mounted in `app.js`; effectively unused.

---

## 4.5 Services

### 4.5.1 `EHR/src/services/openaiService.js`

Core AI adapter and contract validator.

#### A. Client Construction Strategy

`getClient(apiKey)` behavior:
1. If explicit `apiKey` passed: create fresh OpenAI client for that request.
2. Else: fallback to env key and singleton cached client.
3. If neither exists: throw descriptive error.

This enables per-request keying while preserving a singleton for env-based operation.

#### B. Completion Invocation

`attemptCall(systemPrompt, userPrompt, apiKey)`:
- Calls `chat.completions.create` with:
  - `model: 'gpt-4o'`
  - `response_format: { type: 'json_object' }`
  - system + user messages
  - `temperature: 0.2`

#### C. Retry and Parse Guard

`callOpenAI(...)`:
1. Retries 429 rate limits up to 3 times with backoff:
   - 1000ms
   - 2000ms
   - 4000ms
2. Wraps service errors with normalized status codes.
3. Parses JSON and retries once if parse fails.
4. Throws `502` if response remains invalid JSON after retry.

#### D. Response Schema Validators

`validateReconciliationResult(result)` enforces:
- `reconciled_medication`: non-empty string
- `confidence_score`: number in [0, 1]
- `reasoning`: non-empty string
- `recommended_actions`: non-empty array
- `clinical_safety_check`: non-empty string

`validateDataQualityResult(result)` enforces:
- `overall_score`: number in [0, 100]
- `breakdown` object with numeric:
  - `completeness`
  - `accuracy`
  - `timeliness`
  - `clinical_plausibility`
- `issues_detected`: array

These validators protect downstream storage and API response quality.

### 4.5.2 `EHR/src/services/reconcileService.js`

Medication prompt builder and orchestration service.

Contains:
1. `SYSTEM_PROMPT` with mandatory weighting and schema constraints.
2. `buildUserPrompt(body)` that serializes:
   - patient age, conditions, labs
   - each source system/med/date/reliability
   - explicit task section + current date
3. `reconcileMedications(body, apiKey)` delegating to `openaiService.callOpenAI`.

Prompt engineering strategy:
- Strong role framing.
- Explicit decision rubric.
- Explicit output schema.
- Date injection for temporal reasoning context.

### 4.5.3 `EHR/src/services/dataQualityService.js`

Data quality rubric prompt builder.

Contains:
1. `SYSTEM_PROMPT` specifying four dimensions:
   - completeness
   - accuracy
   - timeliness
   - clinical_plausibility
2. Severity definitions (`high`, `medium`, `low`).
3. Strict JSON schema requirement.
4. `buildUserPrompt(body)` that serializes all relevant chart fields and current date.
5. `assessDataQuality(body, apiKey)` delegation.

Notable design choice:
- Rubric is prompt-embedded rather than code-implemented scoring. The model performs scoring, while code enforces schema shape.

---

## 5. Frontend: `frontend/`

## 5.1 Build/Tooling Files

### 5.1.1 `frontend/package.json`

Defines Vite scripts (`dev`, `build`, `preview`), linting, and test dependencies (`vitest`, testing-library, jsdom).

### 5.1.2 `frontend/package-lock.json`

Dependency lockfile for deterministic installs.

### 5.1.3 `frontend/vite.config.js`

Sets React plugin and dev proxy:
- `/api` -> `http://localhost:3000`

This avoids CORS pain in local dev by proxying API calls through Vite dev server.

### 5.1.4 `frontend/vitest.config.js`

Test setup:
- `environment: 'jsdom'`
- `globals: true`
- include patterns for frontend tests and selected backend test locations.

### 5.1.5 `frontend/eslint.config.js`

Flat config with:
- JS recommended rules
- React hooks rules
- React refresh plugin
- custom no-unused-vars behavior

### 5.1.6 `frontend/index.html`

SPA shell with `#root` element and module entry `src/main.jsx`.

### 5.1.7 `frontend/vercel.json`

SPA rewrite rule: all paths rewrite to `/index.html`.

### 5.1.8 `frontend/.gitignore`

Frontend-local ignores for logs, node_modules, build outputs, editor files.

### 5.1.9 `frontend/README.md`

Default Vite README template content.

### 5.1.10 `frontend/test-output.txt`, `frontend/test-out2.txt`, `frontend/test-failures.log`

Captured test execution outputs documenting earlier failures and partial fixes.

### 5.1.11 `frontend/public/vite.svg` and `frontend/src/assets/react.svg`

Template SVG assets.

---

## 5.2 Frontend App Entry and Shell

### 5.2.1 `frontend/src/main.jsx`

Mounts React app into `#root`, wraps in `React.StrictMode`, imports global CSS and app root component.

### 5.2.2 `frontend/src/App.jsx`

Top-level UI shell and global state coordinator.

State:
- `hasKey`: API key availability state
- `showPrompt`: modal visibility
- `currentTab`: active page (`reconcile`, `data`, `webhook`)

Lifecycle logic:
1. On mount, check key from env or localStorage.
2. Register `ehr_api_unauthorized` event listener.
3. On unauthorized event:
   - clear local key
   - force modal reopen

UI logic:
- Sticky header
- Tab buttons
- Conditional page rendering
- API key prompt modal handling

---

## 5.3 Frontend Components

### 5.3.1 `frontend/src/components/ApiKeyPrompt.jsx`

Modal component for API key input and storage.

Behavior:
1. Controlled password input.
2. On submit, store trimmed key to localStorage.
3. Trigger `onKeySave` callback.
4. Optional cancel button controlled by `showCancel` prop.

Used as app-level gatekeeper to reduce unauthorized request attempts.

### 5.3.2 `frontend/src/components/ConfidenceGauge.jsx`

Confidence visualization component.

Inputs:
- `score` in [0,1]
- optional `breakdown` object

Behavior:
1. Convert to percentage.
2. Assign threshold color class:
   - red < 50
   - yellow < 70
   - green otherwise
3. Render progress bar and numeric label.
4. If breakdown exists, render expandable detail list.

---

## 5.4 Frontend Pages

### 5.4.1 `frontend/src/pages/MedicationReconciliation.jsx`

Most feature-dense page.

#### A. State Model

- `patientContext`: age, conditions, egfr
- `sources`: dynamic source list with system/med/date/reliability
- `loading`, `result`, `error`
- `duplicateWarning`, `validationErrors`
- `decision` (approved/rejected/null)

#### B. User Operations

- Add/remove source rows
- Edit source fields
- Validate required fields
- Run reconciliation
- Approve/reject result and optionally dispatch webhook

#### C. Submit Pipeline

1. Prevent default.
2. Run local validation.
3. Run duplicate detection unless bypassed.
4. Build backend payload:
   - parse age and eGFR to numbers
   - split comma conditions into array
5. Call `api.reconcileMedication(...)`.
6. Calibrate score via `calibrateConfidenceScore`.
7. Render enriched result.

#### D. Rendering Details

- Left pane: forms + validation/errors.
- Right pane: result card, safety badge, confidence gauge, reasoning, recommendations.
- Decision controls shown only when undecided.

### 5.4.2 `frontend/src/pages/DataQuality.jsx`

Data quality form and results page.

#### A. State

- `formData` with demographics, meds, allergies, conditions, vitals, last_updated
- `loading`, `result`, `error`, `validationErrors`

#### B. Validation Rules

- required: name, dob, gender
- rough date parse checks for `dob` and `last_updated`

#### C. Payload Builder

Transforms form strings to backend schema:
- `demographics` object
- comma-separated lists -> arrays
- `heart_rate` string -> integer or undefined
- `vital_signs` object

#### D. UI Rendering

- Score cards for overall + dimensions.
- Issue list with severity badge color mapping via `thresholds.js`.

### 5.4.3 `frontend/src/pages/WebhookConfig.jsx`

Webhook configuration utility page.

Behavior:
1. Load saved URL from localStorage on mount.
2. Save validated URL.
3. Clear URL.
4. Show transient status message.

Used by reconciliation decision flow to notify external systems.

---

## 5.5 Frontend Services

### 5.5.1 `frontend/src/services/api.js`

Central client API adapter.

Key pieces:
1. `API_BASE_URL` from `VITE_API_URL`.
2. `ApiError` class with status and payload.
3. `fetchWithAuth` wrapper:
   - retrieves key from env or localStorage
   - sets `Authorization: Bearer <key>`
   - throws on missing key
   - dispatches unauthorized event on 401
   - parses non-OK response body when possible
4. Public methods:
   - `reconcileMedication(patientContext, sources)`
   - `validateDataQuality(patientRecord)`

### 5.5.2 `frontend/src/services/webhook.js`

Webhook sender utility.

Behavior:
- If URL missing, return soft failure object.
- POST JSON payload + ISO timestamp.
- Uses `mode: 'no-cors'`, so response visibility is limited and success may be opaque.
- Returns best-effort status object.

---

## 5.6 Frontend Utilities

### 5.6.1 `frontend/src/utils/calibration.js`

Deterministic post-model confidence calibration.

Weights:
- recency: 0.3
- reliability: 0.3
- agreement: 0.2
- contextAlignment: 0.2

Heuristics:
1. Recency score based on age of newest source date.
2. Reliability score from max reliability class observed.
3. Agreement score from medication name token match ratio.
4. Context alignment currently fixed baseline at `0.8`.

Returns:
- rounded score
- per-dimension breakdown metadata for UI transparency.

### 5.6.2 `frontend/src/utils/duplicateDetection.js`

Duplicate grouping heuristic.

Algorithm:
- O(n^2) source comparison loop.
- Normalize medication strings and compare first token (drug name approximation).
- Group matching entries and avoid duplicate grouping via `Set`.

Returns grouped duplicate arrays for warning UX.

### 5.6.3 `frontend/src/utils/thresholds.js`

Color mapping helpers:
- `getDataQualityColor(score)` -> `red`, `yellow`, `green`, `gray`
- `getSeverityBadgeColor(severity)` -> same token set

---

## 5.7 CSS

### 5.7.1 `frontend/src/index.css`

Global theme tokens and utility classes.

Defines:
- color variables
- typography
- layout primitives
- card/button styles
- badge/status classes

Design caveat:
- Some class names used in JSX are not defined as utilities here, so those styles may depend on inline CSS or missing utility declarations.

---

## 6. Tests

## 6.1 Frontend Validation and Utility Tests

### 6.1.1 `frontend/src/pages/Validation.test.jsx`

Component tests for both main pages:
- medication validation scenarios
- data quality validation scenarios

Uses mocked API service to avoid live network calls.

### 6.1.2 `frontend/src/utils/calibration.test.js`

Unit tests calibration behavior under reliability, recency, agreement/conflict, and output bounds.

### 6.1.3 `frontend/src/utils/duplicateDetection.test.js`

Unit tests duplicate detection grouping for similar/dissimilar medication records.

## 6.2 Backend-Oriented Tests in Frontend Workspace

### 6.2.1 `frontend/src/__backend_tests__/reconcileService.test.js`

Node-environment tests for backend reconcile service with OpenAI call mocked.

### 6.2.2 `frontend/src/__backend_tests__/dataQualityService.test.js`

Node-environment tests for backend data quality service with OpenAI call mocked.

---

## 7. Operational Characteristics

## 7.1 Persistence and Durability

All persisted results are in-memory arrays. Restarting backend clears all prior records.

## 7.2 Reliability

OpenAI call reliability protections include:
- rate-limit retries with exponential backoff
- JSON parse retry
- schema validation before route success

## 7.3 Security Model

Current model is lightweight and prototype-level:
- API key provided from frontend env/localStorage and forwarded as bearer token.
- No user auth/session management.
- No server-side encrypted secret vault.

## 7.4 Deployment Modes

- Local dev via Vite proxy + Node backend.
- Docker compose two-container orchestration.
- Vercel config for mixed frontend/backend routing.

---

## 8. Known Gaps and Cleanup Candidates

1. Remove or wire `EHR/src/routes/users.js`.
2. Verify `EHR/src/routes/index.js` static path aligns with actual build/deploy artifact location.
3. Consolidate and clean historical commentary in `frontend/src/services/api.js` and `frontend/src/services/webhook.js`.
4. Align docs and comments where behavior has evolved.
5. Consider persistent storage (SQLite/Postgres/Mongo) for audit durability.
6. Consider centralized auth/key handling for production-hardening.

---

## 9. Quick Trace Cheatsheet

Medication route stack:
- `frontend/src/pages/MedicationReconciliation.jsx`
- `frontend/src/services/api.js` -> `/api/reconcile/medication`
- `EHR/src/routes/medication.js`
- `EHR/src/services/reconcileService.js`
- `EHR/src/services/openaiService.js`
- `EHR/src/models/ReconciliationResult.js`

Data quality route stack:
- `frontend/src/pages/DataQuality.jsx`
- `frontend/src/services/api.js` -> `/api/validate/data-quality`
- `EHR/src/routes/data.js`
- `EHR/src/services/dataQualityService.js`
- `EHR/src/services/openaiService.js`
- `EHR/src/models/DataQualityResult.js`

This map is the fastest way to debug request/response behavior end-to-end.

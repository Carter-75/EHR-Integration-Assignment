# Simple Walkthrough: EHR Clinic Dashboard & API

This is the short version of the project guide.

If you want deeper internals, read `WALKTHROUGH.md`.

---

## 1. What This Project Is

This project is a full-stack healthcare prototype with AI assistance.

It has two main features:
1. Medication Reconciliation: compares conflicting medication records and returns a best recommendation.
2. Data Quality Assessment: scores how complete and trustworthy a patient record is.

---

## 2. Tech Stack (Quick)

Frontend:
- React + Vite

Backend:
- Node.js + Express

AI:
- OpenAI `gpt-4o` via backend services

Testing:
- Vitest + Testing Library

Containers:
- Docker + docker-compose

---

## 3. Folder Map

- `EHR/` -> backend API
- `frontend/` -> React app
- `docker-compose.yml` -> runs backend + frontend together
- `vercel.json` -> deployment routing config

---

## 4. How The App Works (High Level)

### Medication Reconciliation flow

1. User enters patient context + source medication records in the frontend.
2. Frontend sends request to `/api/reconcile/medication`.
3. Backend validates request.
4. Backend builds a clinical prompt and calls OpenAI.
5. Backend validates AI response fields.
6. Backend stores result in memory and returns JSON.
7. Frontend displays recommendation, confidence, and reasoning.

### Data Quality flow

1. User enters patient chart data.
2. Frontend sends request to `/api/validate/data-quality`.
3. Backend validates request.
4. Backend builds rubric prompt and calls OpenAI.
5. Backend validates response schema.
6. Backend stores result in memory and returns JSON.
7. Frontend shows overall score, breakdown, and issue list.

---

## 5. Most Important Files

Backend core:
- `EHR/src/server.js` -> starts backend
- `EHR/src/app.js` -> middleware + route wiring
- `EHR/src/routes/medication.js` -> medication endpoint
- `EHR/src/routes/data.js` -> data quality endpoint
- `EHR/src/services/openaiService.js` -> OpenAI call + retries + schema checks
- `EHR/src/services/reconcileService.js` -> medication prompts
- `EHR/src/services/dataQualityService.js` -> data-quality prompts

Frontend core:
- `frontend/src/App.jsx` -> shell/tabs/key prompt logic
- `frontend/src/pages/MedicationReconciliation.jsx` -> medication UI + submit flow
- `frontend/src/pages/DataQuality.jsx` -> data quality UI + submit flow
- `frontend/src/services/api.js` -> API request wrapper
- `frontend/src/components/ConfidenceGauge.jsx` -> confidence UI

---

## 6. Data Storage Reality

The app uses in-memory arrays (`module.exports = []`) as temporary storage.

That means:
- Fast and simple for prototyping
- Data is lost when backend restarts

---

## 7. API Key Handling (Simple)

- Frontend stores key in browser localStorage (or reads from env).
- Frontend sends key in `Authorization: Bearer ...`.
- Backend uses this key for OpenAI calls.

If key is missing or invalid, requests fail and UI asks for a new key.

---

## 8. Running The Project

Backend:
1. `cd EHR`
2. `npm install`
3. `npm start`

Frontend:
1. `cd frontend`
2. `npm install`
3. `npm run dev`

Or run both with Docker:
- `docker-compose up --build`

---

## 9. What To Read Next

- For deep internals and full file-by-file explanation: `WALKTHROUGH.md`
- For endpoint setup and usage examples: `README.md`

# EHR — Electronic Health Records API

A Node.js / Express REST API for AI-powered clinical data processing. Provides two endpoints: medication reconciliation across conflicting source records, and patient record data quality assessment. Both use OpenAI GPT-4o for clinical reasoning and persist results to an in-memory store.

---

## Tech Stack

| Layer | Package | Version |
|---|---|---|
| Runtime | Node.js | ≥ 18 recommended |
| Web framework | express | ~4.16.1 |
| HTTP logging | morgan | ~1.9.1 |
| Cookie parsing | cookie-parser | ~1.4.4 |
| HTTP error helpers | http-errors | ~1.6.3 |
| Debug logging | debug | ~2.6.9 |
| Environment loading | dotenv | ^17.3.1 |
| AI client | openai | ^6.27.0 |
| Template engine | jade | ~1.11.0 (declared, unused) |

---

## Project Structure

```
Intern/
├── .env                              # Environment variables (not committed)
├── README.md
└── EHR/                              # Application root
    ├── package.json
    ├── app.js                        # Express app: middleware, route registration, error handler
    ├── bin/
    │   └── www                       # Server entry point: env validation, DB connection, HTTP listen
    ├── public/
    │   └── index.html                # Static HTML shell served at GET /
    ├── routes/
    │   ├── index.js                  # GET / — serves public/index.html
    │   ├── users.js                  # GET /users — placeholder stub
    │   ├── medication.js             # POST /api/reconcile/medication
    │   └── data.js                   # POST /api/validate/data-quality
    ├── services/
    │   ├── openaiService.js          # OpenAI client, retry logic, JSON validation, schema validators
    │   ├── reconcileService.js       # Builds prompts for medication reconciliation
    │   └── dataQualityService.js     # Builds prompts for data quality assessment
    └── models/
        ├── ReconciliationResult.js   # In-memory array for reconciliation results
        └── DataQualityResult.js      # In-memory array for data quality results
```

---

## Environment Variables

Defined in `Intern/.env`. Loaded at startup by `bin/www` via `dotenv`.

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | **Yes** | — | OpenAI API key. Server will not start without it. |
| `PORT` | No | `3000` | TCP port the HTTP server listens on. |

**Example `.env`:**
```
OPENAI_API_KEY=sk-...your-key-here
PORT=3000
```

> `PORT` must be set as a shell environment variable or in `.env`. Passing it as an argument to `npm start` has no effect — `bin/www` reads `process.env.PORT`, not `process.argv`.

---

## Storage

The app stores generated patient records and AI assessments in standard JavaScript arrays (in-memory).
Data generated during use does not persist between server restarts.

**Collections generated automatically:**

| Collection | Populated by |
|---|---|
| `reconciliationresults` | `POST /api/reconcile/medication` |
| `dataqualityresults` | `POST /api/validate/data-quality` |

No setup is required.

---

## OpenAI Integration

Both AI-powered routes use `gpt-4o` via the OpenAI Chat Completions API. The `openaiService.js` module is the single integration point.

**Model settings:**
- Model: `gpt-4o`
- `response_format: { type: 'json_object' }` — enforces JSON-only output
- `temperature: 0.2` — low temperature for stable clinical reasoning

**Retry policy:**
- HTTP 429 (rate limit): up to 3 retries with exponential backoff — 1 s, 2 s, 4 s. Returns 503 after exhaustion.
- Invalid JSON response: one retry of the full API call. Returns 502 if still unparseable.
- Any other API error: surfaced immediately with the original HTTP status.

**Schema validation:**  
After parsing, responses are validated against the expected field schema before any DB write. If required fields are missing or the wrong type, a 502 is returned with a description of each failing field. The Mongoose model is never called with incomplete data.

---

## Installation

```bash
# 1. Clone or download the repository
cd Intern

# 2. Install dependencies
cd EHR
npm install

# 3. Set environment variables
# Edit Intern/.env — add your OpenAI API key (see Environment Variables above)
```

---

## Running Locally

```bash
cd EHR
npm start
```

Server starts on `http://localhost:3000` (or `$PORT`).

**To use a different port:**
```powershell
# PowerShell
$env:PORT=3001; npm start

# bash / macOS / Linux
PORT=3001 npm start
```

**Expected startup output (with valid config):**
```
[In-Memory Store] Ready
```

**If `OPENAI_API_KEY` is missing or empty**, the process exits immediately:
```
[FATAL] OPENAI_API_KEY is not set or is empty. Set it in Intern/.env and restart.
```

---

## Available Scripts

Defined in `EHR/package.json`:

| Script | Command |
|---|---|
| `npm start` | `node ./bin/www` |

No `dev`, `test`, or `seed` scripts exist.

---

## API Reference

All routes return `Content-Type: application/json`. All error responses use the format:

```json
{ "message": "...", "error": {} }
```

In `development` mode (`NODE_ENV=development`), `error` contains the full error object.

---

### `GET /`

Serves `public/index.html`.

---

### `GET /users`

Placeholder stub. Returns the plain-text string `respond with a resource`.

---

### `POST /api/reconcile/medication`

Accepts conflicting medication records from multiple source systems and returns a reconciled medication with clinical reasoning.

**Request body:**
```json
{
  "patient_context": {
    "age": 67,
    "conditions": ["Type 2 Diabetes", "Hypertension"],
    "recent_labs": { "eGFR": 45 }
  },
  "sources": [
    {
      "system": "Hospital EHR",
      "medication": "Metformin 1000mg twice daily",
      "last_updated": "2024-10-15",
      "source_reliability": "high"
    },
    {
      "system": "Primary Care",
      "medication": "Metformin 500mg twice daily",
      "last_updated": "2025-01-20",
      "source_reliability": "high"
    },
    {
      "system": "Pharmacy",
      "medication": "Metformin 1000mg daily",
      "last_filled": "2025-01-25",
      "source_reliability": "medium"
    }
  ]
}
```

**Required fields:**
- `patient_context` — object (any shape; passed as clinical context to the model)
- `sources` — non-empty array. Each entry should include `system`, `medication`, and either `last_updated` or `last_filled`. `source_reliability` is optional but improves reasoning.

**Success response `200`:**
```json
{
  "reconciled_medication": "Metformin 500mg twice daily",
  "confidence_score": 0.88,
  "reasoning": "Primary care record is most recent clinical encounter...",
  "recommended_actions": [
    "Update Hospital EHR to 500mg twice daily",
    "Verify with pharmacist that correct dose is being filled"
  ],
  "clinical_safety_check": "PASSED"
}
```

| Field | Type | Description |
|---|---|---|
| `reconciled_medication` | string | Drug name, dose, and frequency |
| `confidence_score` | float 0.0–1.0 | 0.9–1.0 strong; 0.7–0.89 moderate; <0.7 low |
| `reasoning` | string | Full clinical rationale |
| `recommended_actions` | string[] | Follow-up actions |
| `clinical_safety_check` | string | `PASSED`, `WARNING`, or `FAILED` |
| `warning` _(if DB save failed)_ | string | `"Result could not be persisted to database. Please save this response manually."` |

**Error responses:**

| Status | Condition |
|---|---|
| `400` | `sources` missing/empty, or `patient_context` missing/not an object |
| `502` | OpenAI returned valid JSON but missing/malformed required fields (lists which fields) |
| `502` | OpenAI returned invalid JSON after one retry |
| `503` | Rate limited after 3 retries |
| `500` / `401` | Other OpenAI API errors |

---

### `POST /api/validate/data-quality`

Accepts a patient record and returns a data quality score with a breakdown across four dimensions and a list of detected issues.

**Request body:**
```json
{
  "demographics": { "name": "John Doe", "dob": "1955-03-15", "gender": "M" },
  "medications": ["Metformin 500mg", "Lisinopril 10mg"],
  "allergies": [],
  "conditions": ["Type 2 Diabetes"],
  "vital_signs": { "blood_pressure": "340/180", "heart_rate": 72 },
  "last_updated": "2024-06-15"
}
```

**Required fields:**
- `demographics` — object

All other fields (`medications`, `allergies`, `conditions`, `vital_signs`, `last_updated`) are optional but their absence affects scoring.

**Success response `200`:**
```json
{
  "overall_score": 62,
  "breakdown": {
    "completeness": 60,
    "accuracy": 50,
    "timeliness": 70,
    "clinical_plausibility": 40
  },
  "issues_detected": [
    {
      "field": "allergies",
      "issue": "No allergies documented - likely incomplete",
      "severity": "medium"
    },
    {
      "field": "vital_signs.blood_pressure",
      "issue": "Blood pressure 340/180 is physiologically implausible",
      "severity": "high"
    },
    {
      "field": "last_updated",
      "issue": "Data is 7+ months old",
      "severity": "medium"
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `overall_score` | integer 0–100 | Equal-weighted average of all four dimensions |
| `breakdown.completeness` | integer 0–100 | Presence of expected clinical fields |
| `breakdown.accuracy` | integer 0–100 | Physiological plausibility of values |
| `breakdown.timeliness` | integer 0–100 | Staleness relative to today's date |
| `breakdown.clinical_plausibility` | integer 0–100 | Drug-disease coherence |
| `issues_detected` | array | Each entry: `field` (string), `issue` (string), `severity` (`high`/`medium`/`low`) |
| `warning` _(if DB save failed)_ | string | `"Result could not be persisted to database. Please save this response manually."` |

**Timeliness scoring:**

| Age of record | Score range |
|---|---|
| 0–30 days | 90–100 |
| 31–90 days | 70–89 |
| 91–180 days | 50–69 |
| 181–365 days | 30–49 |
| Over 1 year | 0–29 |

**Error responses:** Same as `/api/reconcile/medication`.

---

## Prompt Engineering

### Medication Reconciliation (`reconcileService.js`)

**System prompt** establishes the model as a board-certified clinical pharmacist. Specifies four explicit weighting rules the model must apply:
1. Recency — most recently updated record has highest weight
2. Source reliability — `"high"` outweighs `"medium"` or `"low"` when dates are close
3. Pharmacy fill data — corroborating only, secondary to clinical encounters
4. Patient context — labs (e.g., eGFR) and conditions override dosing when indicated

**User prompt** is a structured text block with labelled sections:
- `PATIENT CONTEXT` — age, conditions, recent labs
- `MEDICATION SOURCES` — one block per source with system name, medication string, date, and reliability
- `TASK` — instruction to reconcile with today's date injected

The output schema is embedded directly in the system prompt so the model has explicit field names and value constraints before generating.

### Data Quality Assessment (`dataQualityService.js`)

**System prompt** establishes the model as a clinical informaticist. Contains the full scoring rubric inline:
- Completeness: which fields are expected and how missing/empty fields reduce the score
- Accuracy: specific physiological bounds for vital signs and demographics
- Timeliness: exact score ranges by staleness bracket
- Clinical plausibility: drug-disease appropriateness, major drug-drug interactions

The rubric lives in the prompt rather than in code so the model has explicit grounding rather than relying on training data for clinical norms.

**User prompt** sends each patient record field as a labelled text block with today's date injected for timeliness calculation.

---

## Error Handling Overview

### In-Memory Store error

The server initializes the in-memory array store immediately. On every request that reaches a store insert, if it fails:
- Error is logged: `[In-Memory Store] Failed to persist <ModelName>. Message: <message>`
- The AI result is still returned to the client
- A `warning` field is added to the response body

### OpenAI API key missing or empty

`bin/www` checks for the key before binding the HTTP server. If absent:
```
[FATAL] OPENAI_API_KEY is not set or is empty. Set it in Intern/.env and restart.
```
Process exits with code 1. No requests are accepted.

### OpenAI key invalid (401)

Surfaced immediately as an HTTP 401 to the client:
```json
{ "message": "OpenAI API call failed: Incorrect API key provided: ...", "error": {} }
```

### Rate limited (429)

Retried up to 3 times with exponential backoff (1 s → 2 s → 4 s). After exhaustion, returns 503.

### OpenAI returns invalid JSON

One full API retry. If still unparseable, returns 502:
```json
{ "message": "OpenAI returned invalid JSON after retry.", "error": {} }
```

### OpenAI returns JSON with missing or malformed fields

Schema is validated after parsing, before any DB write. Returns 502 with specifics:
```json
{
  "message": "OpenAI response was missing or malformed fields: confidence_score (must be a number between 0 and 1); reasoning (must be a non-empty string)",
  "error": {}
}
```

---

## Caching

None. No caching layer is implemented. Every request triggers a fresh OpenAI API call.

---

## Known Limitations

- `/users` route is a stub — returns a plain-text placeholder string.
- `jade` is declared as a dependency but is unused. It can be removed safely.
- No authentication or authorization on any route.
- No test runner or test files.
- `public/index.html` is a bare scaffold (`<h1>EHR App</h1>` only).

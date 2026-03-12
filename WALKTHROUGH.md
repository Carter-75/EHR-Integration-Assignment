# Project Walkthrough: EHR Clinic Dashboard & API

## High-Level Overview

**What this project does**
This project is an Electronic Health Records (EHR) web application and Application Programming Interface (API) designed to help clinicians make data-driven decisions. It takes patient medical data that is often messy or conflicting (like having two different hospital records for the same patient) and uses Artificial Intelligence (AI) to clean it up. Specifically, it can look at a list of medications from different doctors, intelligently figure out the real current dosage, and also grade a patient's medical file to see how complete and accurate it is.

**The Technology Stack**
*   **React (Frontend Framework):** A JavaScript library for building User Interfaces (UIs). It exists to create the interactive dashboard where doctors plug in data and see results instantly without reloading the page.
*   **Vite (Frontend Tooling):** A build tool that compiles the React code extremely fast and serves it locally during development.
*   **Node.js & Express (Backend):** Node.js is a runtime that lets us run JavaScript on the server. Express is a framework on top of Node.js that listens for internet requests (Hypertext Transfer Protocol or HTTP requests) and routes them to the right code block. It exists to separate the sensitive logic (talking to the AI) from the browser.
*   **OpenAI GPT-4o (AI Layer):** A Large Language Model (LLM) over an external API. It acts as the "brain," running clinical reasoning based on prompts we construct in the backend.
*   **Vitest (Testing):** A testing framework that programmatically runs our code and checks if it behaves as expected. It ensures we don't accidentally break things when adding new features.
*   **Docker:** A tool that packages all this software into standardized containers so it runs identically on any computer.

**How the System Flows (Visual Map)**

```
[ Clinician / User ] 
       │
       ▼ (Clicks "Run Reconciliation" in Browser)
[ React Frontend UI ] 
       │
       ▼ (Sends JSON data via POST Request)
[ Express Backend (Routes) ] 
       │
       ▼ (Validates data, passes to Service Layer)
[ Backend Services ] 
       │
       ▼ (Builds a prompt string with medical rules)
[ OpenAI API (External) ]
       │
       ▼ (Returns structured JSON recommendation)
[ Backend Services ]
       │
       ▼ (Validates AI schema, passes to Route)
[ In-Memory Store & Route ]  ---> (Saves audit copy to RAM)
       │
       ▼ (Sends HTTP 200 JSON Response)
[ React Frontend UI ]
       │
       ▼ (Renders Confidence Gauge and Reasoning)
[ Clinician / User ]
```

**How Everything Relates**
The frontend provides the forms and visualizations. When a user submits data, the frontend calls the backend API. The backend receives this data, formats it into a highly specific piece of text (a prompt), and sends it to the AI. The AI returns a decision. The backend then saves a permanent copy of this request-and-response pair into an in-memory store (a volatile database held in RAM) and finally passes the result back to the frontend to draw on the screen.

---

## How a Request Travels Through the System

Let's trace a Medication Reconciliation request.

1.  **User Action:** A clinician enters patient details into the `MedicationReconciliation.jsx` component and clicks "Run Reconciliation".
2.  **Duplicate Check:** Before sending, `detectDuplicates` (in `duplicateDetection.js`) checks if there are clearly identical drugs. If yes, it shows a warning. If the user clicks "Submit Anyway", it proceeds.
3.  **Frontend API Call:** The `api.reconcileMedication` function (in `api.js`) is called. It retrieves the OpenAI API key from Local Storage and attaches it as an `Authorization` header, formatting the patient data into a JSON (JavaScript Object Notation) payload, and sending it via a `POST` network request to the backend.
4.  **Backend Route Handling:** The Express server receives the request at `medication.js` (`POST /api/reconcile/medication`). The route handler verifies the body has `sources` and `patient_context`. 
5.  **Service Layer & AI:** The route calls `reconcileService.reconcileMedications`. This service converts the JSON input into a literal string of text (the user prompt) describing the medications. It pairs this with a system prompt (instructions on how to be a clinical pharmacist) and calls `openaiService.callOpenAI`.
6.  **AI Invocation:** `openaiService` sends the prompts to OpenAI, requesting a JSON object in return. If it hits an error or rate limit, it automatically waits and tries again (exponential backoff).
7.  **Data Validation:** Once the AI responds, `openaiService.validateReconciliationResult` ensures every required field (like `confidence_score` and `reasoning`) is present. If it fails, the server asks OpenAI again or throws an error (HTTP 502 Bad Gateway).
8.  **Data Persistence:** The route handler creates an audit record combining the input and output. It uses `ReconciliationResult.push(record)` to save it to our in-memory array database.
9.  **Response:** The Express route responds to the frontend with an HTTP 200 OK status containing the AI results.
10. **Frontend Rendering:** `MedicationReconciliation.jsx` receives the payload. It then passes the raw confidence score to `calibrateConfidenceScore` (in `calibration.js`) which adjusts the score mathematically based on source dates. Finally, it passes this data to `ConfidenceGauge.jsx` and re-renders the screen. If a webhook is configured in Local Storage, clicking approve/reject fires off a message via `webhook.js`.

---

## How the AI Integration Works

The AI layer relies entirely on the OpenAI Chat Completions API.
*   **Prompts:** We don't just send raw data. We use "prompt engineering." Our backend has hardcoded "System Prompts" that explicitly instruct the AI to act as a clinical pharmacist or informaticist. These prompts contain exact rules (e.g., "Weighting rules you MUST apply: Recency"). 
*   **JSON Enforcement:** The prompts explicitly command the AI to reply *only* in a specific JSON schema, avoiding conversational filler. We also pass `response_format: { type: 'json_object' }` to the OpenAI client to guarantee parsable code.
*   **Validation:** LLMs can hallucinate (make things up) or skip constraints. Our code manually checks the AI's JSON keys before accepting the response. 
*   **Caching:** Caching means storing previous answers so if you ask the exact same question again, you don't have to query the external server, saving time and money. This project explicitly has **no caching layer**. Every click results in a brand-new API call to OpenAI.

---

## How the In-Memory Database Works

An In-Memory Database stores data in the computer's Random Access Memory (RAM) rather than on a physical hard drive (like a standard SQL database).
*   **Implementation:** In this project, it is literally just an empty JavaScript array exported from a file (e.g., `module.exports = [];`). 
*   **How it is used:** Every time a valid API request completes, we `push()` an object representing the data into this array. 
*   **Tradeoff:** It is incredibly fast and requires absolutely no setup, making it perfect for rapid prototyping. However, the exact moment the Node.js server shuts down or restarts, all data is instantly and permanently destroyed because RAM is volatile memory. 

---

## How the Tests Are Structured

Testing is how we programmatically prove our code works. This project uses **Vitest**, a test runner.
*   **Frontend Logic Tests:** Files like `calibration.test.js` simply import a math function and feed it fake data, using `expect(result).toBe(...)` to verify the output matches expectations.
*   **Component Tests:** Files like `Validation.test.jsx` use a simulated DOM (Document Object Model) to render React components invisibly. The test clicks buttons programmatically and checks if the correct error text appears.
*   **Backend Node Tests:** Files like `reconcileService.test.js` import the backend service files directly within the test environment. Because we don't want to actually spend money calling OpenAI during automated tests, we use a concept called "Mocking." We use `vi.spyOn` to intercept the call to `openaiService.callOpenAI` and forcefully return a fake JSON response. We then verify our internal application logic handles that response properly. 
*   **Running the suite:** You can run all tests by entering the `frontend/` folder and typing `npx vitest run`.

---

## How Everything Connects — Full Dependency Map

*This is a simplified logical tree showing what relies on what:*
```
[React App - main.jsx]
  └── App.jsx
       ├── index.css (Global Styles)
       ├── ApiKeyPrompt.jsx (Global State Gate)
       ├── DataQuality.jsx (Page)
       │    ├── api.js (Network Calls -> Calls Backend /api/validate/data-quality)
       │    └── thresholds.js (Color Logic)
       ├── MedicationReconciliation.jsx (Page)
       │    ├── api.js (Network Calls -> Calls Backend /api/reconcile/medication)
       │    ├── ConfidenceGauge.jsx (UI)
       │    ├── duplicateDetection.js (Pre-flight check)
       │    ├── calibration.js (Post-flight adjustment)
       │    └── webhook.js (Notification hook)
       └── WebhookConfig.jsx (Page)

[Express Backend - server.js]
  └── app.js (Express Setup)
       ├── routes/index.js (Serves Frontend)
       ├── routes/medication.js
       │    ├── models/ReconciliationResult.js (Array pushing)
       │    └── services/reconcileService.js
       │         └── services/openaiService.js (External API to OpenAI)
       └── routes/data.js
            ├── models/DataQualityResult.js (Array pushing)
            └── services/dataQualityService.js
                 └── services/openaiService.js (External API to OpenAI)
```

---

## Per-File Sections: Backend Core

### EHR/src/app.js

**What this file is**
The configuration file that creates and sets up the Express web server framework.

**What it does**
It defines the middleware (code that runs between receiving a request and sending a response) for the application. It parses incoming JSON data and wires up the routing files so that specific URLs direct to specific code blocks.

**How it does it**
*   `express()` initializes the application object.
*   `app.use(logger('dev'))` enables a request logger (Morgan) so that every network call prints cleanly in the terminal.
*   `app.use(express.json())` configures the app to automatically translate raw incoming HTTP body strings into useable JavaScript Objects.
*   `app.use('/', indexRouter)`, `app.use('/', medicationRouter)`, and `app.use('/', dataRouter)` inform the app that any request starting with `/` should be checked against the routes defined in those files.
*   The final `app.use` is a "catch-all" error handler. If no route matches or a route crashes, this block catches the error and sends an HTTP 500 error code with a JSON response, preventing the server from crashing entirely.

**How it connects**
This file imports routes from `EHR/src/routes/medication.js`, `EHR/src/routes/data.js`, and `EHR/src/routes/index.js`. Once set up, it passes the configured `app` object out using `module.exports` so that `server.js` can actually turn it on.

**Key concepts to understand**
*Middleware pattern:* The concept of passing an HTTP request through a chain of functions sequentially before responding. 
*Express.js app object:* The core HTTP router standard for Node.js.

---

### EHR/src/server.js

**What this file is**
The main entry point script that physically starts the web server listening for internet traffic.

**What it does**
It acts as the launch button for the backend. First, it loads environment variables (like API keys) safely. Then, it checks if the OpenAI key exists. If so, it takes the configured `app.js` and fires up the HTTP listener on port 3000.

**How it does it**
*   `require('dotenv').config(...)` reaches up a folder to find the hidden `.env` file and loads its contents into Node's `process.env` memory. 
*   `if (!process.env.OPENAI_API_KEY)` is a safety check. If the required secret key is missing, it calls `process.exit(1)`, killing the server immediately before it even tries to boot.
*   `var port = normalizePort(...)` ensures the `PORT` variable is a valid number.
*   `var server = http.createServer(app)` wraps the Express logic from `app.js` inside native Node.js HTTP listeners.
*   `server.listen(port)` opens the network socket on your computer so browsers can connect.

**How it connects**
This file imports `EHR/src/app.js`. It is completely standalone — nothing imports `server.js`; instead, you run `node server.js` from the command line to string the whole backend together.

**Key concepts to understand**
*Environment variables (`.env`):* Secure settings stored outside of source control so developers don't accidentally leak secret passwords to the public internet.

---

### EHR/src/models/ReconciliationResult.js

**What this file is**
A temporary, volatile storage container for medication reconciliation audit records.

**What it does**
It acts as an "in-memory database" for the app. Instead of talking to a real, complex database like PostgreSQL or MongoDB, this file provides a simple JavaScript array to hold records.

**How it does it**
*   `module.exports = [];` simply returns an empty array when the file is imported.

**How it connects**
It is imported by `EHR/src/routes/medication.js`. When the medication route successfully completes an AI call, it pushes the results into this array.

**Key concepts to understand**
*In-memory data structures:* Variables held in RAM that disappear when the script stops running, used here as a placeholder for a permanent database.

---

### EHR/src/models/DataQualityResult.js

**What this file is**
A temporary, volatile storage container for data quality assessment audit records.

**What it does**
Similar to `ReconciliationResult.js`, it acts as an in-memory database to store raw patient inputs alongside AI scores.

**How it does it**
*   `module.exports = [];` exports a simple array list to the application.

**How it connects**
Imported strictly by `EHR/src/routes/data.js` to persist data quality AI responses.

**Key concepts to understand**
*State persistence:* How software attempts to save data beyond the lifespan of a single HTTP request.

---

### EHR/src/routes/index.js

**What this file is**
A base route handler intended to serve static frontend files.

**What it does**
It intercepts any request to the root URL `/` and sends back the HTML shell of our React Frontend.

**How it does it**
*   `router.get('/', function(...)` registers a listener for `GET` requests directly against the root domain.
*   `res.sendFile(...)` calculates the file path to `public/index.html` and streams that file directly to the browser. 

**How it connects**
Imported by `EHR/src/app.js` and mounted to the `/` root.

**Key concepts to understand**
*Single Page Application (SPA) Serving:* The practice of having a backend server deliver a single blank HTML file to start a React app that then populates the screen itself using JavaScript.

---

### EHR/src/routes/medication.js

**What this file is**
The medication reconciliation API endpoint that orchestrates the flow of data between the frontend, the AI, and the database.

**What it does**
It receives incoming patient context and a list of conflicting medications from the browser. It ensures the data is valid, asks the AI service to resolve the conflicts, saves the result, and returns the AI's decision to the browser.

**How it does it**
*   `router.post('/api/reconcile/medication', async function(req, res, next)` creates an asynchronous endpoint to handle data creation.
*   It immediately checks if `req.body` contains `sources` and `patient_context`. If not, it uses `res.status(400)` (Bad Request) to tell the frontend it sent invalid data.
*   `await reconcileService.reconcileMedications(body)` delegates the complex AI prompting to a dedicated service folder. We `await` because calling OpenAI takes time (network delay).
*   `openaiService.validateReconciliationResult(result)` confirms OpenAI followed instructions and returns `schemaError` if something is missing. If it is broken, we pass the error using `next(validationErr)`.
*   A try/catch block creates a `record` object and calls `ReconciliationResult.push(record)`. If pushing to the array throws a random error, it logs the failure but crucially still sends the AI data back so the doctor isn't left empty-handed.
*   `res.status(200).json(...)` returns the finalized JSON file to the user.

**How it connects**
It is attached to the main server in `EHR/src/app.js`. It depends heavily on `reconcileService.js` for logic, `openaiService.js` for validation, and `ReconciliationResult.js` for storage.

**Key concepts to understand**
*REST conventions:* Using standard URLs and HTTP methods (`POST` for creation) to design logical software boundaries.
*Async/Await:* JavaScript syntactic sugar to pause code execution until a slow process (like reaching out to an external server) finishes executing.

---

### EHR/src/routes/data.js

**What this file is**
The data quality assessment API endpoint that grades how complete a patient's record is.

**What it does**
It acts identically to `medication.js` but explicitly focuses on receiving raw patient demographics and condition files, grading them via AI, preserving to storage, and sending the score breakdown back.

**How it does it**
*   `router.post('/api/validate/data-quality', async function(...)` creates the path.
*   Verifies the incoming `req.body` contains the `demographics` object.
*   `await dataQualityService.assessDataQuality(body)` requests the AI calculation.
*   Validates the result using `validateDataQualityResult(result)`.
*   Pushes the parsed data into `DataQualityResult` structure.
*   Sends the results back safely with a 200 HTTP code.

**How it connects**
Wired into `EHR/src/app.js`. Calls `dataQualityService.js` and saves to `DataQualityResult.js`.

**Key concepts to understand**
*Status Codes:* The difference between a 200 (OK), 400 (Bad Request from the user), and 502 (Bad Gateway from OpenAI).

---

## Per-File Sections: Backend Services & Architecture

### EHR/src/services/openaiService.js

**What this file is**
The core integration layer that handles all network communication with OpenAI's API.

**What it does**
It provides a single place for the backend to talk to the AI. It safely retrieves the secret API key, constructs a correctly formatted chat request using `gpt-4o`, handles network failures or rate limits (when the server tells you to slow down), and enforces strict rules on the JSON data that comes back. 

**How it does it**
*   `getClient()` is a "singleton" pattern setup. It prevents creating the OpenAI client configuration thousands of times and throws a clear error if the API key is secretly missing.
*   `attemptCall(systemPrompt, userPrompt)` is the raw networking function. It explicitly sets `response_format: { type: 'json_object' }` and lowers the AI "creativity" map `temperature: 0.2` so that the AI thinks more logically and identically every time rather than creatively guessing code parameters.
*   `callOpenAI(systemPrompt, userPrompt)` is a wrapper around the attempt call. It uses a `while (attempt <= maxRetries)` loop with `await sleep(delay)` inside. If the API returns a 429 error (Too Many Requests), this creates "exponential backoff" (waiting 1 second, then 2, then 4) instead of hammering the broken connection. It also features a try/catch specifically parsing the JSON; if the AI returns broken text, it instantly retries the request behind the scenes.
*   `validateReconciliationResult` and `validateDataQualityResult` manually inspect the parsed JSON objects. They loop through required field names (like `confidence_score` or `overall_score`) and push error strings if the AI missed one. If everything is perfect, they proudly return `null`, greenlighting the route handler to save to the database.

**How it connects**
It is heavily imported by `dataQualityService.js` and `reconcileService.js` every time a user invokes an AI route. It requires the `openai` external dependency package to exist. 

**Key concepts to understand**
*Exponential Backoff:* An algorithm that spaces out repeated network retries increasingly longer to let an overloaded server recover.
*Singleton Pattern:* Ensuring a memory-heavy object or global configuration is only instantiated exactly one time.

---

### EHR/src/services/dataQualityService.js

**What this file is**
The natural language constructor that translates a patient's record into a highly specific instructions file for the AI's data grading tools.

**What it does**
It defines the strict grading rubric (points mapping to exact days stale) and the specific definitions for an issue's severity ("high" vs "medium"). It then takes the messy incoming JSON data, structures it into legible text, and asks the AI to evaluate it against the rubric.

**How it does it**
*   `SYSTEM_PROMPT` is a permanent, static block of instructional text. It acts as the core ruleset constraint. By hardcoding "Score based on timeliness: 0-30 days old = 90-100", it removes ambiguity so the AI doesn't guess what "timely" means.
*   `buildUserPrompt(body)` dynamically takes the request payload and pulls out demographics, medications, allergies, and conditions. If a field like allergies is null, it hardcodes "Not provided" into the string so the AI scores it as incomplete. 
*   `new Date().toISOString()` computes today's literal date so the AI can do the math on how old a patient's record is.
*   `assessDataQuality(body)` packages creating the user prompt and passing it along with the system prompt to `openaiService.callOpenAI`.

**How it connects**
Imported by `EHR/src/routes/data.js` to begin evaluating the network data. Requires `EHR/src/services/openaiService.js` to execute the actual heavy lifting.

**Key concepts to understand**
*Prompt Chaining / System Instructions:* Giving a language model fixed behavior rules (System) that apply rigidly over changing dynamic inputs (User).

---

### EHR/src/services/reconcileService.js

**What this file is**
The conversational constructor that forces the AI to safely reconcile different medication sources using strict clinical guidelines.

**What it does**
It ensures that when a patient has multiple conflicting medication records (like one dose from the hospital and a different dose from their primary care doctor), the AI weighs factors like recency and the patient's organic body functions (like kidney labs) to declare the best single drug choice safely.

**How it does it**
*   `SYSTEM_PROMPT` mandates four explicit rules: Recency, Source reliability, Pharmacy fill data, and Patient context. This prevents dangerous generic assumptions. It also enforces the specific final JSON schema requirement.
*   `buildUserPrompt(body)` loops over the `body.sources` array, building an isolated block of text for each source and numbering them (`Source 1`, `Source 2`). It injects patient `recent_labs` (specifically targeting kidney eGFR scores) directly into the AI's context.
*   `reconcileMedications(body)` packages the static system prompt and the dynamic user prompt, firing them to `openaiService`.

**How it connects**
Imported by `EHR/src/routes/medication.js`. Drives the core clinical logic before calling `openaiService.js`.

**Key concepts to understand**
*Declarative Validation:* Explicitly teaching a system how to handle edge cases before it evaluates raw data.

---

## Per-File Sections: Docker Architecture

### docker-compose.yml

**What this file is**
The orchestrator blueprint that lets you start both the frontend and backend simultaneously using a single command. 

**What it does**
It defines "services" (mini isolated generic computers). It dictates that `backend` runs from the `EHR` folder and maps internal port `3000` to your computer's port `3000`. It dictates that `frontend` runs from the `frontend` folder, maps to port `4173`, and *depends* on the backend to finish starting first before trying to connect. 

**How it does it**
*   `version: '3.8'` defines the syntax standard.
*   Under `backend:`, `build: context: ./EHR` defines where the source code lives.
*   `depends_on: - backend` ensures that Docker sequences the startup process so the UI doesn't crash trying to hit a sleeping API.

**How it connects**
It lives in the project root and is executed via `docker-compose up --build` in your terminal. It points to the Dockerfiles. 

**Key concepts to understand**
*Container orchestration:* Managing the deployment, routing, and scaling of multiple isolated application containers.

---

### Dockerfile.backend

**What this file is**
The exact assembly instructions for creating a custom, runnable image for the Express Node server.

**What it does**
It tells Docker exactly how to build an isolated mini-computer from scratch that has everything needed to run the API, but absolutely nothing extra that could bloat or expose it.

**How it does it**
*   `FROM node:20-alpine` downloads an incredibly small version of Linux that comes with Node.js version 20 pre-installed.
*   `WORKDIR /app` sets the current folder.
*   `COPY package*.json ./` creates a layer caching the project's dependencies list.
*   `RUN npm install` silently installs all the required server code.
*   `COPY . .` grabs the rest of the actual logic like `server.js`.
*   `CMD ["npm", "start"]` sets the final executable instruction when someone actually says "Run this container". 

**How it connects**
Only used when `docker-compose.yml` calls for it, or when someone manually types `docker build`. Located in the root directory.

**Key concepts to understand**
*Containerization:* Packaging code explicitly so it is fully agnostic to the Host OS (it works on Windows, Mac, or Linux identically).

---

### Dockerfile.frontend

**What this file is**
The exact assembly instructions for creating a custom, runnable image for the React application.

**What it does**
Very similar to the backend Dockerfile, but specifically tuned to build (compile) a modern frontend and serve it using Vite's static file preview server.

**How it does it**
*   Installs dependencies similarly (`RUN npm install`).
*   `RUN npm run build` invokes Vite to compile all the React JSX files, CSS, and JS into single, minified, production-ready static assets.
*   `CMD ["npm", "run", "preview", "--", "--host"]` tells Vite to act as a web server, safely delivering those minified static assets to browsers that request port `4173`, listening to all network traffic inside the container via `--host`.

**How it connects**
Only referenced by `docker-compose.yml` to build the `frontend` container element.

**Key concepts to understand**
*Static Bundling:* React applications are just advanced build scripts. Browsers don't natively fully understand JSX syntax. The app is "built" into raw standard HTML/JS before it is served.

---

## Per-File Sections: Frontend Architecture & Utilities

### frontend/src/main.jsx

**What this file is**
The absolute very first file that the React application runs when the browser loads the page.

**What it does**
It hooks the React JavaScript code directly into the raw HTML structure of the webpage. Without this file, React would just be floating logic; this file explicitly grabs the `<div id="root">` element inside `index.html` and forces React to render the `App` component inside it.

**How it does it**
*   `ReactDOM.createRoot(document.getElementById('root'))` tells React exactly which HTML box to control.
*   `.render(<React.StrictMode><App /></React.StrictMode>)` takes the entire application logic built inside `App.jsx` and draws it on screen. `StrictMode` is a tool that causes React to intentionally render things twice in development to hunt down hidden bugs.

**How it connects**
Imports `App.jsx` as the master component and `index.css` to load the global styling variables.

**Key concepts to understand**
*The Virtual DOM:* React doesn't build raw HTML immediately. It builds a virtual layout, compares it to the real browser screen, and mathematically calculates the fastest way to update changes.

---

### frontend/src/App.jsx

**What this file is**
The core traffic controller and layout frame for the entire user interface.

**What it does**
It creates the sticky header bar (the title and navigation links) and keeps track of which "tab" or "page" the user is currently looking at. It also actively guards the app; if you haven't plugged in an OpenAI API key, it forces a popup dialog before letting you see any of the clinical tools.

**How it does it**
*   `const [hasKey, setHasKey] = useState(false)` creates a memory slot called state. The whole screen re-draws automatically whenever `setHasKey` is called.
*   `useEffect` runs exactly once when the page loads. It checks `localStorage` (the browser's long-term memory) to see if you saved an api key yesterday.
*   `const navItemStyle` is a function that changes the border color of the tabs depending on if `currentTab === tabId`, creating the visual illusion of clicking folders.
*   It uses conditional rendering (`{currentTab === 'reconcile' && <MedicationReconciliation />}`) to instantly swap out what component is drawing the center of the screen without loading a new webpage.

**How it connects**
Imports the three main page components (`MedicationReconciliation.jsx`, `DataQuality.jsx`, `WebhookConfig.jsx`) and the `ApiKeyPrompt.jsx` security gate. 

**Key concepts to understand**
*React State & Effect hooks:* Variables that trigger an instant screen redraw when their values change, and functions that run automatically when components appear.

---

### frontend/src/services/api.js

**What this file is**
The central dispatcher for all external network requests leaving the browser.

**What it does**
It packages the clinician's raw typed data into proper HTTP format, grabs the secret API key from the browser's storage, and physically fires the network shot at our Express Backend. If it breaks, it catches the error and throws an `ApiError`.

**How it does it**
*   `fetchWithAuth(endpoint, options)` is a custom wrapper around the standard browser `fetch` tool. It intercepts the request to inject `'Authorization': Bearer ${apiKey}` before the packet leaves your laptop.
*   `if (!response.ok)` catches 4XX or 5XX status codes and attempts to parse the payload safely so the screen can display "Rate Limited" instead of instantly crashing. 
*   `export const api` bundles two ready-to-use asynchronous actions: `reconcileMedication` and `validateDataQuality`.

**How it connects**
Imported by both page components whenever they need to talk to the backend. It targets `localhost:3000` (or whatever `VITE_API_URL` dictates).

**Key concepts to understand**
*Fetch API and Promises:* Asking an external computer for data is non-instant, necessitating a "Promise" to handle the data whenever it eventually answers.

---

### frontend/src/services/webhook.js

**What this file is**
An auxiliary networking layer that fires off real-time notifications when a clinician makes a decision.

**What it does**
If the clinic has registered a special notification URL (like a slack alert or an internal hospital logging system), this code shoots the finalized AI recommendation directly to them the moment the doctor clicks "Approve" or "Reject".

**How it does it**
*   `export async function notifyWebhook(url, payload)` constructs a standard HTTP POST request.
*   It explicitly sets `mode: 'no-cors'`. This allows the browser to send data across the internet to completely unknown servers without hitting security lockdown blocks (Cross-Origin Resource Sharing rules), guaranteeing the alert transmits.

**How it connects**
Imported by `MedicationReconciliation.jsx` and fired exactly when the `handleDecision` button is pushed.

**Key concepts to understand**
*Webhooks:* Instead of repeatedly asking "Did anything happen?", a webhook is a system that automatically shouts "Hey, this just happened!" to a preset address.

---

### frontend/src/utils/calibration.js

**What this file is**
A mathematical post-flight adjustment engine for the raw AI confidence score.

**What it does**
AI models can sometimes be wildly overconfident. This utility acts as a safety harness. It intercepts the score OpenAI returned and recalculates it based on hard, deterministic rules like: "If the newest chart is over 6 months old, the confidence score drops down regardless of what the AI claimed."

**How it does it**
*   `calibrateConfidenceScore` creates a four-part `breakdown` with hardcoded weights (e.g., `weight: 0.3` for Recency).
*   It runs a `sources.forEach` loop to calculate `daysDiff` using raw date math. Older dates drag the multiplier toward 0.3.
*   It calculates `highestRel` by mapping the string words ("high", "low") to integers (1.0, 0.2).
*   It finally returns an aggregated weighted average of `score = (breakdown.recency.score * breakdown.recency.weight) + ...` 

**How it connects**
Called by `MedicationReconciliation.jsx` immediately after the network call answers but before the screen draws the UI gauge.

**Key concepts to understand**
*Deterministic heuristics:* Hardcoded mathematical rules that act as guardrails against unpredictable AI variance.

---

### frontend/src/utils/duplicateDetection.js

**What this file is**
A pre-flight safety scanner that prevents users from submitting logically broken data.

**What it does**
Instead of spending money processing AI requests where the doctor accidentally typed the exact same medicine twice, this algorithm scans the data locally in the browser. Before the request leaves the laptop, it flags duplicate rows.

**How it does it**
*   `const duplicates = []` holds the problematic arrays.
*   A nested `for` loop (an $O(n^2)$ operation) checks every single row `i` against every remaining row `j`.
*   `const drugNameA = nameA.split(' ')[0]` breaks down "Metformin 500mg" into just the root word "Metformin" so it can detect collisions even if the dosage string isn't identical.
*   A `handled` Set guarantees that if three things are duplicate, it groups them efficiently rather than flagging pairs multiple times.

**How it connects**
Called when the user clicks Submit on the reconciliation page. The response dictates whether the app halts with a warning or proceeds to the network.

**Key concepts to understand**
*Set Theory & Lookup Performance:* Using a `Set` object (like `handled.has()`) which allows instantaneous deduplication lookups rather than repeatedly looping through arrays.

---

## Per-File Sections: Frontend Pages, Components & Tests

### frontend/src/pages/MedicationReconciliation.jsx

**What this file is**
The primary user interface page for the Medication Reconciliation tool.

**What it does**
It provides all the text boxes, dropdowns, and buttons for a clinician to input medical profiles. It ties all the data together, manages the complex loading states, calls the API, and then elegantly renders the result with a big gauge chart and "Approve/Reject" buttons.

**How it does it**
*   It initializes massive block arrays using `useState` bindings. `const [sources, setSources]` physically holds the form data. Every keystroke updates this object instantly.
*   `handleSourceChange(index, field, value)` locates the specific row you are typing in and modifies it without wiping out the rest of the arrays.
*   `validate()` is a strict client-side gatekeeper. It throws `validationErrors` directly onto the DOM if you try to submit blank dates.
*   `handleRun(e, ignoreDuplicates)` catches the "Submit" click. It invokes `detectDuplicates`. If the user says "Submit Anyway," it skips the block, flips `setLoading(true)` so the button physically greys out, calls `api.reconcileMedication`, runs the `calibrateConfidenceScore` modifier, and stores everything in `setResult`.
*   The final return block creates JSX (HTML inside Javascript) mixing map iterations (`sources.map`) to draw infinite rows of inputs based on array size.

**How it connects**
Imported by `App.jsx`. It acts as the glue unifying `duplicateDetection.js`, `calibration.js`, `api.js`, `webhook.js`, and `ConfidenceGauge.jsx`.

**Key concepts to understand**
*Controlled Components:* In React, input text boxes aren't read at the end like standard HTML. Instead, every keystroke overrides the component's state, and the state forces the text box to display its new value. 

---

### frontend/src/pages/DataQuality.jsx

**What this file is**
The user interface dashboard for assessing the structural health of a patient's medical file.

**What it does**
It presents a large input form collecting demographics and physiological records. Once submitted, it renders a high-level `Overall Score/100` alongside individual breakdown metrics, and maps out any errors detected by the AI in a clean alert list. 

**How it does it**
*   Constructs a giant form data object linked via `onChange={e => setFormData({...formData, x: e.target.value})}`.
*   `handleRun` constructs an intricate custom JSON object payload matching the backend schemas explicitly (converting raw string arrays via `formData.allergies.split(',').map(...)`).
*   `renderScoreIndicator` is a sub-component tool directly inside the file that automatically grabs the correct color coding (Red, Yellow, Green) from the `thresholds.js` file based on the raw integer score.
*   A mapping loop displays every issue inside `result.issues_detected` using pill-shaped badges for High/Medium/Low priority.

**How it connects**
Imported by `App.jsx`. Tied directly to `api.js` and `thresholds.js`.

**Key concepts to understand**
*Payload Transformation:* Taking raw comma-separated user strings and parsing them into strictly validated backend JSON matrices before transmission.

---

### frontend/src/components/ConfidenceGauge.jsx

**What this file is**
A reusable visual component that draws the dynamic percentage bar.

**What it does**
It takes the mathematics from the AI confidence score and uses raw CSS styling to visually represent trust levels to the end user. If trust is high, the bar fills with green; if it is low, the bar shrinks and turns stark red to warn the doctor.

**How it does it**
*   Accepts `score` and `breakdown` arrays injected as props. Props are variables pushed downward from a parent component.
*   Uses a simple CSS trick: `<div style={{ width: percentage + '%' }} />` to draw the horizontal bar length based on the `score` number.
*   It injects classnames (`bg-red`, `text-yellow`) strictly tied to the percentage thresholds (under 50 = red, under 70 = yellow) to change the actual colors visually using styling from `index.css`.
*   Utilizes the native HTML `<details>` and `<summary>` tags to make an accordion menu the user can click to expand and see the calibration math.

**How it connects**
Imported strictly by `MedicationReconciliation.jsx` to render the final response.

**Key concepts to understand**
*Component composition (Props):* The ability to write an isolated chunk of visual UI that takes parameters globally like a standard function.

---

### frontend/src/pages/WebhookConfig.jsx and ApiKeyPrompt.jsx

**What these files are**
Utility UI overlays handling global application configurations stored externally.

**What they do**
They allow the application to accept setup secrets (API keys and URL paths) and persist them locally so they survive browser refreshes.

**How they do it**
*   They rely exclusively on standard browser functions like `localStorage.setItem('key', value)` and `localStorage.getItem('key')`. 
*   `ApiKeyPrompt.jsx` uses absolute positioning CSS styles (`z-index: 1000`) to completely hijack the user screen with a darkened translucent background, physically preventing you from clicking the app behind it until it secures a valid key.

**How they connect**
Imported by `App.jsx`, which strictly halts app propagation via an `if/else` block based on their inputs.

**Key concepts to understand**
*Browser Storage:* The permanent local keystore embedded in all modern web browsers that doesn't rely on cookies or external databases.

---

### frontend/src/index.css

**What this file is**
The global styling parameter file for the entire project.

**What it does**
It defines the exact hex colors, shadows, radii, and fonts used globally. By defining them natively in `:root`, if we ever want to change the primary brand color from Blue to Purple, we change one line here and the entire app updates simultaneously.

**How it does it**
*   `:root { --primary-color: #2b6cb0; }` defines "css variables". 
*   Below that, class maps like `.btn-primary { background-color: var(--primary-color) }` map those exact variables to reusable text names that any React element can invoke simply by slapping `className="btn-primary"` onto a block.

**How it connects**
Imported exactly once at the absolute very top level of the ecosystem (`main.jsx`).

**Key concepts to understand**
*CSS Variables (Custom Properties):* Centralizing color parameters specifically to avoid hardcoding exact fonts and hex numbers repetitively thousands of times across massive apps.

---

### Test Files (Overview)

The project includes five unique test files executing across both server-like Logic flows and simulated DOM user interfaces.

*   `__backend_tests__/dataQualityService.test.js` & `__backend_tests__/reconcileService.test.js`
    These files use Native Node environments (using `require()`) and Mock modules via `vi.spyOn`. They artificially block outward network requests to OpenAI and intercept the function call inside the Express backend directly, replacing it with fake static JSON. This verifies the actual routes work without paying for AI credits. 
*   `utils/calibration.test.js` & `utils/duplicateDetection.test.js`
    Pure math tests. They run loops pushing complex boundary logic arrays through the post-flight calculator utilities and check if outputs stay within $>= 0.0$ and $<= 1.0$, throwing an automatic error if a score generates a bug like `1.2` or negative outputs.
*   `pages/Validation.test.jsx`
    A UI Interaction Test. It uses `@testing-library/react`. It literally renders `MedicationReconciliation` virtually in the background and simulates a robotic mouse clicking `fireEvent.click(screen.getByText('Run'))`. It confirms the app halts execution and successfully blocks the attempt to submit without an Age parameter inputted. 


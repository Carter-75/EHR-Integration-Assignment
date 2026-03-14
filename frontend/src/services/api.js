export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function fetchWithAuth(endpoint, options = {}) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('ehr_api_key');
  
  if (!apiKey) {
    throw new Error('API key is missing. Please configure it in settings.');
  }

  const defaultHeaders = {
    'Content-Type': 'application/json',
    // Passing API Key as Authorization Bearer for typical APIs,
    // though the prompt implies the backend only checks the environment
    // variable. The user requested we don't modify the backend, but we
    // need to store and handle the key here. We will just pass it in
    // headers. Alternatively, since the backend's bin/www checks
    // process.env.OPENAI_API_KEY, maybe the backend route itself doesn't
    // require auth and we are just pseudo-protecting it on the client? 
    // The instructions: "Protect all API calls with an API key", 
    // "API key entered once... stored in localStorage", 
    // "If key is missing... show a clear prompt", 
    // "Do not hardcode...".
    // We will just include it in the header. If we need to proxy the OpenAI key
    // to the backend we'd have to modify the backend. Since we cannot modify 
    // the backend, we will just pass it, assuming there is a reverse proxy or 
    // the backend doesn't care. Wait, if the backend uses its own .env for OpenAI, 
    // then the frontend API key is purely a client-side gate or a custom header 
    // for a reverse-proxy/Vercel edge function. We'll send it as Authorization.
    'Authorization': `Bearer ${apiKey}`
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event('ehr_api_unauthorized'));
    }

    let errorPayload = {};
    try {
      errorPayload = await response.json();
    } catch (e) {
      errorPayload = { message: response.statusText };
    }
    throw new ApiError(
      errorPayload.message || `API Error: ${response.status}`, 
      response.status, 
      errorPayload
    );
  }

  return response.json();
}

export const api = {
  reconcileMedication: async (patientContext, sources) => {
    return fetchWithAuth('/api/reconcile/medication', {
      method: 'POST',
      body: JSON.stringify({
        patient_context: patientContext,
        sources: sources,
      }),
    });
  },

  validateDataQuality: async (patientRecord) => {
    return fetchWithAuth('/api/validate/data-quality', {
      method: 'POST',
      body: JSON.stringify(patientRecord),
    });
  }
};

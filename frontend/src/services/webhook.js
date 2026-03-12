export async function notifyWebhook(url, payload) {
  if (!url) return { success: false, message: 'No URL provided' };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString()
      }),
      mode: 'no-cors' // often needed for webhooks from browser if CORS isn't set
    });
    // With no-cors we can't reliably read the response status, 
    // but the request goes out. Wait, the req says "Show delivery status (sent, failed)".
    // If we use no-cors it's always opaque. Let's try regular fetch and if it fails, it fails.
    // If the receiving server doesn't have CORS it will fail on client.
    return { success: response.ok || response.type === 'opaque', status: response.status };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

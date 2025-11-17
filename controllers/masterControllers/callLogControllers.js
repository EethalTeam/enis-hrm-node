// --- 1. FIND THESE IN YOUR TELECMI DASHBOARD ---
// (e.g., in Settings -> Users -> Click on a user)
const TELECMI_USER_ID = "5002_33336639"; // e.g., "101_123456"
const TELECMI_USER_PASSWORD = "admin@123"; // e.g., "my-user-password"

const TELECMI_API_BASE_URL = 'https://rest.telecmi.com/v2/user';

/**
 * @desc    Logs into Telecmi API to get a temporary User Token
 */
const getTelecmiToken = async () => {
  console.log('Generating new Telecmi User Token...');
  const response = await fetch(`${TELECMI_API_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: TELECMI_USER_ID,
      password: TELECMI_USER_PASSWORD,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to login to Telecmi. Check User ID/Password.');
  }

  const data = await response.json();
  
  // The token is in data.token
  return data.token; 
};

const TELECMI_TOKEN = 'd18ce16a-5b80-49be-b682-072eaf3e85b7';

const fetchTelecmiData = async (endpoint, body, token) => {
  // Add the token to the request body
  const apiBody = {
    ...body,
    token: token, // Add the token here
  };

  const response = await fetch(`${TELECMI_API_BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(apiBody), // Send the body with the token
  });
  
  if (!response.ok) {
    const errorData = await response.json(); // Get error details
    console.error(`Telecmi API Error (${response.status})`, errorData);
    throw new Error(errorData.message || `Telecmi API request failed`);
  }
  return response.json();
};

exports.fetchAllCallLogs = async (req, res) => {
  try {
    if (!req.body) {
      console.log('Webhook received, but no body (JSON data) was found.');
      return res.status(400).send('No data received.');
    }

    console.log('--- NEW TELECMI CALL LOG RECEIVED (from Webhook) ---');
    console.log(JSON.stringify(req.body, null, 2));
    console.log('----------------------------------------------------');

    res.status(200).json({ success: true, message: "Webhook received." });

  } catch (error) {
    console.error('Error in Telecmi webhook controller:', error.message);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
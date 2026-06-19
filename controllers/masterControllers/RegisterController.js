const fetch = require('node-fetch');

const phoneNumberId = "1046910465169935"; // Your ID from the code above
const token = "EAALv2lqsAsUBRNLyFTHTNFYmZAz8n5VZAbmEIySmKjNcM546ubljXFNCaMRD5Ku9rYD1uedOXkcvcfFq1Sb6ImkVeb5DOQxkJ53TEI3RuDWKdMhnm0Jm0r4gPrRp6bZBdJ2ySMr3x2RxHAZCFmzmwUUZBNii2o90smdZCZCIkSkeXSEZAs6oZBGtcTRvyZCtykFwZDZD"; // Your System User Token

exports.register = async () => {
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/register`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        pin: "123456" // This sets a 6-digit registration PIN for your API
      }),
    });

    const data = await response.json();
    console.log("Registration Response:", data);
  } catch (error) {
    console.error("Error during registration:", error);
  }
};

const fetch = require('node-fetch');

// Meta credentials
// const phoneNumberId = "860092203847638";
const phoneNumberId = "1046910465169935";
// const token = "EAALv2lqsAsUBPjU1ZCSj58TGJRnddG9U41QXs3G1V3lxfAB0sloZCaDIaSmMPaGSigsx6I9lBG2cogvoe4RxvQgMtCpH1FVr8be7LQELx9z9RVSjaK2E2xuJTPqKHpmN7csN80heBlslK3ZCwNrMrFZB1a5jemZCJpVxP6pwuV9Gh7GYLRCbgXOIAZCvJJoyKNpjCQTkLMDWiZAnEPkxt836sB2FKU5xFS6rBuSJwbS0Bm5fh526HEamOMxeQZDZD";
const token = "EAALv2lqsAsUBRNLyFTHTNFYmZAz8n5VZAbmEIySmKjNcM546ubljXFNCaMRD5Ku9rYD1uedOXkcvcfFq1Sb6ImkVeb5DOQxkJ53TEI3RuDWKdMhnm0Jm0r4gPrRp6bZBdJ2ySMr3x2RxHAZCFmzmwUUZBNii2o90smdZCZCIkSkeXSEZAs6oZBGtcTRvyZCtykFwZDZD";
const sendWhatsAppTemplate = async (to, employeeName, assignedBy, taskContent, dueDate) => {

  let formattedNumber = to.toString().replace(/\D/g, '');

  // If it's a 10-digit number, add the '91' prefix
  if (formattedNumber.length === 10) {
    formattedNumber = `91${formattedNumber}`;
  }

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: formattedNumber,
    type: "template",
    template: {
      name: "task_assignment", 
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: employeeName },
            { type: "text", text: assignedBy },
            { type: "text", text: taskContent },
            { type: "text", text: dueDate },
          ]
        }
      ]
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log("WhatsApp API Response:", data);
    return data;
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    throw error;
  }
};

module.exports = { sendWhatsAppTemplate };
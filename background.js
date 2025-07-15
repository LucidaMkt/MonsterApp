// background.js

// 1. Gerenciamento de Ambiente (Ao Instalar/Atualizar)
const PROD_API_URL = "https://monsterapp-backend.onrender.com";
const DEV_API_URL = "http://127.0.0.1:8000";

chrome.runtime.onInstalled.addListener(() => {
  // Verifica se a extensão está em modo de desenvolvimento
  chrome.management.getSelf((info) => {
    let apiUrl = PROD_API_URL;
    if (info.installType === 'development') {
      apiUrl = DEV_API_URL;
      console.log("MonsterApp: Executando em modo de DESENVOLVIMENTO. API: ", apiUrl);
    } else {
      console.log("MonsterApp: Executando em modo de PRODUÇÃO. API: ", apiUrl);
    }
    // Salva a URL da API no armazenamento local para ser usada pelo popup
    chrome.storage.local.set({ api_url: apiUrl });
  });
});

// 2. Listener de Mensagens Principal
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'collectProfileData') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const tabId = tabs[0].id;
        // Check if content script is already injected. If not, inject it.
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }, () => {
          if (chrome.runtime.lastError) {
            const errorMessage = `Script injection failed: ${chrome.runtime.lastError.message}`;
            console.error("MonsterApp Background Error:", errorMessage);
            sendResponse({ success: false, message: errorMessage });
            return;
          }
          // Now send the message to the content script
          chrome.tabs.sendMessage(tabId, request, (response) => {
            if (chrome.runtime.lastError) {
              const errorMessage = `Error sending message to content script: ${chrome.runtime.lastError.message}`;
              console.error("MonsterApp Background Error:", errorMessage);
              sendResponse({ success: false, message: errorMessage });
              return;
            }
            sendResponse(response); // Send content script's response back to popup.js
          });
        });
      } else {
        sendResponse({ success: false, message: 'No active tab found.' });
      }
    });
    return true; // Indicates that sendResponse will be called asynchronously
  } else if (request.action === 'initiateOAuth' && request.platform === 'google') {
    const GOOGLE_CLIENT_ID = "476275454979-s2im0dskc3qoigf3fjie4763pu53qcgi.apps.googleusercontent.com";
    const redirectUri = chrome.identity.getRedirectURL();
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&response_type=token&scope=email%20profile&redirect_uri=${encodeURIComponent(redirectUri)}`;

    chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    }, (redirectUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, message: `OAuth failed: ${chrome.runtime.lastError.message}` });
        return;
      }
      if (redirectUrl) {
        const urlParams = new URLSearchParams(redirectUrl.substring(redirectUrl.indexOf('#') + 1));
        const accessToken = urlParams.get('access_token');
        if (accessToken) {
          sendResponse({ success: true, token: accessToken });
        } else {
          sendResponse({ success: false, message: 'No access token found in redirect URL.' });
        }
      } else {
        sendResponse({ success: false, message: 'OAuth flow cancelled or failed.' });
      }
    });
    return true; // Indicates that sendResponse will be called asynchronously
  } else if (request.action === 'schedulePost') {
    // Simulate post scheduling
    console.log(`Simulating post scheduling for ${request.platform} at ${request.scheduleDateTime} with content: ${request.content}`);
    // In a real scenario, you would interact with social media APIs here.
    // This would likely involve a backend server to handle OAuth tokens and API calls securely.
    setTimeout(() => {
      sendResponse({ success: true, message: 'Post scheduled successfully (simulated).' });
    }, 1000);
    return true; // Indicates that sendResponse will be called asynchronously
  } else if (request.action === 'fetchEngagementMetrics') {
    // Simulate fetching engagement metrics
    console.log("Simulating fetching engagement metrics...");
    setTimeout(() => {
      sendResponse({ success: true, data: { likes: 1234, comments: 567, shares: 89, reach: 123456 } });
    }, 1000);
    return true; // Indicates that sendResponse will be called asynchronously
  } else if (request.action === 'fetchBestPostTimes') {
    // Simulate fetching best post times
    console.log("Simulating fetching best post times...");
    setTimeout(() => {
      sendResponse({ success: true, data: { monday: '10:00 AM', tuesday: '11:30 AM', wednesday: '09:00 AM' } });
    }, 1000);
    return true; // Indicates that sendResponse will be called asynchronously
  } else if (request.action === 'fetchApiUsage') {
    // Simulate fetching API usage
    console.log("Simulating fetching API usage...");
    setTimeout(() => {
      sendResponse({ success: true, data: { openai_calls: 1500, another_ai_calls: 750, total_cost: '$15.75' } });
    }, 1000);
    return true; // Indicates that sendResponse will be called asynchronously
  } else if (request.action === 'fetchApiKeys') {
    // Fetch API keys from storage
    console.log("Fetching API keys from storage...");
    chrome.storage.sync.get(['openai_api_key', 'another_ai_api_key'], (result) => {
      sendResponse({ success: true, data: result });
    });
    return true; // Indicates that sendResponse will be called asynchronously
  } else if (request.action === 'fetchLogs') {
    // Simulate fetching logs
    console.log("Simulating fetching logs...");
    setTimeout(() => {
      sendResponse({ success: true, data: ["Log entry 1", "Log entry 2", "Log entry 3"] });
    }, 1000);
    return true; // Indicates that sendResponse will be called asynchronously
  }
});

console.log("MonsterApp background script loaded!");
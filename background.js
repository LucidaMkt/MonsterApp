// background.js

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
  } else if (request.action === 'initiateOAuth') {
    const platform = request.platform;
    let authUrl = '';
    let redirectUri = chrome.identity.getRedirectURL();

    // IMPORTANT: Replace with your actual client IDs and scopes
    switch (platform) {
      case 'google':
        // You need to enable Google Sign-In for Chrome Extensions in Google Cloud Console
        // and add "https://<YOUR_EXTENSION_ID>.chromiumapp.org" as an authorized redirect URI.
        // Also, add "identity" permission to manifest.json
        authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=476275454979-s2im0dskc3qoigf3fjie4763pu53qcgi.apps.googleusercontent.com&response_type=token&scope=email%20profile&redirect_uri=${encodeURIComponent(redirectUri)}`;
        break;
      case 'facebook':
        // You need to set up a Facebook App and configure the OAuth redirect URI
        // to "https://<YOUR_EXTENSION_ID>.chromiumapp.org".
        // Also, add "identity" permission to manifest.json
        authUrl = `https://www.facebook.com/v12.0/dialog/oauth?client_id=YOUR_FACEBOOK_APP_ID&redirect_uri=${encodeURIComponent(redirectUri)}&scope=email,public_profile`;
        break;
      case 'instagram':
        // Instagram Basic Display API requires a different flow, often involving a server-side component.
        // For simplicity, this example uses a placeholder. A full Instagram OAuth flow is more complex.
        // You would typically redirect to your server, which then handles the Instagram OAuth.
        // Also, add "identity" permission to manifest.json
        authUrl = `https://api.instagram.com/oauth/authorize?client_id=YOUR_INSTAGRAM_APP_ID&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user_profile,user_media&response_type=code`;
        break;
      default:
        sendResponse({ success: false, message: 'Unknown OAuth platform.' });
        return false;
    }

    chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    }, (redirectUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, message: `OAuth failed: ${chrome.runtime.lastError.message}` });
        return;
      }
      if (redirectUrl) {
        // Parse the token from the redirectUrl (for Google/Facebook implicit flow)
        // For Instagram, you'd get a 'code' that needs to be exchanged on your backend.
        const urlParams = new URLSearchParams(redirectUrl.split('#')[1] || redirectUrl.split('?')[1]);
        const accessToken = urlParams.get('access_token');
        const code = urlParams.get('code'); // For Instagram

        if (accessToken) {
          sendResponse({ success: true, token: accessToken, platform: platform });
        } else if (code) {
          // For Instagram, you'd send this code to your backend to exchange for an access token
          sendResponse({ success: true, code: code, platform: platform, message: 'Code received, exchange on backend needed.' });
        } else {
          sendResponse({ success: false, message: 'No access token or code found in redirect URL.' });
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
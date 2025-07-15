document.addEventListener('DOMContentLoaded', () => {
    const adminLoginForm = document.getElementById('admin-login-form');
    const adminApiPanel = document.getElementById('admin-api-panel');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const adminErrorMsg = document.getElementById('admin-error-msg');
    const saveApiKeysBtn = document.getElementById('save-api-keys-btn');
    const apiSaveConfirm = document.getElementById('api-save-confirm');
    const openAIKeyInput = document.getElementById('openai-key');
    const anotherAIKeyInput = document.getElementById('another-ai-key');

    // --- Load API Keys on startup ---
    chrome.storage.sync.get(['openai_api_key', 'another_ai_api_key'], (result) => {
        if (result.openai_api_key) {
            openAIKeyInput.value = result.openai_api_key;
        }
        if (result.another_ai_api_key) {
            anotherAIKeyInput.value = result.another_ai_api_key;
        }
    });

    // --- Admin Login Logic ---
    adminLoginBtn.addEventListener('click', () => {
        const user = document.getElementById('admin-user').value;
        const pass = document.getElementById('admin-pass').value;

        // In a real application, this would be a secure call to a backend.
        // For this simulation, we use hardcoded credentials.
        if (user === 'admin' && pass === 'password123') {
            adminLoginForm.style.display = 'none';
            adminApiPanel.style.display = 'block';
            adminErrorMsg.textContent = '';
        } else {
            adminErrorMsg.textContent = 'Invalid username or password.';
        }
    });

    // --- Save API Keys Logic ---
    saveApiKeysBtn.addEventListener('click', () => {
        const openAIKey = openAIKeyInput.value;
        const anotherAIKey = anotherAIKeyInput.value;

        chrome.storage.sync.set({
            'openai_api_key': openAIKey,
            'another_ai_api_key': anotherAIKey
        }, () => {
            if (chrome.runtime.lastError) {
                apiSaveConfirm.textContent = 'Error saving keys: ' + chrome.runtime.lastError.message;
                apiSaveConfirm.classList.remove('success-message');
                apiSaveConfirm.classList.add('error-message');
            } else {
                apiSaveConfirm.textContent = 'API keys saved successfully!';
                apiSaveConfirm.classList.remove('error-message');
                apiSaveConfirm.classList.add('success-message');
            }
            // Hide the message after a few seconds
            setTimeout(() => {
                apiSaveConfirm.textContent = '';
            }, 3000);
        });
    });

    // --- Social Login (OAuth) Integration ---
    document.querySelectorAll('.social-btn').forEach(button => {
        button.addEventListener('click', () => {
            const platform = button.classList.contains('google') ? 'google' :
                             button.classList.contains('facebook') ? 'facebook' :
                             button.classList.contains('instagram') ? 'instagram' : '';

            if (platform) {
                console.log(`Initiating OAuth for ${platform}...`);
                chrome.runtime.sendMessage({ action: 'initiateOAuth', platform: platform }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("OAuth message error:", chrome.runtime.lastError.message);
                        alert(`OAuth failed for ${platform}: ${chrome.runtime.lastError.message}`);
                        return;
                    }
                    if (response.success) {
                        alert(`OAuth successful for ${platform}! Token/Code: ${response.token || response.code}`);
                        // Here you would typically save the token/code to chrome.storage
                        // and/or send it to your backend for further processing.
                        chrome.storage.sync.set({ [`${platform}_oauth_token`]: response.token || response.code }, () => {
                            console.log(`${platform} OAuth token/code saved.`);
                        });
                    } else {
                        alert(`OAuth failed for ${platform}: ${response.message}`);
                    }
                });
            } else {
                alert("Unknown social platform.");
            }
        });
    });
});

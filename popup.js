document.addEventListener('DOMContentLoaded', function () {
    // --- DOM ELEMENTS ---
    const loginScreen = document.getElementById('login-screen');
    const mainContent = document.getElementById('main-content');
    const loginButton = document.getElementById('login-with-google-btn');
    const upgradeProBtn = document.getElementById('upgrade-pro-btn');

    // Abas e Botões
    const analyzeProfileBtn = document.getElementById('analyze-profile');
    const generateContentBtn = document.getElementById('generate-content');
    const generateImageBtn = document.getElementById('generate-image');
    const researchHashtagsBtn = document.getElementById('research-hashtags-btn');
    const suggestTopicsBtn = document.getElementById('suggest-topics-btn');

    // Saídas e Entradas
    const profileAnalysisOutput = document.getElementById('profile-analysis-output');
    const generatedContentOutput = document.getElementById('generated-content-output');
    const suggestedTopicsOutput = document.getElementById('suggested-topics-output');
    const suggestedTopicsOutputBox = document.getElementById('suggested-topics-output-box');
    const generatedVariationsOutput = document.getElementById('generated-variations-output');
    const generatedVariationsOutputBox = document.getElementById('generated-variations-output-box');
    const hashtagResearchOutput = document.getElementById('hashtag-research-output');
    const generatedImageOutput = document.getElementById('generated-image-output');
    const imagePlaceholder = document.getElementById('image-placeholder');

    // Competitor Analysis Elements
    const competitorUsernameInput = document.getElementById('competitor-username');
    const competitorBioInput = document.getElementById('competitor-bio');
    const competitorFollowersInput = document.getElementById('competitor-followers');
    const competitorFollowingInput = document.getElementById('competitor-following');
    const competitorPostsInput = document.getElementById('competitor-posts');
    const competitorRecentCaptionsInput = document.getElementById('competitor-recent-captions');
    const analyzeCompetitorBtn = document.getElementById('analyze-competitor-btn');
    const competitorAnalysisOutput = document.getElementById('competitor-analysis-output');

    // --- AUTHENTICATION LOGIC ---
    const handleLogin = () => {
        chrome.runtime.sendMessage({ action: 'initiateOAuth', platform: 'google' }, async (response) => {
            if (response && response.success) {
                // O background script nos deu o token do Google. Agora, enviamos para o nosso backend.
                try {
                    const headers = {
        'Content-Type': 'application/json',
      };
      if (appState.authToken) {
        headers['Authorization'] = `Bearer ${appState.authToken}`;
      }

      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
      });
                    const data = await backendResponse.json();
                    if (data.access_token) {
                        // Login bem-sucedido! Salva nosso token de API e atualiza a UI.
                        chrome.storage.local.set({ authToken: data.access_token }, () => {
                            appState.authToken = data.access_token;
                            showMainContent();
                        });
                    } else {
                        throw new Error(data.detail || 'Falha ao obter token da API.');
                    }
                } catch (error) {
                    console.error('Erro de login no backend:', error);
                    showLoginScreen(); // Mostra a tela de login novamente em caso de erro
                }
            } else {
                console.error('Falha na autenticação com o Google:', response.message);
                showLoginScreen();
            }
        });
    };

    const showLoginScreen = () => {
        loginScreen.style.display = 'block';
        mainContent.style.display = 'none';
    };

    const showMainContent = () => {
        loginScreen.style.display = 'none';
        mainContent.style.display = 'block';
        // Aqui você pode carregar os dados do usuário, etc.
    };

    // --- INITIALIZATION ---
    const initializeApp = async () => {
        // 1. Pega a URL da API (desenvolvimento ou produção)
        appState.apiUrl = await new Promise(resolve => {
            chrome.storage.local.get('api_url', result => resolve(result.api_url || 'https://monsterapp-backend.onrender.com'));
        });

        // 2. Verifica se já temos um token de autenticação
        chrome.storage.local.get('authToken', (result) => {
            if (result.authToken) {
                appState.authToken = result.authToken;
                // TODO: Adicionar uma verificação para ver se o token ainda é válido
                showMainContent();
            } else {
                showLoginScreen();
            }
        });
    };

    // --- EVENT LISTENERS ---
    loginButton.addEventListener('click', handleLogin);

    upgradeProBtn.addEventListener('click', async () => {
        try {
            // Hardcoded for now, but should be dynamic based on Stripe product/price IDs
            const PRICE_ID = "price_12345"; // Substitua pelo seu Price ID do Stripe
            const successUrl = chrome.runtime.getURL('popup.html?success=true');
            const cancelUrl = chrome.runtime.getURL('popup.html?canceled=true');

            const response = await callApi('/create-checkout-session', {
                price_id: PRICE_ID,
                success_url: successUrl,
                cancel_url: cancelUrl,
            }, upgradeProBtn);

            if (response.checkout_url) {
                chrome.tabs.create({ url: response.checkout_url });
            } else {
                throw new Error("URL de checkout não recebida.");
            }
        } catch (error) {
            console.error("Erro ao iniciar checkout do Stripe:", error);
            alert(`Erro ao iniciar checkout: ${error.message}`);
        }
    });

    // AGENT: COMPETITOR ANALYZER (Gemini - PRO Feature)
    analyzeCompetitorBtn.addEventListener('click', async () => {
        const competitorData = {
            username: competitorUsernameInput.value,
            bio: competitorBioInput.value,
            followers: competitorFollowersInput.value,
            following: competitorFollowingInput.value,
            posts: competitorPostsInput.value,
            recent_captions: competitorRecentCaptionsInput.value.split('\n').filter(line => line.trim() !== ''),
        };

        if (!competitorData.username) {
            alert("Please enter competitor's username.");
            return;
        }

        competitorAnalysisOutput.textContent = "Analyzing competitor...";
        try {
            const data = await callApi('/analyze-competitor-profile', competitorData, analyzeCompetitorBtn);
            let outputText = '🕵️ COMPETITOR ANALYSIS\n';
            outputText += '====================\n';
            outputText += `Username:  ${data.username}\n`;
            outputText += `Niche:     ${data.niche_identified}\n`;
            outputText += `Style:     ${data.content_style_analysis}\n\n`;
            outputText += '💡 INSIGHTS\n';
            outputText += '====================\n';
            data.insights.forEach((s, i) => { outputText += `${i + 1}. ${s}\n`; });

            competitorAnalysisOutput.textContent = outputText;
        } catch (error) {
            competitorAnalysisOutput.textContent = `Error from Competitor Analyzer: ${error.message}`;
        }
    });

    // AGENT: TOPIC SUGGESTER (Gemini - PRO Feature)
    suggestTopicsBtn.addEventListener('click', async () => {
        const niche = document.getElementById('niche').value;
        const competitorUsername = competitorUsernameInput.value;

        if (!niche && !appState.profileAnalysis && !competitorUsername) {
            suggestedTopicsOutput.textContent = "Please select a niche, analyze your profile, or enter competitor data.";
            return;
        }

        suggestedTopicsOutput.textContent = "Agent is brainstorming topics...";
        suggestedTopicsOutputBox.style.display = 'block';

        try {
            const requestBody = {
                niche: niche === 'autodetect' && appState.profileAnalysis ? appState.profileAnalysis.niche_identified : niche,
                user_profile_data: appState.profileAnalysis,
                competitor_profile_data: competitorUsername ? {
                    username: competitorUsername,
                    bio: competitorBioInput.value,
                    followers: competitorFollowersInput.value,
                    following: competitorFollowingInput.value,
                    posts: competitorPostsInput.value,
                    recent_captions: competitorRecentCaptionsInput.value.split('\n').filter(line => line.trim() !== ''),
                } : null,
            };
            const data = await callApi('/suggest-content-topics', requestBody, suggestTopicsBtn);
            suggestedTopicsOutput.textContent = data.topics.join('\n');
        } catch (error) {
            suggestedTopicsOutput.textContent = `Error from Topic Suggester: ${error.message}`;
        }
    });

    // AGENT: COPY VARIATIONS (ChatGPT - PRO Feature)
    const generateVariationsBtn = document.getElementById('generate-variations-btn');
    const generatedVariationsOutput = document.getElementById('generated-variations-output');
    const generatedVariationsOutputBox = document.getElementById('generated-variations-output-box');

    generateVariationsBtn.addEventListener('click', async () => {
        const contentToVary = appState.generatedContent || document.getElementById('content-prompt').value;
        if (!contentToVary) {
            alert("Please generate content first or enter a prompt.");
            return;
        }

        generatedVariationsOutput.textContent = "Agent is generating variations...";
        generatedVariationsOutputBox.style.display = 'block';

        try {
            const requestBody = {
                original_copy: contentToVary,
            };
            const data = await callApi('/generate-copy-variations', requestBody, generateVariationsBtn);
            generatedVariationsOutput.textContent = data.variations.map((v, i) => `${i + 1}. ${v}`).join('\n\n');
        } catch (error) {
            generatedVariationsOutput.textContent = `Error from Copy Variations Agent: ${error.message}`;
        }
    });

    // Post Scheduler
    const schedulePostBtn = document.getElementById('schedule-post');
    const scheduleContent = document.getElementById('schedule-content');
    const schedulePlatform = document.getElementById('schedule-platform');
    const scheduleTime = document.getElementById('schedule-time');
    const scheduleStatusOutput = document.getElementById('schedule-status-output');

    schedulePostBtn.addEventListener('click', async () => {
        const content = scheduleContent.value;
        const platform = schedulePlatform.value;
        const scheduleDateTime = scheduleTime.value;

        if (!content || !scheduleDateTime) {
            scheduleStatusOutput.textContent = "Please provide content and a schedule time.";
            return;
        }

        setLoading(schedulePostBtn, true);
        scheduleStatusOutput.textContent = "Scheduling post...";

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'schedulePost',
                content,
                platform,
                scheduleDateTime
            });

            if (response.success) {
                scheduleStatusOutput.textContent = `Post scheduled successfully on ${platform}!`;
            } else {
                scheduleStatusOutput.textContent = `Error scheduling post: ${response.message}`;
            }
        } catch (error) {
            scheduleStatusOutput.textContent = `Error: ${error.message}`;
        }
        setLoading(schedulePostBtn, false);
    });

    // Analytics
    const fetchEngagementBtn = document.getElementById('fetch-engagement');
    const engagementOutput = document.getElementById('engagement-output');
    const fetchBestTimesBtn = document.getElementById('fetch-best-times');
    const bestTimesOutput = document.getElementById('best-times-output');

    fetchEngagementBtn.addEventListener('click', async () => {
        setLoading(fetchEngagementBtn, true);
        engagementOutput.textContent = "Fetching engagement metrics...";
        try {
            const response = await chrome.runtime.sendMessage({ action: 'fetchEngagementMetrics' });
            if (response.success) {
                engagementOutput.textContent = JSON.stringify(response.data, null, 2);
            } else {
                engagementOutput.textContent = `Error: ${response.message}`;
            }
        } catch (error) {
            engagementOutput.textContent = `Error: ${error.message}`;
        }
        setLoading(fetchEngagementBtn, false);
    });

    fetchBestTimesBtn.addEventListener('click', async () => {
        setLoading(fetchBestTimesBtn, true);
        bestTimesOutput.textContent = "Fetching best post times...";
        try {
            const response = await chrome.runtime.sendMessage({ action: 'fetchBestPostTimes' });
            if (response.success) {
                bestTimesOutput.textContent = JSON.stringify(response.data, null, 2);
            } else {
                bestTimesOutput.textContent = `Error: ${response.message}`;
            }
        } catch (error) {
            bestTimesOutput.textContent = `Error: ${error.message}`;
        }
        setLoading(fetchBestTimesBtn, false);
    });

    // Inicia a aplicação
    initializeApp();
});
document.addEventListener('DOMContentLoaded', function () {
  // --- STATE MANAGEMENT ---
  const appState = {
    profileAnalysis: null,
    generatedContent: '',
    isLoading: false,
  };

  // --- DOM ELEMENTS ---
  const navButtons = document.querySelectorAll('.nav-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const analyzeProfileBtn = document.getElementById('analyze-profile');
  const profileAnalysisOutput = document.getElementById('profile-analysis-output');
  const generateContentBtn = document.getElementById('generate-content');
  const generatedContentOutput = document.getElementById('generated-content-output');
  const generateImageBtn = document.getElementById('generate-image');
  const generatedImageOutput = document.getElementById('generated-image-output');
  const imagePlaceholder = document.getElementById('image-placeholder');
  const textOverlayInput = document.getElementById('text-overlay');
  const textOptions = document.getElementById('text-options');
  const hashtagTopic = document.getElementById('hashtag-topic');
  const useGeneratedContentBtn = document.getElementById('use-generated-content');
  const researchHashtagsBtn = document.getElementById('research-hashtags-btn');
  const hashtagResearchOutput = document.getElementById('hashtag-research-output');
  const settingsBtn = document.getElementById('settings-btn');

  // Post Scheduler
  const schedulePostBtn = document.getElementById('schedule-post');
  const scheduleContent = document.getElementById('schedule-content');
  const schedulePlatform = document.getElementById('schedule-platform');
  const scheduleTime = document.getElementById('schedule-time');
  const scheduleStatusOutput = document.getElementById('schedule-status-output');

  // Analytics
  const fetchEngagementBtn = document.getElementById('fetch-engagement');
  const engagementOutput = document.getElementById('engagement-output');
  const fetchBestTimesBtn = document.getElementById('fetch-best-times');
  const bestTimesOutput = document.getElementById('best-times-output');

  // Developer Tools
  const fetchApiUsageBtn = document.getElementById('fetch-api-usage');
  const apiUsageOutput = document.getElementById('api-usage-output');
  const fetchApiKeysBtn = document.getElementById('fetch-api-keys');
  const apiKeysOutput = document.getElementById('api-keys-output');
  const fetchLogsBtn = document.getElementById('fetch-logs');
  const logsOutput = document.getElementById('logs-output');

  // --- HELPER FUNCTIONS ---
  const setLoading = (button, isLoading) => {
    appState.isLoading = isLoading;
    if (isLoading) {
      button.disabled = true;
      button.dataset.originalText = button.innerHTML;
      button.innerHTML = '<span class="loader"></span>';
    } else {
      button.disabled = false;
      button.innerHTML = button.dataset.originalText;
    }
  };

  const navigateToTab = (tabName) => {
    navButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    tabContents.forEach(content => {
      content.classList.toggle('active', content.id === tabName);
    });
  };

  // --- NAVIGATION ---
  navButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (appState.isLoading) return;
      navigateToTab(button.dataset.tab);
    });
  });

  settingsBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
  });

  // --- CORE FUNCTIONALITY ---

  // 1. Profile Analysis
  analyzeProfileBtn.addEventListener('click', () => {
    setLoading(analyzeProfileBtn, true);
    profileAnalysisOutput.textContent = 'Analyzing profile...';
    chrome.runtime.sendMessage({ action: 'collectProfileData' }, (response) => {
      if (chrome.runtime.lastError) {
        profileAnalysisOutput.textContent = `Error: ${chrome.runtime.lastError.message}`;
        setLoading(analyzeProfileBtn, false);
        return;
      }
      if (response.success) {
        appState.profileAnalysis = response.data;
        fetch('http://127.0.0.1:8000/analyze-profile-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(response.data)
        })
        .then(res => res.ok ? res.json() : Promise.reject(`Backend error: ${res.status}`))
        .then(backendData => {
            const { data } = response;
            let outputText = '📊 PROFILE ANALYSIS\n';
            outputText += '====================\n';
            outputText += `Platform:  ${data.platform}\n`;
            outputText += `Username:  ${data.username}\n`;
            outputText += `Bio:       ${data.bio || 'Not found.'}\n\n`;

            outputText += '📈 METRICS\n';
            outputText += '====================\n';
            outputText += `Followers: ${data.followers} | Following: ${data.following} | Posts: ${data.posts}\n\n`;

            outputText += '🧠 AI-POWERED INSIGHTS\n';
            outputText += '====================\n';
            outputText += `Identified Niche:  ${backendData.niche_identified}\n`;
            outputText += `Content Style:     ${backendData.content_style_analysis}\n\n`;

            outputText += '💡 IMPROVEMENT SUGGESTIONS\n';
            outputText += '====================\n';
            backendData.improvement_suggestions.forEach((s, i) => { outputText += `${i + 1}. ${s}\n`; });

            profileAnalysisOutput.textContent = outputText;
            appState.profileAnalysis.niche_identified = backendData.niche_identified;
            setTimeout(() => navigateToTab('content-generator'), 800);
        })
        .catch(err => profileAnalysisOutput.textContent = `Error: ${err.message}`)
        .finally(() => setLoading(analyzeProfileBtn, false));
      } else {
        profileAnalysisOutput.textContent = `Error: ${response.message}`;
        setLoading(analyzeProfileBtn, false);
      }
    });
  });

  // 2. Content Generation
  generateContentBtn.addEventListener('click', async () => {
    const prompt = document.getElementById('content-prompt').value;
    const tone = document.getElementById('tone').value;
    const niche = document.getElementById('niche').value;

    if (!prompt && !appState.profileAnalysis) {
      generatedContentOutput.textContent = "Please enter a prompt or analyze a profile first.";
      return;
    }

    setLoading(generateContentBtn, true);
    generatedContentOutput.textContent = "Generating content...";

    try {
      const response = await fetch('http://127.0.0.1:8000/generate-seo-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            prompt,
            tone,
            niche: niche === 'autodetect' && appState.profileAnalysis ? appState.profileAnalysis.niche_identified : niche,
            profile_data: appState.profileAnalysis
        })
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      appState.generatedContent = data.copy; // Save content
      generatedContentOutput.textContent = data.copy;
    } catch (error) {
      generatedContentOutput.textContent = `Error: ${error.message}`;
    }
    setLoading(generateContentBtn, false);
  });

  // 3. Hashtag Research
  useGeneratedContentBtn.addEventListener('click', () => {
      if (appState.generatedContent) {
          hashtagTopic.value = appState.generatedContent;
      } else {
          alert("No content generated yet. Please generate content first.");
      }
  });

  researchHashtagsBtn.addEventListener('click', async () => {
    const topic = hashtagTopic.value;
    if (!topic) {
        alert("Please enter a topic or generate content first.");
        return;
    }

    setLoading(researchHashtagsBtn, true);
    hashtagResearchOutput.textContent = 'Researching hashtags...';

    try {
        const niche = document.getElementById('niche').value;
        const response = await fetch('http://127.0.0.1:8000/research-hashtags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                content: topic, 
                niche: niche === 'autodetect' && appState.profileAnalysis ? appState.profileAnalysis.niche_identified : niche
            })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        hashtagResearchOutput.textContent = data.hashtags.join(' ');
    } catch (error) {
        hashtagResearchOutput.textContent = `Error: ${error.message}`;
    }
    setLoading(researchHashtagsBtn, false);
  });

  // 4. Image Generation
  textOverlayInput.addEventListener('input', (e) => {
    textOptions.style.display = e.target.value ? 'grid' : 'none';
  });

  generateImageBtn.addEventListener('click', async () => {
    const description = document.getElementById('image-prompt').value;
    const textOverlay = textOverlayInput.value;

    if (!description) {
        alert("Please describe the image you want to create.");
        return;
    }

    setLoading(generateImageBtn, true);
    imagePlaceholder.textContent = 'Generating image...';
    generatedImageOutput.style.display = 'none';

    try {
        const payload = {
            description,
            style: document.getElementById('image-style').value,
            format: document.getElementById('image-format').value,
            text_overlay: textOverlay,
        };

        if (textOverlay) {
            payload.text_position = document.getElementById('text-position').value;
            payload.text_color = document.getElementById('text-color').value;
        }

        const response = await fetch('http://127.0.0.1:8000/generate-ultra-realistic-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        generatedImageOutput.src = data.image_url;
        generatedImageOutput.alt = description;
        generatedImageOutput.style.display = 'block';
        imagePlaceholder.style.display = 'none';
    } catch (error) {
        imagePlaceholder.textContent = `Error: ${error.message}`;
        imagePlaceholder.style.display = 'block';
    }
    setLoading(generateImageBtn, false);
  });

  // 5. Post Scheduler
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

  // 6. Analytics
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

  // 7. Developer Tools
  fetchApiUsageBtn.addEventListener('click', async () => {
    setLoading(fetchApiUsageBtn, true);
    apiUsageOutput.textContent = "Fetching API usage...";
    try {
      const response = await chrome.runtime.sendMessage({ action: 'fetchApiUsage' });
      if (response.success) {
        apiUsageOutput.textContent = JSON.stringify(response.data, null, 2);
      } else {
        apiUsageOutput.textContent = `Error: ${response.message}`;
      }
    } catch (error) {
      apiUsageOutput.textContent = `Error: ${error.message}`;
    }
    setLoading(fetchApiUsageBtn, false);
  });

  fetchApiKeysBtn.addEventListener('click', async () => {
    setLoading(fetchApiKeysBtn, true);
    apiKeysOutput.textContent = "Fetching API keys...";
    try {
      const response = await chrome.runtime.sendMessage({ action: 'fetchApiKeys' });
      if (response.success) {
        apiKeysOutput.textContent = JSON.stringify(response.data, null, 2);
      } else {
        apiKeysOutput.textContent = `Error: ${response.message}`;
      }
    } catch (error) {
      apiKeysOutput.textContent = `Error: ${error.message}`;
    }
    setLoading(fetchApiKeysBtn, false);
  });

  fetchLogsBtn.addEventListener('click', async () => {
    setLoading(fetchLogsBtn, true);
    logsOutput.textContent = "Fetching logs...";
    try {
      const response = await chrome.runtime.sendMessage({ action: 'fetchLogs' });
      if (response.success) {
        logsOutput.textContent = JSON.stringify(response.data, null, 2);
      } else {
        logsOutput.textContent = `Error: ${response.message}`;
      }
    } catch (error) {
      logsOutput.textContent = `Error: ${error.message}`;
    }
    setLoading(fetchLogsBtn, false);
  });

  // Initialize with the first tab
  navigateToTab('profile-analysis');
});

console.log("MonsterApp popup script loaded and initialized!");
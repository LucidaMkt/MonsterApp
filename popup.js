
document.addEventListener('DOMContentLoaded', function () {
  // --- CONFIGURAÇÕES ---
  const API_BASE_URL = "https://monsterapp-backend.onrender.com"; // URL do backend no Render

  // --- STATE MANAGEMENT ---
  const appState = {
    profileAnalysis: null,
    generatedContent: '',
    isLoading: false,
  };

  // --- DOM ELEMENTS ---
  const navButtons = document.querySelectorAll('.nav-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const settingsBtn = document.getElementById('settings-btn');

  // Abas e Botões
  const analyzeProfileBtn = document.getElementById('analyze-profile');
  const generateContentBtn = document.getElementById('generate-content');
  const generateImageBtn = document.getElementById('generate-image');
  const researchHashtagsBtn = document.getElementById('research-hashtags-btn');
  
  // Saídas e Entradas
  const profileAnalysisOutput = document.getElementById('profile-analysis-output');
  const generatedContentOutput = document.getElementById('generated-content-output');
  const hashtagResearchOutput = document.getElementById('hashtag-research-output');
  const generatedImageOutput = document.getElementById('generated-image-output');
  const imagePlaceholder = document.getElementById('image-placeholder');
  
  // --- HELPER FUNCTIONS ---
  const setLoading = (button, isLoading) => {
    appState.isLoading = isLoading;
    if (button) {
      button.disabled = isLoading;
      if (isLoading) {
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = '<span class="loader"></span>';
      } else {
        button.innerHTML = button.dataset.originalText;
      }
    }
  };

  const navigateToTab = (tabName) => {
    navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
    tabContents.forEach(content => content.classList.toggle('active', content.id === tabName));
  };

  // --- API CALLS ---
  const callApi = async (endpoint, body, buttonToLoad) => {
    setLoading(buttonToLoad, true);
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } finally {
      setLoading(buttonToLoad, false);
    }
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

  // --- AGENT: PROFILE ANALYZER ---
  analyzeProfileBtn.addEventListener('click', () => {
    setLoading(analyzeProfileBtn, true);
    profileAnalysisOutput.textContent = 'Analyzing profile on the current page...';
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content.js']
      }, () => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'collectProfileData' }, (response) => {
          setLoading(analyzeProfileBtn, false);
          if (chrome.runtime.lastError) {
            profileAnalysisOutput.textContent = `Error: ${chrome.runtime.lastError.message}`;
            return;
          }
          if (response && response.success) {
            appState.profileAnalysis = response.data;
            let outputText = `📊 **Profile Analysis**
`;
            outputText += `--------------------
`;
            outputText += `**Platform:** ${response.data.platform}
`;
            outputText += `**Username:** ${response.data.username}
`;
            outputText += `**Bio:** ${response.data.bio || 'Not found.'}
`;
            profileAnalysisOutput.textContent = outputText;
            navigateToTab('content-generator'); // Move to the next logical step
          } else {
            profileAnalysisOutput.textContent = `Error: ${response ? response.message : 'Could not collect profile data.'}`;
          }
        });
      });
    });
  });

  // --- AGENT: CONTENT GENERATOR (ChatGPT) ---
  generateContentBtn.addEventListener('click', async () => {
    const prompt = document.getElementById('content-prompt').value;
    const tone = document.getElementById('tone').value;
    const niche = document.getElementById('niche').value;

    if (!prompt && !appState.profileAnalysis) {
      generatedContentOutput.textContent = "Please enter a prompt or analyze a profile first.";
      return;
    }
    
    generatedContentOutput.textContent = "Agent is thinking...";
    try {
      const requestBody = {
        prompt: prompt || "Based on the user's profile",
        tone: tone,
        niche: niche,
        profile_data: appState.profileAnalysis
      };
      const data = await callApi('/gerar-copy-social-media', requestBody, generateContentBtn);
      appState.generatedContent = data.copy;
      generatedContentOutput.textContent = data.copy;
    } catch (error) {
      generatedContentOutput.textContent = `Error from Content Agent: ${error.message}`;
    }
  });

  // --- AGENT: HASHTAG RESEARCHER (Gemini) ---
  researchHashtagsBtn.addEventListener('click', async () => {
    const topic = document.getElementById('hashtag-topic').value;
    if (!topic) {
      hashtagResearchOutput.textContent = "Please provide a topic for the hashtag research.";
      return;
    }

    hashtagResearchOutput.textContent = "Agent is researching...";
    try {
      const requestBody = {
        topic: topic,
        niche: document.getElementById('niche').value, // Re-using niche from content tab
        profile_data: appState.profileAnalysis
      };
      const data = await callApi('/pesquisar-hashtags', requestBody, researchHashtagsBtn);
      hashtagResearchOutput.textContent = data.hashtags.join(' ');
    } catch (error) {
      hashtagResearchOutput.textContent = `Error from Hashtag Agent: ${error.message}`;
    }
  });
  
  // --- AGENT: IMAGE GENERATOR (DALL-E) ---
  generateImageBtn.addEventListener('click', async () => {
    const prompt = document.getElementById('image-prompt').value;
    if (!prompt) {
      alert("Please describe the image you want to create.");
      return;
    }

    imagePlaceholder.textContent = 'Agent is creating...';
    generatedImageOutput.style.display = 'none';
    imagePlaceholder.style.display = 'block';

    try {
      const requestBody = {
        prompt: prompt,
        style: document.getElementById('image-style').value,
      };
      const data = await callApi('/gerar-imagem', requestBody, generateImageBtn);
      generatedImageOutput.src = data.image_url;
      generatedImageOutput.alt = prompt;
      generatedImageOutput.style.display = 'block';
      imagePlaceholder.style.display = 'none';
    } catch (error) {
      imagePlaceholder.textContent = `Error from Image Agent: ${error.message}`;
    }
  });

  // --- UTILITY BUTTONS ---
  document.getElementById('use-generated-content').addEventListener('click', () => {
      if (appState.generatedContent) {
          document.getElementById('hashtag-topic').value = appState.generatedContent;
          navigateToTab('hashtag-research');
      } else {
          alert("No content generated yet. Please generate content first.");
      }
  });

  // Initialize with the first tab
  navigateToTab('profile-analysis');
});

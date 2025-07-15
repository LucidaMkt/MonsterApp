// content.js

// Function to detect the current platform (Instagram or Facebook)
function detectPlatform() {
  const hostname = window.location.hostname;
  if (hostname.includes('instagram.com')) {
    return 'instagram';
  } else if (hostname.includes('facebook.com')) {
    return 'facebook';
  }
  return null;
}

// Helper function to extract emojis from a string
function extractEmojis(text) {
  // Regex to match most common emojis
  const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
  const matches = text.match(emojiRegex);
  return matches ? [...new Set(matches)] : []; // Return unique emojis
}

// Helper function to extract hashtags from a string
function extractHashtags(text) {
  const hashtagRegex = /#(\w+)/g;
  const matches = text.match(hashtagRegex);
  return matches ? [...new Set(matches.map(tag => tag.toLowerCase()))] : []; // Return unique, lowercase hashtags
}

// Function to extract Instagram profile data
function extractInstagramProfileData() {
  let username = '';
  let bio = '';
  let posts = 'N/A';
  let followers = 'N/A';
  let following = 'N/A';
  const recentPosts = [];
  let allExtractedEmojis = [];
  let allExtractedHashtags = [];

  try {
    // Find the username element first, as it's usually stable
    const usernameSpan = document.querySelector('h2 span.xlyipyv');
    if (usernameSpan) {
      username = usernameSpan.textContent;
    } else {
      throw new Error("Instagram username element not found.");
    }

    // Find the main header section by looking for a parent of the username element
    let profileHeaderSection = usernameSpan.closest('header');
    if (!profileHeaderSection) {
        throw new Error("Instagram profile header section not found via username.");
    }

    // Bio
    // Look for the bio within a section that contains the username and other profile details
    const bioSection = profileHeaderSection.nextElementSibling; // Assuming bio section is next sibling
    if (bioSection) {
        const bioSpan = bioSection.querySelector('span[dir="auto"]');
        if (bioSpan) {
            bio = bioSpan.innerText.trim();
        }
    }
    allExtractedEmojis = allExtractedEmojis.concat(extractEmojis(bio));
    allExtractedHashtags = allExtractedHashtags.concat(extractHashtags(bio));

    // Posts, Followers, Following
    // These are typically in a ul within a section after the main header
    const countsList = document.querySelector('section ul.x78zum5.x1q0g3np.xieb3on');
    if (countsList) {
        const countItems = countsList.querySelectorAll('li span.html-span');
        if (countItems.length >= 3) {
            posts = countItems[0].textContent;
            followers = countItems[1].textContent;
            following = countItems[2].textContent;
        }
    }

    // Recent Posts (images/videos) and their captions (if available)
    const postLinks = document.querySelectorAll('article a[href^="/p/"]');
    for (let i = 0; i < Math.min(postLinks.length, 9); i++) { // Get up to 9 recent posts
      const img = postLinks[i].querySelector('img');
      if (img && img.src) {
        recentPosts.push(img.src);
        // TODO: Implement extraction of post captions here if needed for more detailed analysis
        // This would require navigating to the post page or finding the caption element on the profile page.
        // For now, emojis and hashtags are primarily extracted from the bio.
      }
    }

  } catch (e) {
    console.error("Error extracting Instagram profile data:", e);
  }

  return {
    platform: 'instagram',
    username: username,
    bio: bio,
    posts: posts,
    followers: followers,
    following: following,
    recent_posts: recentPosts,
    extracted_emojis: [...new Set(allExtractedEmojis)], // Ensure unique emojis across all sources
    extracted_hashtags: [...new Set(allExtractedHashtags)] // Ensure unique hashtags across all sources
  };
}

// Function to extract Facebook profile data
function extractFacebookProfileData() {
  let username = '';
  let bio = '';
  let followers = 'N/A';
  let friends = 'N/A'; // Facebook uses 'friends' instead of 'following' for personal profiles
  let allExtractedEmojis = [];
  let allExtractedHashtags = [];

  try {
    // Attempt to get username from the main profile header
    const usernameElement = document.querySelector('h1[aria-label]');
    if (usernameElement) {
      username = usernameElement.textContent;
    } else {
      // Fallback for other layouts or pages
      const profileLink = document.querySelector('a[role="link"][tabindex="0"][href*="/profile.php"], a[role="link"][tabindex="0"][href*="/groups/"]');
      if (profileLink) {
        username = profileLink.textContent;
      }
    }

    // Bio - This is highly variable on Facebook. Looking for common patterns.
    // This might need significant refinement based on specific profile types (personal, page, group)
    const bioElement = document.querySelector('div[data-pagelet="ProfileAppSection_0"] span[dir="auto"]');
    if (bioElement) {
      bio = bioElement.textContent.trim();
    } else {
      const aboutSection = document.querySelector('div[role="main"] div[data-pagelet="ProfileAppSection_0"]');
      if (aboutSection) {
        const bioText = aboutSection.innerText.split('\n').find(line => line.length > 50); // Heuristic for bio
        if (bioText) bio = bioText.trim();
      }
    }
    allExtractedEmojis = allExtractedEmojis.concat(extractEmojis(bio));
    allExtractedHashtags = allExtractedHashtags.concat(extractHashtags(bio));

    // Followers/Friends - Also highly variable.
    // Look for elements containing "followers" or "friends" text.
    const followerElement = Array.from(document.querySelectorAll('span')).find(span => span.textContent.includes('followers'));
    if (followerElement) {
      followers = followerElement.textContent.replace('followers', '').trim();
    }

    const friendsElement = Array.from(document.querySelectorAll('span')).find(span => span.textContent.includes('friends'));
    if (friendsElement) {
      friends = friendsElement.textContent.replace('friends', '').trim();
    }

  } catch (e) {
    console.error("Error extracting Facebook profile data:", e);
  }

  return {
    platform: 'facebook',
    username: username,
    bio: bio,
    followers: followers,
    friends: friends,
    posts: 'N/A', // Facebook doesn't expose a simple post count like Instagram
    extracted_emojis: [...new Set(allExtractedEmojis)],
    extracted_hashtags: [...new Set(allExtractedHashtags)]
  };
}

// Listen for messages from the extension (popup.js or background.js)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'collectProfileData') {
    const platform = detectPlatform();
    if (platform === 'instagram') {
      console.log(`MonsterApp: Collecting data from Instagram profile...`);
      const profileData = extractInstagramProfileData();
      sendResponse({ success: true, data: profileData });
    } else if (platform === 'facebook') {
      console.log(`MonsterApp: Collecting data from Facebook profile...`);
      const profileData = extractFacebookProfileData();
      sendResponse({ success: true, data: profileData });
    } else {
      sendResponse({ success: false, message: 'Not on a supported social media profile page (Instagram or Facebook).' });
    }
    return true; // Indicates that sendResponse will be called asynchronously
  }
});

console.log("MonsterApp content script loaded!");
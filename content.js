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

// Function to extract Instagram profile data
function extractInstagramProfileData() {
  let username = '';
  let bio = '';
  let posts = 'N/A';
  let followers = 'N/A';
  let following = 'N/A';
  const recentPosts = [];

  try {
    const header = document.querySelector('header');
    if (!header) throw new Error("Instagram profile header not found.");

    // Username
    const usernameElement = header.querySelector('h2');
    if (usernameElement) {
      username = usernameElement.textContent;
    }

    // Bio - This selector is volatile and may need updates if Instagram changes its layout.
    // It targets the div that usually contains the bio text, often identified by a test id.
    const bioElement = document.querySelector('div[data-testid="UserDescription"]');
    if (bioElement) {
        bio = bioElement.textContent.trim();
    } else {
        // Fallback for older or different layouts where the bio is near the user's name (h1)
        const h1_bio = header.querySelector('h1');
        if(h1_bio && h1_bio.parentElement) {
            // Attempt to get sibling text content which forms the bio
            let bioText = '';
            let nextSibling = h1_bio.nextElementSibling;
            if (nextSibling) bioText = nextSibling.textContent.trim();
            bio = bioText;
        }
    }

    // Posts, Followers, Following
    const counts = document.querySelectorAll('header ul li span');
    if (counts.length >= 3) {
      posts = counts[0].querySelector('span') ? counts[0].querySelector('span').textContent : counts[0].textContent;
      followers = counts[1].querySelector('span') ? counts[1].querySelector('span').textContent : counts[1].textContent;
      following = counts[2].querySelector('span') ? counts[2].querySelector('span').textContent : counts[2].textContent;
    }

    // Recent Posts (images/videos)
    const postLinks = document.querySelectorAll('article a[href^="/p/"]');
    for (let i = 0; i < Math.min(postLinks.length, 9); i++) { // Get up to 9 recent posts
      const img = postLinks[i].querySelector('img');
      if (img && img.src) {
        recentPosts.push(img.src);
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
    recent_posts: recentPosts
  };
}

// Function to extract Facebook profile data
function extractFacebookProfileData() {
  let username = '';
  let bio = '';
  let followers = 'N/A';
  let friends = 'N/A'; // Facebook uses 'friends' instead of 'following' for personal profiles

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
    posts: 'N/A' // Facebook doesn't expose a simple post count like Instagram
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

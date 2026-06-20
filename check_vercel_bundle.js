const urls = [
  'https://vrindavan-estates-crm-frontend.vercel.app'
];

async function checkUrl(url) {
  try {
    console.log(`Checking Vercel site: ${url}`);
    const htmlRes = await fetch(url);
    if (!htmlRes.ok) {
      console.log(`❌ Page returned status ${htmlRes.status}`);
      return false;
    }
    const htmlText = await htmlRes.text();
    
    // Find JS script assets
    const matches = htmlText.match(/src="([^"]+\.js)"/g);
    if (!matches || matches.length === 0) {
      console.log(`⚠️ No script files found in HTML for ${url}`);
      return false;
    }

    for (const match of matches) {
      const scriptPath = match.substring(5, match.length - 1);
      const scriptUrl = scriptPath.startsWith('http') ? scriptPath : `${url}${scriptPath}`;
      console.log(`Found JS bundle: ${scriptUrl}. Fetching bundle...`);
      
      const jsRes = await fetch(scriptUrl);
      if (!jsRes.ok) {
        console.log(`❌ Failed to fetch JS bundle ${scriptUrl}`);
        continue;
      }
      
      const jsText = await jsRes.text();
      // Check for conditional background style from commit 7298bc0
      const containsBgCard = jsText.includes('var(--bg-card)') && jsText.includes('var(--color-info-bg)');
      
      console.log(`- Contains conditional background styling: ${containsBgCard}`);
      
      if (containsBgCard) {
        console.log(`🎉 YES! Vercel is serving the latest commit 7298bc0 (Unconditional Reminders button)!`);
        return true;
      }
    }
    console.log(`⚠️ Vercel is still serving an older bundle (Commit 7298bc0 not yet active).`);
    return false;
  } catch (e) {
    console.log(`❌ Exception checking URL ${url}: ${e.message}`);
    return false;
  }
}

async function runCheck() {
  for (const url of urls) {
    const success = await checkUrl(url);
    if (success) {
      console.log(`\nDeployment check complete: ${url} is successfully serving commit 7298bc0.`);
      process.exit(0);
    }
  }
  console.log('\nDeployment check complete: Vercel has not completed deployment yet.');
}

runCheck();

const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function connectWithRetry(options, maxRetries = 5) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Connection attempt ${attempt}/${maxRetries}...`);
            return await CDP(options);
        } catch (error) {
            lastError = error;
            console.log(`Attempt ${attempt} failed:`, error.message);
            
            if (attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                console.log(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw new Error(`Failed to connect after ${maxRetries} attempts. Last error: ${lastError.message}`);
}

async function waitForChromeReady(maxWaitTime = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
        try {
            // Check if Chrome DevTools endpoint is accessible through nginx
            const response = await fetch('http://localhost:80/json/version', {
                timeout: 2000
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Chrome is ready. Version:', data.Browser);
                return true;
            }
        } catch (error) {
            // Chrome not ready yet, continue waiting
        }
        
        console.log('Waiting for Chrome to be ready...');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Chrome not ready after ${maxWaitTime}ms`);
}

async function takeScreenshot() {
    let client;
    
    try {
        console.log('Connecting to Chrome via nginx proxy...');

        const healthCheck = await fetch('http://localhost:80/health');
        console.log('Health check response status:', healthCheck.status);
        if (!healthCheck.ok) {
            throw new Error('Health check failed');
        }
        console.log('Health check passed.');
        
        // Wait for Chrome to be ready
        await waitForChromeReady();
        
        // Connect to Chrome through nginx proxy with retry mechanism
        client = await connectWithRetry({
            host: 'localhost',
            port: 80
        });
        
        const {Network, Page, Runtime} = client;
        
        // Enable necessary domains
        await Network.enable();
        await Page.enable();
        await Runtime.enable();
        
        console.log('Connected successfully. Navigating to https://www.example.com...');
        
        // Navigate to the target URL
        await Page.navigate({url: 'https://www.example.com'});
        
        // Wait for page load
        await Page.loadEventFired();
        
        // Wait a bit more for content to render
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('Taking screenshot...');
        
        // Take screenshot
        const screenshot = await Page.captureScreenshot({
            format: 'png'
        });
        
        // Save screenshot to file
        fs.writeFileSync('screenshot.png', screenshot.data, 'base64');
        
        console.log('Screenshot saved as screenshot.png');
        
    } catch (error) {
        console.log('Failed to connect or take screenshot.');
        console.log(error)
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

// Run the test
takeScreenshot().then(() => {
    console.log('Test completed successfully');
    process.exit(0);
}).catch((error) => {
    console.error('Test failed:', error.message);
    process.exit(1);
});
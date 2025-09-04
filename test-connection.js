const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function takeScreenshot() {
    let client;
    
    try {
        console.log('Connecting to Chrome via nginx proxy...');

        const healthCheck = await fetch('http://localhost:80/health');
        console.log('Health check response status:', healthCheck.status);
        if (!healthCheck.ok) {
            throw new Error('Health check failed');
        }
        else {
            console.log('Health check passed.');
        }
        console.log('Health check passed.');
        // Connect to Chrome through nginx proxy
        client = await CDP({
            host: 'localhost',
            port: 48333
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
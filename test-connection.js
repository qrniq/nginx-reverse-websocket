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

async function waitForPageLoad(Page, url, options = {}) {
    const {
        loadTimeout = 15000,
        domTimeout = 10000,
        networkIdleTimeout = 5000,
        maxNetworkIdleTime = 2000,
        verboseLogging = false
    } = options;
    
    let loadMethod = 'unknown';
    let networkRequests = 0;
    let lastNetworkActivity = Date.now();
    
    if (verboseLogging) console.log('Setting up page load detection strategies...');
    
    // Track network activity for idle detection
    const onRequestWillBeSent = () => {
        networkRequests++;
        lastNetworkActivity = Date.now();
        if (verboseLogging) console.log(`Network request started. Active requests: ${networkRequests}`);
    };
    
    const onResponseReceived = () => {
        networkRequests = Math.max(0, networkRequests - 1);
        lastNetworkActivity = Date.now();
        if (verboseLogging) console.log(`Network response received. Active requests: ${networkRequests}`);
    };
    
    const {Network} = Page._client;
    Network.requestWillBeSent(onRequestWillBeSent);
    Network.responseReceived(onResponseReceived);
    
    try {
        // Multiple concurrent load detection strategies
        const loadStrategies = [
            // Strategy 1: Standard load event
            Page.loadEventFired().then(() => {
                loadMethod = 'loadEventFired';
                if (verboseLogging) console.log('Load detected via loadEventFired');
                return true;
            }).catch(() => false),
            
            // Strategy 2: DOM content loaded
            new Promise(resolve => {
                setTimeout(async () => {
                    try {
                        await Promise.race([
                            Page.domContentLoaded(),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('DOM timeout')), domTimeout))
                        ]);
                        loadMethod = 'domContentLoaded';
                        if (verboseLogging) console.log('Load detected via domContentLoaded');
                        resolve(true);
                    } catch {
                        resolve(false);
                    }
                }, 1000);
            }),
            
            // Strategy 3: Network idle detection
            new Promise(resolve => {
                const checkNetworkIdle = () => {
                    if (networkRequests === 0 && Date.now() - lastNetworkActivity > maxNetworkIdleTime) {
                        loadMethod = 'networkIdle';
                        if (verboseLogging) console.log('Load detected via network idle');
                        resolve(true);
                    } else {
                        setTimeout(checkNetworkIdle, 500);
                    }
                };
                setTimeout(checkNetworkIdle, 2000);
                setTimeout(() => resolve(false), networkIdleTimeout);
            }),
            
            // Strategy 4: Content verification
            new Promise(resolve => {
                setTimeout(async () => {
                    try {
                        const result = await Page._client.Runtime.evaluate({
                            expression: 'document.readyState === "complete" && document.body && document.body.children.length > 0'
                        });
                        if (result.result.value) {
                            loadMethod = 'contentVerification';
                            if (verboseLogging) console.log('Load detected via content verification');
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    } catch {
                        resolve(false);
                    }
                }, 3000);
            })
        ];
        
        // Wait for any strategy to succeed or all to timeout
        const results = await Promise.allSettled(loadStrategies);
        const successful = results.some(result => result.status === 'fulfilled' && result.value);
        
        if (successful) {
            console.log(`Page loaded successfully via ${loadMethod}`);
            return { success: true, method: loadMethod };
        } else {
            console.log('All load detection strategies failed, using fixed delay fallback');
            await new Promise(resolve => setTimeout(resolve, 3000));
            return { success: false, method: 'fixedDelay' };
        }
        
    } finally {
        // Clean up event listeners
        Network.requestWillBeSent(null);
        Network.responseReceived(null);
    }
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
        console.log('Enabling Chrome DevTools domains...');
        await Network.enable();
        console.log('Network domain enabled');
        await Page.enable();
        console.log('Page domain enabled');
        await Runtime.enable();
        console.log('Runtime domain enabled');
        
        // Try multiple test URLs for reliability
        const testUrls = config.testUrl ? [config.testUrl] : [
            'https://httpbin.org/html',
            'https://example.com',
            'data:text/html,<html><head><title>Test</title></head><body><h1>Chrome Connection Test</h1><p>This is a test page.</p></body></html>'
        ];
        
        let navigationSuccess = false;
        let loadResult = null;
        let testUrl = null;
        
        for (let i = 0; i < testUrls.length && !navigationSuccess; i++) {
            testUrl = testUrls[i];
            console.log(`Connected successfully. Navigating to ${testUrl}...`);
            
            try {
                // Navigate to test URL
                const navigationResult = await Page.navigate({url: testUrl});
                console.log('Navigation initiated, frameId:', navigationResult.frameId);
                
                // Wait for page load using enhanced detection
                console.log('Waiting for page to load...');
                loadResult = await waitForPageLoad(Page, testUrl, {
                    verboseLogging: config.verbose,
                    loadTimeout: config.testUrl ? config.timeout : (i === 0 ? 15000 : 10000),
                    networkIdleTimeout: config.testUrl ? Math.min(config.timeout * 0.3, 5000) : (i === 0 ? 5000 : 3000)
                });
                
                // Verify page loaded successfully
                if (loadResult.success || loadResult.method === 'fixedDelay') {
                    console.log(`Successfully loaded ${testUrl} using method: ${loadResult.method}`);
                    navigationSuccess = true;
                } else {
                    console.log(`Failed to load ${testUrl}, trying next URL...`);
                }
                
            } catch (navError) {
                console.log(`Navigation to ${testUrl} failed: ${navError.message}`);
                if (i === testUrls.length - 1) {
                    throw new Error(`All test URLs failed. Last error: ${navError.message}`);
                }
                console.log('Trying next URL...');
            }
        }
        
        if (!navigationSuccess) {
            throw new Error('All navigation attempts failed');
        }
        
        console.log(`Using test URL: ${testUrl}`);
        
        // Wait a bit more for content to render
        console.log('Waiting for content to render...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('Taking screenshot...');
        
        // Take screenshot
        const screenshotOptions = {
            format: config.screenshotFormat
        };
        
        if (config.screenshotFormat === 'jpeg' && config.screenshotQuality) {
            screenshotOptions.quality = config.screenshotQuality;
        }
        
        const screenshot = await Page.captureScreenshot(screenshotOptions);
        
        // Save screenshot to file
        const filename = `screenshot.${config.screenshotFormat}`;
        fs.writeFileSync(filename, screenshot.data, 'base64');
        
        console.log(`Screenshot saved as ${filename}`);
        
    } catch (error) {
        console.log('Failed to connect or take screenshot.');
        
        // Enhanced error diagnostics
        console.error('Error Type:', error.constructor.name);
        console.error('Error Message:', error.message);
        
        if (error.stack) {
            console.error('Stack Trace:');
            console.error(error.stack);
        }
        
        // Additional Chrome connection diagnostics
        if (error.message.includes('connect') || error.message.includes('ECONNREFUSED')) {
            console.error('\nDiagnostic Info:');
            console.error('- Check if Chrome is running on the expected port');
            console.error('- Verify nginx proxy configuration');
            console.error('- Ensure Docker container networking is correct');
            
            try {
                // Try direct health check
                const healthResponse = await fetch('http://localhost:80/health');
                console.error(`- Health endpoint status: ${healthResponse.status}`);
            } catch (healthError) {
                console.error(`- Health endpoint unreachable: ${healthError.message}`);
            }
            
            try {
                // Try direct Chrome DevTools endpoint
                const chromeResponse = await fetch('http://localhost:80/json/version');
                if (chromeResponse.ok) {
                    const data = await chromeResponse.json();
                    console.error(`- Chrome version accessible: ${data.Browser}`);
                } else {
                    console.error(`- Chrome endpoint status: ${chromeResponse.status}`);
                }
            } catch (chromeError) {
                console.error(`- Chrome endpoint unreachable: ${chromeError.message}`);
            }
        }
        
        // Navigation-specific diagnostics
        if (error.message.includes('navigate') || error.message.includes('timeout')) {
            console.error('\nNavigation Diagnostics:');
            console.error('- Network connectivity issues may be present');
            console.error('- Target URL may be unreachable or slow');
            console.error('- Consider using fallback test URLs');
        }
        
        process.exit(1);
    } finally {
        if (client) {
            try {
                await client.close();
                console.log('Chrome connection closed cleanly');
            } catch (closeError) {
                console.error('Error closing Chrome connection:', closeError.message);
            }
        }
    }
}

// Configuration and command line argument parsing
function parseArguments() {
    const args = process.argv.slice(2);
    const config = {
        verbose: args.includes('--verbose') || args.includes('-v'),
        testUrl: null,
        timeout: 15000,
        screenshotFormat: 'png',
        screenshotQuality: 80,
        dryRun: args.includes('--dry-run'),
        help: args.includes('--help') || args.includes('-h')
    };
    
    // Parse specific arguments
    args.forEach((arg, index) => {
        if (arg === '--url' && args[index + 1]) {
            config.testUrl = args[index + 1];
        }
        if (arg === '--timeout' && args[index + 1]) {
            config.timeout = parseInt(args[index + 1]) || 15000;
        }
        if (arg === '--format' && args[index + 1]) {
            config.screenshotFormat = args[index + 1];
        }
        if (arg === '--quality' && args[index + 1]) {
            config.screenshotQuality = parseInt(args[index + 1]) || 80;
        }
    });
    
    return config;
}

function showHelp() {
    console.log(`
Chrome Connection Test Tool

Usage: node test-connection.js [options]

Options:
  --verbose, -v          Enable verbose logging
  --url <url>           Specify custom test URL
  --timeout <ms>        Set page load timeout (default: 15000)
  --format <format>     Screenshot format: png, jpeg, webp (default: png)
  --quality <quality>   Screenshot quality 1-100 (default: 80)
  --dry-run             Test connection only, skip screenshot
  --help, -h            Show this help message

Examples:
  node test-connection.js --verbose
  node test-connection.js --url https://google.com --timeout 20000
  node test-connection.js --dry-run --verbose
`);
}

// Main execution with configuration
const config = parseArguments();

if (config.help) {
    showHelp();
    process.exit(0);
}

async function runTest() {
    const startTime = Date.now();
    
    try {
        console.log('=== Chrome Connection Test Started ===');
        if (config.verbose) {
            console.log('Configuration:', {
                verbose: config.verbose,
                testUrl: config.testUrl || 'auto-detect',
                timeout: config.timeout,
                screenshotFormat: config.screenshotFormat,
                dryRun: config.dryRun
            });
        }
        
        if (config.dryRun) {
            console.log('Running in dry-run mode (connection test only)');
            await testConnection();
        } else {
            await takeScreenshot();
        }
        
        const duration = Date.now() - startTime;
        console.log(`=== Test completed successfully in ${duration}ms ===`);
        process.exit(0);
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`=== Test failed after ${duration}ms ===`);
        console.error('Error:', error.message);
        process.exit(1);
    }
}

async function testConnection() {
    let client;
    
    try {
        console.log('Testing Chrome connection via nginx proxy...');
        
        const healthCheck = await fetch('http://localhost:80/health');
        console.log('Health check response status:', healthCheck.status);
        if (!healthCheck.ok) {
            throw new Error('Health check failed');
        }
        console.log('Health check passed.');
        
        await waitForChromeReady();
        
        client = await connectWithRetry({
            host: 'localhost',
            port: 80
        });
        
        const {Network, Page, Runtime} = client;
        
        console.log('Enabling Chrome DevTools domains...');
        await Network.enable();
        await Page.enable();  
        await Runtime.enable();
        console.log('All domains enabled successfully');
        
        console.log('Connection test completed successfully');
        
    } finally {
        if (client) {
            await client.close();
            console.log('Chrome connection closed cleanly');
        }
    }
}

runTest();
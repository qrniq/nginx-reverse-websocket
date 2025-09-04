const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

describe('Test Connection Screenshot Generation', () => {
    const screenshotFiles = ['screenshot.png', 'screenshot.jpeg', 'screenshot.webp'];
    
    beforeEach(() => {
        // Clean up any existing screenshots before each test
        screenshotFiles.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
    });

    afterEach(() => {
        // Clean up screenshots after each test
        screenshotFiles.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
    });

    test('should successfully run test-connection and generate screenshot', async () => {
        // Run the test-connection script
        const { stdout, stderr } = await execAsync('node test-connection.js', { 
            timeout: 60000,
            cwd: path.resolve(__dirname, '..')
        });

        // Verify the script ran successfully (no errors thrown)
        expect(stdout).toContain('Test completed successfully');
        
        // Check that a screenshot file was created
        const defaultScreenshot = 'screenshot.png';
        expect(fs.existsSync(defaultScreenshot)).toBe(true);
        
        // Verify screenshot file properties
        const stats = fs.statSync(defaultScreenshot);
        expect(stats.size).toBeGreaterThan(0);
        expect(stats.isFile()).toBe(true);
        
        // Verify it's a valid image file by checking file header
        const buffer = fs.readFileSync(defaultScreenshot);
        expect(buffer.length).toBeGreaterThan(8);
        
        // PNG file signature check
        const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        expect(buffer.subarray(0, 8)).toEqual(pngSignature);
    }, 120000); // 2 minute timeout

    test('should generate JPEG screenshot when format is specified', async () => {
        const { stdout } = await execAsync('node test-connection.js --format jpeg', { 
            timeout: 60000,
            cwd: path.resolve(__dirname, '..')
        });

        expect(stdout).toContain('Test completed successfully');
        
        const jpegScreenshot = 'screenshot.jpeg';
        expect(fs.existsSync(jpegScreenshot)).toBe(true);
        
        const stats = fs.statSync(jpegScreenshot);
        expect(stats.size).toBeGreaterThan(0);
        
        // JPEG file signature check (FF D8 FF)
        const buffer = fs.readFileSync(jpegScreenshot);
        expect(buffer[0]).toBe(0xFF);
        expect(buffer[1]).toBe(0xD8);
        expect(buffer[2]).toBe(0xFF);
    }, 120000);

    test('should handle verbose mode correctly', async () => {
        const { stdout } = await execAsync('node test-connection.js --verbose', { 
            timeout: 60000,
            cwd: path.resolve(__dirname, '..')
        });

        expect(stdout).toContain('Configuration:');
        expect(stdout).toContain('verbose: true');
        expect(stdout).toContain('Test completed successfully');
        
        const defaultScreenshot = 'screenshot.png';
        expect(fs.existsSync(defaultScreenshot)).toBe(true);
    }, 120000);

    test('should run connection test in dry-run mode', async () => {
        const { stdout } = await execAsync('node test-connection.js --dry-run', { 
            timeout: 60000,
            cwd: path.resolve(__dirname, '..')
        });

        expect(stdout).toContain('Running in dry-run mode');
        expect(stdout).toContain('Connection test completed successfully');
        expect(stdout).toContain('Test completed successfully');
        
        // No screenshot should be created in dry-run mode
        screenshotFiles.forEach(file => {
            expect(fs.existsSync(file)).toBe(false);
        });
    }, 120000);

    test('should display help when --help flag is used', async () => {
        const { stdout } = await execAsync('node test-connection.js --help', { 
            timeout: 30000,
            cwd: path.resolve(__dirname, '..')
        });

        expect(stdout).toContain('Chrome Connection Test Tool');
        expect(stdout).toContain('Usage: node test-connection.js [options]');
        expect(stdout).toContain('--verbose, -v');
        expect(stdout).toContain('--url <url>');
        expect(stdout).toContain('--timeout <ms>');
        expect(stdout).toContain('--format <format>');
        expect(stdout).toContain('--quality <quality>');
        expect(stdout).toContain('--dry-run');
        expect(stdout).toContain('--help, -h');
    }, 30000);

    test('should handle custom URL parameter', async () => {
        const customUrl = 'https://example.com';
        const { stdout } = await execAsync(`node test-connection.js --url ${customUrl} --verbose`, { 
            timeout: 60000,
            cwd: path.resolve(__dirname, '..')
        });

        expect(stdout).toContain(`testUrl: '${customUrl}'`);
        expect(stdout).toContain('Test completed successfully');
        
        const defaultScreenshot = 'screenshot.png';
        expect(fs.existsSync(defaultScreenshot)).toBe(true);
    }, 120000);

    test('should validate screenshot file size is reasonable', async () => {
        await execAsync('node test-connection.js', { 
            timeout: 60000,
            cwd: path.resolve(__dirname, '..')
        });

        const defaultScreenshot = 'screenshot.png';
        const stats = fs.statSync(defaultScreenshot);
        
        // Screenshot should be at least 1KB but less than 10MB (reasonable bounds)
        expect(stats.size).toBeGreaterThan(1024);
        expect(stats.size).toBeLessThan(10 * 1024 * 1024);
    }, 120000);
});

describe('Test Connection Error Scenarios', () => {
    test('should handle timeout parameter correctly', async () => {
        // Test with a very short timeout to ensure parameter is processed
        const { stdout } = await execAsync('node test-connection.js --timeout 5000 --verbose', { 
            timeout: 60000,
            cwd: path.resolve(__dirname, '..')
        });

        expect(stdout).toContain('timeout: 5000');
    }, 120000);

    test('should handle quality parameter for JPEG', async () => {
        const { stdout } = await execAsync('node test-connection.js --format jpeg --quality 90 --verbose', { 
            timeout: 60000,
            cwd: path.resolve(__dirname, '..')
        });

        expect(stdout).toContain('Test completed successfully');
        
        const jpegScreenshot = 'screenshot.jpeg';
        expect(fs.existsSync(jpegScreenshot)).toBe(true);
    }, 120000);
});
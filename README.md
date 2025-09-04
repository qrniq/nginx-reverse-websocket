# Chrome Debugger Nginx Proxy

A robust nginx reverse proxy solution for Chrome debugger WebSocket connections with automated screenshot testing capabilities.

## Overview

This project provides a reliable nginx reverse proxy that enables secure and stable connections to Chrome's DevTools Protocol through WebSocket forwarding. It includes comprehensive connection testing and screenshot capture functionality to verify Chrome accessibility and proper proxy operation.

## Features

- **Nginx Reverse Proxy**: Stable WebSocket proxy for Chrome DevTools connections
- **Connection Testing**: Automated health checks and connection validation
- **Screenshot Capture**: Automated screenshot generation to verify Chrome functionality
- **Retry Logic**: Robust connection handling with exponential backoff
- **Multiple Load Detection**: Advanced page load detection strategies
- **Flexible Configuration**: Command-line options for customization
- **Comprehensive Testing**: Full test suite with Jest framework

## Prerequisites

- **Node.js** (v14 or higher)
- **Chrome/Chromium** running with debugging enabled
- **nginx** configured with WebSocket proxy support
- **Docker** (optional, for containerized deployment)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd nginx-chrome-debugger-proxy
```

2. Install dependencies:
```bash
npm install
```

## Configuration

### Chrome Setup
Ensure Chrome is running with remote debugging enabled:
```bash
google-chrome --remote-debugging-port=9222 --headless --no-sandbox
```

### Nginx Configuration
The project includes a pre-configured `nginx.conf` that handles:
- WebSocket proxy forwarding
- Health check endpoints
- Chrome DevTools JSON API proxying

## Usage

### Basic Screenshot Test
```bash
node test-connection.js
```

### Available Options
```bash
node test-connection.js [options]

Options:
  --verbose, -v          Enable verbose logging
  --url <url>           Specify custom test URL
  --timeout <ms>        Set page load timeout (default: 15000)
  --format <format>     Screenshot format: png, jpeg, webp (default: png)
  --quality <quality>   Screenshot quality 1-100 (default: 80)
  --dry-run             Test connection only, skip screenshot
  --help, -h            Show help message
```

### Examples

**Basic screenshot with verbose output:**
```bash
node test-connection.js --verbose
```

**Custom URL with specific timeout:**
```bash
node test-connection.js --url https://google.com --timeout 20000
```

**JPEG screenshot with custom quality:**
```bash
node test-connection.js --format jpeg --quality 90
```

**Connection test only (no screenshot):**
```bash
node test-connection.js --dry-run --verbose
```

## Testing

### Run Test Suite
```bash
npm test
```

### Manual Testing
```bash
npm run test:manual
```

### Test Coverage
The test suite includes:
- ✅ Connection establishment verification
- ✅ Screenshot file creation and validation
- ✅ File format verification (PNG, JPEG, WebP)
- ✅ Command-line parameter handling
- ✅ Error scenario testing
- ✅ Dry-run mode validation
- ✅ Help documentation display
- ✅ File cleanup and management

## Project Structure

```
├── test-connection.js      # Main connection test and screenshot script
├── test/
│   └── test-connection.test.js  # Comprehensive test suite
├── nginx.conf             # Nginx proxy configuration
├── Dockerfile             # Container configuration
├── start-chrome.sh        # Chrome startup script
├── package.json           # Node.js dependencies and scripts
└── README.md             # This documentation
```

## How It Works

### Connection Flow
1. **Health Check**: Validates nginx proxy availability
2. **Chrome Ready**: Waits for Chrome DevTools to be accessible
3. **Connection**: Establishes Chrome DevTools Protocol connection
4. **Navigation**: Loads test URL with multiple fallback strategies
5. **Page Load Detection**: Uses multiple strategies to detect page completion
6. **Screenshot**: Captures and saves screenshot in specified format

### Load Detection Strategies
- **Load Event**: Standard `load` event detection
- **DOM Content**: DOM content loaded verification
- **Network Idle**: Network request completion monitoring
- **Content Verification**: Document readiness and content validation

## Troubleshooting

### Common Issues

**Connection refused errors:**
- Verify Chrome is running with `--remote-debugging-port=9222`
- Check nginx configuration and process status
- Ensure port 80 is available for nginx proxy

**Screenshot failures:**
- Verify Chrome has proper permissions for file system access
- Check available disk space for screenshot output
- Ensure target URLs are accessible from Chrome instance

**Test timeouts:**
- Increase timeout values for slow networks: `--timeout 30000`
- Use `--verbose` flag to diagnose connection issues
- Try `--dry-run` to isolate connection problems

### Debug Mode
Enable verbose logging to see detailed connection information:
```bash
node test-connection.js --verbose --dry-run
```

## Docker Usage

If using Docker deployment:
```bash
# Build the container
docker build -t chrome-proxy .

# Run with port mapping
docker run -p 80:80 -p 9222:9222 chrome-proxy
```

## Development

### Contributing
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass: `npm test`
5. Submit a pull request

### Adding New Features
- All new functionality should include corresponding tests
- Follow existing code patterns and error handling approaches
- Update this README for new command-line options or features

## Performance Notes

- Connection establishment typically takes 2-5 seconds
- Screenshot generation adds 3-5 seconds depending on page complexity
- Network idle detection may add 2-5 seconds for dynamic pages
- Total test execution usually completes within 15-30 seconds

## Security Considerations

- This tool is designed for development and testing environments
- Chrome runs with `--no-sandbox` flag for containerized environments
- Nginx proxy should be properly secured for production use
- Consider firewall rules for DevTools port access

## License

MIT - See LICENSE file for details

## Support

For issues and questions:
- Check the troubleshooting section above
- Review test output with `--verbose` flag
- Create an issue in the repository with detailed logs

---
*This project was initialized and enhanced by Terragon Labs*
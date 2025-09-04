FROM fedora:latest

# Update package list and install dependencies
RUN dnf update -y && dnf install -y \
    wget \
    gnupg2 \
    nginx \
    curl \
    && dnf clean all

# Add Google Chrome repository and install Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/pki/rpm-gpg/google-chrome-key.gpg \
    && echo "[google-chrome]" > /etc/yum.repos.d/google-chrome.repo \
    && echo "name=google-chrome" >> /etc/yum.repos.d/google-chrome.repo \
    && echo "baseurl=http://dl.google.com/linux/chrome/rpm/stable/x86_64" >> /etc/yum.repos.d/google-chrome.repo \
    && echo "enabled=1" >> /etc/yum.repos.d/google-chrome.repo \
    && echo "gpgcheck=1" >> /etc/yum.repos.d/google-chrome.repo \
    && echo "gpgkey=file:///etc/pki/rpm-gpg/google-chrome-key.gpg" >> /etc/yum.repos.d/google-chrome.repo \
    && dnf install -y google-chrome-stable \
    && dnf clean all

# Install Node.js
RUN dnf install -y nodejs npm \
    && dnf clean all

# Create app directory
WORKDIR /app

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Generate self-signed SSL certificate
RUN mkdir -p /etc/ssl/certs /etc/ssl/private \
    && openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/nginx-selfsigned.key \
    -out /etc/ssl/certs/nginx-selfsigned.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Copy and make start script executable
COPY start-chrome.sh /app/start-chrome.sh
RUN chmod +x /app/start-chrome.sh

# Copy package.json and install dependencies
COPY package.json /app/package.json
RUN npm install

# Copy test script
COPY test-connection.js /app/test-connection.js

# Expose ports
EXPOSE 80 443 48000-49000

# Set entrypoint
ENTRYPOINT ["/app/start-chrome.sh"]
FROM node:22-bookworm-slim

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code and binaries
COPY . .

# Make the Linux yt-dlp binary executable
RUN chmod +x bin/yt-dlp_linux_aarch64

EXPOSE 3000

CMD ["node", "server.js"]

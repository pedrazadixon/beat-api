FROM node:22-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code and binaries
COPY . .

# Make the Linux yt-dlp binary executable
RUN chmod +x bin/yt-dlp_musllinux_aarch64

# Use the Linux binary at runtime
ENV YTDLP_PATH=/app/bin/yt-dlp_musllinux_aarch64
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["node", "server.js"]

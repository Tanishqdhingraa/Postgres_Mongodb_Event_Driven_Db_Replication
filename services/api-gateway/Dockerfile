FROM node:22-alpine

WORKDIR /app

# Copy the shared package
COPY shared/ ./shared/

# Copy service packages
COPY services/api-gateway/package*.json ./services/api-gateway/

# Install dependencies
WORKDIR /app/services/api-gateway
RUN npm install --omit=dev

# Copy the rest of the application source
COPY services/api-gateway/src/ ./src/

# Expose HTTP port
EXPOSE 3000

# Command to run the application
CMD ["node", "src/index.js"]

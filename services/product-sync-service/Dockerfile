FROM node:22-alpine

WORKDIR /app

# Copy the shared package
COPY shared/ ./shared/

# Copy service packages
COPY services/product-sync-service/package*.json ./services/product-sync-service/

# Install dependencies
WORKDIR /app/services/product-sync-service
RUN npm install --omit=dev

# Copy the rest of the application source
COPY services/product-sync-service/src/ ./src/

# Command to run the application
CMD ["node", "src/index.js"]

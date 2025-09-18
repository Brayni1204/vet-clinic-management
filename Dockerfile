# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies with legacy peer deps to handle dependency conflicts
RUN npm ci --legacy-peer-deps

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install only production dependencies with legacy peer deps
RUN npm ci --only=production --legacy-peer-deps

# Copy built assets and dependencies
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy Next.js config file
COPY --from=builder /app/next.config.mjs ./

# Set environment variables
ENV NODE_ENV production
ENV PORT 3000

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]

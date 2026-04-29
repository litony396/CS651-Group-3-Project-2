# Use Gemini to deploy both frontend and backend at once

# Stage 1: Build the React frontend
FROM node:18 AS frontend-build
WORKDIR /app/frontend
# Copy frontend package.json and install dependencies
COPY frontend/package*.json ./
RUN npm install
# Copy the rest of the frontend code and build it
COPY frontend/ ./
RUN npm run build

# Stage 2: Set up the Express backend
FROM node:18
WORKDIR /app/backend
# Copy backend package.json and install dependencies
COPY backend/package*.json ./
RUN npm install
# Copy the rest of the backend code
COPY backend/ ./
# Copy the compiled React files from Stage 1 into the backend's public folder
COPY --from=frontend-build /app/frontend/build ./public

# Expose the port Cloud Run expects
EXPOSE 8080

# Start the backend server
CMD ["npm", "start"]
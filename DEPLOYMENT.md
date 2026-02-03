# Deployment Guide for Undercover Game

## 1. Prerequisites
- Node.js (v18+)
- NPM
- A hosting provider (Recommended: Render, Railway, or Heroku)

## 2. Environment Variables
You must set the following environment variables on your hosting provider:

### Server (Backend)
- `PORT`: 3000 (or handled by host)
- `CORS_ORIGIN`: The URL of your frontend (e.g., `https://undercover-game-client.onrender.com`)

### Client (Frontend)
- `VITE_SERVER_URL`: The URL of your deployed backend (e.g., `https://undercover-game-server.onrender.com`)

## 3. Deployment Steps

### Option A: Monorepo Deployment (Render.com)
Since this is a monorepo with `client` and `server` folders:

#### Backend Service
1. Create a **Web Service**.
2. **Root Directory**: `server`
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. Note the URL assigned (e.g., `https://my-server.onrender.com`).

#### Frontend Service
1. Create a **Static Site**.
2. **Root Directory**: `client`
3. **Build Command**: `npm install && npm run build`
4. **Publish Directory**: `dist`
5. **Environment Variable**: Add `VITE_SERVER_URL` = `https://my-server.onrender.com` (from above).

### Option B: Manual Build
1. **Server**:
   ```bash
   cd server
   npm install
   npm start
   ```

2. **Client**:
   ```bash
   cd client
   npm install
   npm run build
   # Serve the 'dist' folder using a static server
   npx serve dist
   ```

## 4. Troubleshooting
- **WebSocket Connection Failed**: Check that `VITE_SERVER_URL` in the frontend matches the HTTPS URL of the backend.
- **CORS Issues**: Ensure the Backend environment variable `CORS_ORIGIN` matches the Frontend URL.

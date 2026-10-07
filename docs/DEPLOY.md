# MineGuard Deployment Guide (Firebase Firestore + Render + Vercel)

This guide provides step-by-step instructions for deploying MineGuard to free cloud hosting providers.

---

## 1. Firebase Firestore Setup (Database)

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project named `mineguard-prod`.
2. In the sidebar, navigate to **Build > Firestore Database** and click **Create database**.
3. Select **Production Mode** and choose a multi-region or closest regional location.
4. Navigate to **Project Settings > Service Accounts**.
5. Click **Generate new private key** and download the JSON credentials file.
6. Open the downloaded JSON file, convert its contents into a single-line string or minify it. This JSON will be set as the `FIREBASE_SERVICE_ACCOUNT` environment variable on Render.

---

## 2. Render Deployment (Node.js Backend)

1. Sign up or log in at [Render.com](https://render.com/).
2. Click **New + > Web Service** and connect your GitHub repository containing the MineGuard code.
3. Configure the service settings:
   - **Name**: `mineguard-server`
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
4. Add the following **Environment Variables**:
   - `DB_MODE`: `firebase`
   - `PORT`: `10000` (Render defaults to 10000)
   - `NODE_ENV`: `production`
   - `DEVICE_API_KEY`: `your_custom_device_secret_2026`
   - `JWT_SECRET`: `your_random_long_secret_key`
   - `FIREBASE_SERVICE_ACCOUNT`: `<paste minified service account JSON here>`
   - `CLIENT_ORIGIN`: `https://mineguard.vercel.app` (your Vercel frontend URL)
   - `HISTORY_INTERVAL_SEC`: `10`
   - `OFFLINE_TIMEOUT_SEC`: `30`
5. Click **Create Web Service**. Render will deploy your service and provide a public URL like `https://mineguard-server.onrender.com`.
6. Verify deployment by visiting `https://mineguard-server.onrender.com/healthz`. It should return `{"status":"ok"}`.

---

## 3. Vercel Deployment (React + Vite Frontend)

1. Go to [Vercel](https://vercel.com/) and click **Add New > Project**.
2. Import the repository and configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add the **Environment Variable**:
   - `VITE_API_URL`: `https://mineguard-server.onrender.com` (Your Render backend URL)
4. Click **Deploy**. Vercel will build and publish your dashboard at `https://your-project.vercel.app`.

---

## 4. Troubleshooting Matrix

| Symptom / Error Code | Root Cause | Solution |
|---|---|---|
| **HTTP 401 Unauthorized** | Invalid or missing `x-api-key` header on ESP32 POST request. | Check `x-api-key` in firmware matches `DEVICE_API_KEY` on server. |
| **Status -1 / "Waking up server..."** | Render free instance spun down due to inactivity (cold start). | Wait 30–50s for the container to wake up. The frontend handles this automatically. |
| **Empty Dashboard / CORS Error** | `CLIENT_ORIGIN` on backend does not match the frontend domain. | Update `CLIENT_ORIGIN` in Render environment variables with your Vercel URL. |
| **No Live Updates via Socket.IO** | Socket.IO unable to reach backend or polling fallback blocked. | Verify `VITE_API_URL` points to the correct `https://...` address on Render. |
| **Firestore Permission Error** | Invalid or expired service account JSON. | Re-generate key in Firebase Console and update `FIREBASE_SERVICE_ACCOUNT`. |

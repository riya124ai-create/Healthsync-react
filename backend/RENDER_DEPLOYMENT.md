# HealthSync Backend - Render Deployment

## Environment Variables to Set in Render Dashboard:

```
MONGODB_URI=mongodb+srv://akankshrakesh:rv1NI5uaVCuhWCCI@cluster0.2i5lean.mongodb.net/?appName=Cluster0
MONGODB_DB=healthsync
JWT_SECRET=oogaboogabooga
FRONTEND_URL=https://healthsync-react.vercel.app
PORT=4000
NODE_ENV=production
```

## Render Configuration:

- **Build Command**: `npm install`
- **Start Command**: `node index.js`
- **Auto-Deploy**: Enabled (deploys on git push)
- **Health Check Path**: `/health`

## Important Notes:

1. **Free Tier Spin Down**: Render free tier spins down after 15 minutes of inactivity
2. **Keep-Alive**: The frontend automatically pings the backend every 10 minutes to keep it awake
3. **Cold Start**: First request after spin down may take 30-60 seconds
4. **Socket.IO**: Works on Render (unlike Vercel serverless)

## Frontend Configuration:

Update your React `.env.production` file:

```
VITE_API_URL=https://your-render-url.onrender.com
VITE_API_BASE_URL=/api
```

Replace `your-render-url` with your actual Render service URL.

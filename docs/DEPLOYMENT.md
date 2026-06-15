# Deployment

## Railway (fastest)
1. Push repo to GitHub
2. Go to railway.app and create new project from GitHub
3. Add env vars: HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, ANTHROPIC_API_KEY, HEDERA_NETWORK=testnet
4. Railway detects the Dockerfile automatically
5. Go to Settings then Networking then Generate Domain

## Local dev
cp .env.example .env
npm install
cd frontend && npm install && cd ..
npm run dev
Frontend at http://localhost:5173
API at http://localhost:3001

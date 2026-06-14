# xPay

> Week 5 Bounty — AI payment agent with policy enforcement on Hedera

xPay is an autonomous AI agent that enforces runtime policies before
executing any HBAR or USDC payment on the Hedera network. Users connect
their wallet via WalletConnect 2.0 and sign transactions directly.

## Stack
- hedera-agent-kit@3.8.2
- @hashgraph/sdk@^2.51.0
- @hashgraph/hedera-wallet-connect@2.1.3
- LangGraph + Claude Sonnet
- React + Vite + TypeScript

## Policy Hooks
- SpendLimit — blocks if daily cap exceeded
- Allowlist — blocks unknown counterparties
- ApprovalThreshold — gates high-value HBAR for human sign-off
- Anomaly — flags suspicious recipients or amounts

## Services
- AI Credits: OpenAI, Claude, Stability AI, Groq
- Dev Infra: Pinecone, Alchemy, QuickNode, IPFS
- Data Intel: Moralis, TheGraph, Chainlink, Nansen
- Security: CertiK, Forta, Tenderly, Hexagate

## Quick Start
cp .env.example .env
npm install
cd frontend && npm install && cd ..
npm run dev

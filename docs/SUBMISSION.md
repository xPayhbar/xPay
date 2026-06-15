# xPay — Week 5 Bounty Submission

## Project name
xPay

## Short description
xPay is an AI payment agent that enforces runtime policies before executing
HBAR or USDC payments on Hedera. Users connect HashPack, Blade, or Kabila
via WalletConnect 2.0 and sign approved transactions directly from their wallet.

## GitHub repo
https://github.com/xPayhbar/xPay

## Live demo
https://YOUR_RAILWAY_URL.railway.app

## Implementation
Built with hedera-agent-kit@3.8.2, @hashgraph/sdk@^2.51.0,
@hashgraph/hedera-wallet-connect@2.1.3, LangGraph, Claude Sonnet.
Four policy hooks run before every transfer: SpendLimit, Allowlist,
ApprovalThreshold, Anomaly. Service categories: AI Credits, Dev Infra,
Data Intelligence, Security Services.

## Feedback
https://github.com/hashgraph/hedera-agent-kit-js/issues/new

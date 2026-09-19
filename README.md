# ScamLens 🛡️

ScamLens is a professional, privacy-conscious front-end prototype for explainable digital-fraud analysis. It analyzes suspicious messages and URLs with deterministic local heuristics, then presents evidence, a risk indicator, an attack timeline, and safety actions.

## Features

- Professional responsive cybersecurity SaaS UI
- Message, URL, screenshot and QR analysis modes
- Local heuristic risk engine for common scam signals
- Evidence cards and plain-language explanations
- Attack timeline
- Safety-action recommendations
- Scan report saving in browser localStorage
- Downloadable text report
- URL analysis without opening submitted URLs
- Demo examples for bank/KYC, job and delivery scams
- Mobile responsive design

## Run locally

This project has no build step and no required API key.

### Option 1 — Python

```bash
python -m http.server 4173
```

Then open `http://localhost:4173`.

### Option 2 — Node.js

```bash
npx serve .
```

## Production AI integration

The included demo is deliberately dependency-free and does not call an external AI service. For a production deployment, put an authenticated server-side API route between the browser and an AI/OCR provider. Never expose provider API keys in `app.js` or browser code.

Recommended production pipeline:

`Input → validation → extraction/OCR → deterministic checks → AI structured analysis → risk engine → explainable result`

## Security notes

- Submitted URLs are treated as untrusted text and are never automatically opened.
- Add server-side rate limiting and file validation before production deployment.
- Do not store OTPs, passwords, PINs, CVVs or other sensitive secrets.
- Automated analysis is decision support, not a guarantee that content is safe or fraudulent.

## Folder structure

```text
scamlens/
├── index.html
├── README.md
├── css/
│   └── styles.css
├── js/
│   └── app.js
└── assets/
```

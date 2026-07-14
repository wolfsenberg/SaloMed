# ── SaloMed Frontend (Next.js 14 standalone) ─────────────────────────────────

# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies (use lockfile for reproducible builds)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
COPY . .

# Build-time public env vars (baked into the client bundle)
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_CONTRACT_ID=CA6X5ZJ24LBJBCRHSAJK5EXB7CMEED2X2JTDLTPBOZC3SM4ABZYNIRCG
ARG NEXT_PUBLIC_TOKEN_CONTRACT_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
ARG NEXT_PUBLIC_ADMIN_ADDRESS=GBSXYPN2XWTJEZPLAMRIYQQVQTCJ2MEQOVOA3G73USGCMEXJ5YXPU2G7
ARG NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
ARG NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CONTRACT_ID=$NEXT_PUBLIC_CONTRACT_ID
ENV NEXT_PUBLIC_TOKEN_CONTRACT_ID=$NEXT_PUBLIC_TOKEN_CONTRACT_ID
ENV NEXT_PUBLIC_ADMIN_ADDRESS=$NEXT_PUBLIC_ADMIN_ADDRESS
ENV NEXT_PUBLIC_RPC_URL=$NEXT_PUBLIC_RPC_URL
ENV NEXT_PUBLIC_NETWORK_PASSPHRASE=$NEXT_PUBLIC_NETWORK_PASSPHRASE

RUN npm run build

# Stage 2: Runtime (minimal standalone image)
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy the standalone output produced by `output: "standalone"`
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]

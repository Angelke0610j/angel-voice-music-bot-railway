FROM node:22-bookworm-slim

WORKDIR /app

# Install tools needed to compile native Node.js audio modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    pkg-config \
    libopus-dev \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV npm_config_python=/usr/bin/python3

COPY package*.json ./

RUN npm install --omit=dev

COPY src ./src

CMD ["npm", "start"]

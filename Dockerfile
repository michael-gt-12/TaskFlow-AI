FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./

RUN npm install -g pnpm@11.5.0

RUN pnpm install --no-frozen-lockfile

COPY . .

RUN pnpm prisma:generate

RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]

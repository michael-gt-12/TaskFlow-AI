FROM node:22-alpine

# Prisma's query engine links against OpenSSL on Alpine/musl.
RUN apk add --no-cache openssl

WORKDIR /app

# Non-interactive install: never stop on the pnpm build-scripts approval prompt.
ENV CI=true

# pnpm 10 honors the `pnpm.onlyBuiltDependencies` allow-list in package.json, so
# the prisma/esbuild postinstall scripts run instead of failing with
# ERR_PNPM_IGNORED_BUILDS (pnpm 11 ignores that field and hard-errors).
RUN npm install -g pnpm@10.34.1

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --no-frozen-lockfile

COPY . .

RUN pnpm prisma:generate

RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]

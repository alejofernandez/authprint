# Stage 1: Install dependencies
FROM oven/bun:1.3.14 AS deps
WORKDIR /app

# Copy workspace configuration and lockfiles
COPY package.json bun.lock ./
COPY packages/dsl/package.json ./packages/dsl/
COPY packages/dsl-spec/package.json ./packages/dsl-spec/
COPY apps/web/package.json ./apps/web/

# Install dependencies using frozen-lockfile and ignore lifecycle scripts
# (This avoids running the 'prepare' script which runs 'lefthook install' and requires git)
RUN bun install --frozen-lockfile --ignore-scripts

# Stage 2: Build the standalone application
FROM oven/bun:1.3.14 AS builder
WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app ./

# Copy source files (respecting .dockerignore)
COPY . .

# Bake OCI build metadata for /api/build-info in production (no .git in the image).
ARG OCI_REVISION=unknown
ARG OCI_CREATED
ARG OCI_REF=unknown
RUN OCI_REVISION="$OCI_REVISION" OCI_CREATED="$OCI_CREATED" OCI_REF="$OCI_REF" \
  bun -e 'Bun.write("apps/web/build-info.json", JSON.stringify({sha: Bun.env.OCI_REVISION ?? "unknown", ref: Bun.env.OCI_REF ?? "unknown", builtAt: Bun.env.OCI_CREATED || null, version: null}))'

# Run build
ENV NODE_ENV=production
RUN bun run build

# Stage 3: Minimal runner environment
FROM oven/bun:1.3.14-slim AS runner
WORKDIR /app

# Setup production environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

EXPOSE 8080

# Next.js standalone output contains server.js and traced files
COPY --from=builder /app/apps/web/.next/standalone ./

# Next.js standalone requires manually copying public/ and .next/static/ assets
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/build-info.json ./apps/web/build-info.json

# Build OCI image versioning labels
ARG OCI_REVISION
ARG OCI_SOURCE="https://github.com/alejofernandez/authprint"
ARG OCI_CREATED

LABEL org.opencontainers.image.title="authprint-editor" \
      org.opencontainers.image.description="Authprint editor data-plane service" \
      org.opencontainers.image.source="${OCI_SOURCE}" \
      org.opencontainers.image.revision="${OCI_REVISION}" \
      org.opencontainers.image.created="${OCI_CREATED}" \
      org.opencontainers.image.licenses="MIT"

# Start the standalone server using Bun
CMD ["bun", "run", "apps/web/server.js"]

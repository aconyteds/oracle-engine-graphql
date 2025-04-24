# Stage 1: Build Stage
FROM oven/bun:latest AS build

ENV HUSKY=0

# Set working directory
WORKDIR /src

# Copy package.json and bun.lockb (if using bun for dependency management) to install dependencies
COPY package.json bun.lockb ./
COPY codegen.ts ./

# Copy the rest of the application files
COPY . .

# Install dependencies using Bun
RUN bun install

COPY prisma ./prisma

RUN bunx prisma generate
# Build the application (if applicable, for TypeScript or other builds)
RUN bun run build

# Stage 2: Production Stage
FROM oven/bun:latest AS production

# Set working directory
WORKDIR /src

# Copy only the necessary files from the build stage
COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/dist ./dist
COPY --from=build /src/src ./src
COPY --from=build /src/prisma ./prisma

ENV PORT 3000
# Set the environment to production
ENV NODE_ENV=production

# Expose the port the app runs on
EXPOSE 3000

# Command to run the app
CMD ["bun", "dist/index.js"]

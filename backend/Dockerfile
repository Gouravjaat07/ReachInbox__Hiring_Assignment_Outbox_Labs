FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Generate Prisma Client before TypeScript build
RUN npx prisma generate
RUN npm run build
CMD ["npm", "run", "start"]
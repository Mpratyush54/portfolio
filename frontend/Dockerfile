FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:stable-alpine AS runtime-base
COPY nginx.conf /etc/nginx/conf.d/default.conf

FROM runtime-base AS runtime-prebuilt
COPY dist/frontend /usr/share/nginx/html
RUN if find /usr/share/nginx/html -type f -name '*.map' | grep -q .; then \
      echo 'Source maps must be uploaded and removed before image assembly.' >&2; \
      exit 1; \
    fi

FROM runtime-base AS runtime
COPY --from=build /app/dist/frontend /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

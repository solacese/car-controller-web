FROM node:10.18.0-alpine3.11 AS build

# Create app directory
WORKDIR /src

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

RUN npm run build

FROM nginx:1.15.8-alpine

RUN apk add --update --no-cache curl

WORKDIR /usr/src/service

COPY --from=build /src/build ./dist
COPY --from=build /src/nginx ./nginx

RUN ["chmod", "+x", "./nginx/entrypoint.sh"]

ENTRYPOINT [ "ash", "./nginx/entrypoint.sh" ]

# First build frontend
FROM node as frontend-builder

WORKDIR /app

COPY queue_alert_frontend/app .

RUN yarn install
RUN npm run build

# Next build backend
FROM rust as backend-builder

WORKDIR /app

COPY . .

RUN cargo build --release
RUN mv ./target/release/queue_alert_server ./queue_alert_server_app

COPY --from=frontend-builder /app/build ./www

CMD ["./queue_alert_server_app"]
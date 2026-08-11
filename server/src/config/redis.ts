import { createClient } from "redis";


const redisClient = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
    pingInterval: 30000, // Send a PING every 30 seconds to keep the connection alive
});

redisClient.on("error", (err) => {
    console.error("Redis Client Error : ", err);
});


redisClient.on("connect", () => {
    console.log("Redis Connected Successfully ");
});

export default redisClient;
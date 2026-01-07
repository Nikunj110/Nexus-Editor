import express, { type Request, type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import redisClient from "./config/redis.js";

dotenv.config();

const app = express();

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3001;
app.use(express.json());

app.use(cors());

io.on("connection", (socket) => {
    console.log("User Connected ", socket.id);

    //for Joining the Room

    socket.on("join-room", async (documentId) => {
        socket.join(documentId);
        console.log(`User ${socket.id} joined room: ${documentId}`)
        //When New User Joins the Room Show The Data Of That rooms Which Are Already on redis
        try {
            const storeCode = await redisClient.get(documentId);

            if (storeCode) {
                socket.emit("load-document", storeCode);
            }

        } catch (error) {
            console.error("Redis Get Error : ", error);
        }
    })

    // When a user types, they send "code-change". We broadcast it to the room.
    socket.on("code-change", async ({ documentId, code }) => {
        // .to(room) sends to everyone in that room EXCEPT the sender
        socket.to(documentId).emit("code-update", code);

        try {
            // 'EX' sets an expiration time (e.g., 1 day) so unused keys eventually clear up
            // You can remove 'EX', 86400 if you want it to persist forever until manually deleted
            await redisClient.set(documentId, code, { EX: 86400 });
        } catch (error) {
            console.error("Redis Set Error:", error);
        }
    });

    socket.on("disconnect", () => {
        console.log("User disConnected ", socket.id);

    })
})

app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
        message: "Welcome to the Nexus Editor API"
    });
})

const startServer = async () => {
    try {
        await redisClient.connect();

        httpServer.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        })

    } catch (error) {
        console.error("Failed to start server: ", error);
    }
}

startServer();
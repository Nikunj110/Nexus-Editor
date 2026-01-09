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

        //Updates the User Counts on join
        const sockets = await io.in(documentId).fetchSockets();

        // Broadcast the count to everyone in the room (including the new user)
        io.to(documentId).emit("user-count-update", sockets.length);

        //When New User Joins the Room Show The Data Of That rooms Which Are Already on redis
        try {
            const storeCode = await redisClient.get(documentId);
            const storedLanguage = await redisClient.get(`${documentId}-language`);

            if (storeCode) {
                socket.emit("load-document", storeCode);
            }

            if (storedLanguage) {
                socket.emit("language-update", storedLanguage);
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

    //Handle Language Changes
    socket.on("language-change", async ({ documentId, language }) => {
        // 1. Broadcast to everyone else in the room
        socket.to(documentId).emit("language-update", language);
        //2. we are doing that store  language in redis
        try {
            await redisClient.set(`${documentId}-language`, language, { EX: 86400 })
        } catch (error) {
            console.error("Redis Language Set Error:", error);
        }
    })

    socket.on("disconnecting", async () => {
        console.log("User disConnecting ", socket.id);
        // socket.rooms contains the rooms the user is in.
        // We loop through them to notify others they left.
        for (const room of socket.rooms) {
            if (room !== socket.id) {
                // We emit to the room *before* they officially leave the socket list, 
                // so we calculate count - 1
                const sockets = await io.in(room).fetchSockets();
                io.to(room).emit("user-count-update", sockets.length - 1);
            }
        }

    })
    socket.on("disconnect", () => {
        console.log("User disconnected ", socket.id);
    });
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
import express, { type Request, type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import redisClient from "./config/redis.js";
import { PrismaClient } from "@prisma/client"

dotenv.config();

const app = express();

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const prisma = new PrismaClient();

const defaultValue = "// Start coding...";

// Helper function using Prisma's awesome "upsert" (Update or Insert)
async function findOrCreateDocument(id: any) {
    if (id == null) return

    // Upsert looks for the document. If it doesn't exist, it creates it.
    // If it does exist, it just returns it without updating anything.
    const document = await prisma.document.upsert({
        where: { id: id },
        update: {},// Do nothing if it exists,
        create: {
            id: id,
            content: defaultValue,
            language: "javascript"
        }
    })

    return document;
}
const PORT = process.env.PORT || 3001;
app.use(express.json());

app.use(cors());

const userSocketMap = new Map(); //For tracking Users
io.on("connection", (socket) => {
    console.log("User Connected ", socket.id);

    //for Joining the Room

    socket.on("join-room", async ({ roomId, username }) => {
        socket.join(roomId);
        //new Joinee Added there 
        userSocketMap.set(socket.id, { roomId, username });
        console.log(`User ${username} joined room ${roomId}`);

        // --- FETCH FROM POSTGRES ---
        const document = await findOrCreateDocument(roomId);

        // Send the saved code to the client
        socket.emit("load-document", document.content);
        socket.emit("language-update", document.language);

        //Updates the User Counts on join
        const sockets = await io.in(roomId).fetchSockets();

        // Broadcast the count to everyone in the room (including the new user)
        const clients = io.sockets.adapter.rooms.get(roomId);
        io.to(roomId).emit("user-count-update", clients ? clients.size : 0);

        // Tell others in the room who joined
        socket.to(roomId).emit("user-joined", username);
        //When New User Joins the Room Show The Data Of That rooms Which Are Already on redis
        try {
            const storeCode = await redisClient.get(roomId);
            const storedLanguage = await redisClient.get(`${roomId}-language`);

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

    //Handle Cursor Movements
    socket.on("cursor-change", ({ roomId, cursorData }) => {
        // Relay the cursor position to everyone else in the room
        socket.to(roomId).emit("cursor-update", {
            socketId: socket.id,
            ...cursorData
        })
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

        // Find who left
        const userData = userSocketMap.get(socket.id);

        if (userData) {
            // Tell the room this specific person left
            io.to(userData.roomId).emit("user-left", userData.username);
            // Tell the room to remove their cursor
            io.to(userData.roomId).emit("cursor-remove", socket.id);

            // Update user count
            const clients = io.sockets.adapter.rooms.get(userData.roomId);
            io.to(userData.roomId).emit("user-count-update", clients ? clients.size : 0);

            // Clean up memory
            userSocketMap.delete(socket.id);
        }
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
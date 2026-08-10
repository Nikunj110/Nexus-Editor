import "dotenv/config.js";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import redisClient from "./config/redis.js";
import { PrismaClient } from "@prisma/client";
import executeRouter from "./routes/execute.js";
import roomsRouter from "./routes/rooms.js";

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

// --- DEBOUNCE INFRASTRUCTURE ---
// Maps roomId → timeout handle, so we only write to Postgres after typing stops
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 2000; // 2 seconds after last keystroke

async function debouncedSaveToPostgres(roomId: string, code: string, language?: string) {
    // Clear any existing timer for this room
    const existing = saveTimers.get(roomId);
    if (existing) clearTimeout(existing);

    // Schedule a new write
    const timer = setTimeout(async () => {
        saveTimers.delete(roomId);
        try {
            const updateData: { content: string; language?: string; lastActiveAt: string } = {
                content: code,
                lastActiveAt: new Date().toISOString(),
            };
            if (language) updateData.language = language;

            await prisma.document.upsert({
                where: { id: roomId },
                update: updateData,
                create: {
                    id: roomId,
                    content: code,
                    language: language || "javascript",
                },
            });
            console.log(`[Postgres] Saved room ${roomId}`);
        } catch (error) {
            console.error(`[Postgres] Failed to save room ${roomId}:`, error);
        }
    }, DEBOUNCE_MS);

    saveTimers.set(roomId, timer);
}

// Immediately flush a room's latest code from Redis to Postgres
async function flushRoomToPostgres(roomId: string) {
    // Cancel any pending debounced save
    const existing = saveTimers.get(roomId);
    if (existing) {
        clearTimeout(existing);
        saveTimers.delete(roomId);
    }

    try {
        const code = await redisClient.get(roomId);
        const language = await redisClient.get(`${roomId}-language`);

        if (code !== null) {
            const updateData: { content: string; language?: string; lastActiveAt: string } = {
                content: code,
                lastActiveAt: new Date().toISOString(),
            };
            if (language) updateData.language = language;

            await prisma.document.upsert({
                where: { id: roomId },
                update: updateData,
                create: {
                    id: roomId,
                    content: code,
                    language: language || "javascript",
                },
            });
            console.log(`[Postgres] Flushed room ${roomId} on last user leave`);
        }
    } catch (error) {
        console.error(`[Postgres] Flush failed for room ${roomId}:`, error);
    }
}

// Helper function using Prisma's awesome "upsert" (Update or Insert)
async function findOrCreateDocument(id: string) {
    if (!id) return null;

    const document = await prisma.document.upsert({
        where: { id: id },
        update: {
            lastActiveAt: new Date().toISOString(),
        },
        create: {
            id: id,
            content: defaultValue,
            language: "javascript",
        },
    });

    return document;
}

// --- EXPRESS MIDDLEWARE ---
const PORT = process.env.PORT || 3001;
app.use(express.json());
app.use(cors());

// --- REST API ROUTES ---
app.use("/api/execute", executeRouter);
app.use("/api/rooms", roomsRouter);

app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
        message: "Welcome to the Nexus Editor API"
    });
});

// --- SOCKET.IO ---
const userSocketMap = new Map(); //For tracking Users

function broadcastUserList(roomId: string, excludeSocketId?: string) {
    const clients = io.sockets.adapter.rooms.get(roomId);
    const users: string[] = [];
    if (clients) {
        clients.forEach((id) => {
            if (id !== excludeSocketId) {
                const data = userSocketMap.get(id);
                if (data) users.push(data.username);
            }
        });
    }
    io.to(roomId).emit("user-list-update", users);
}

io.on("connection", (socket) => {
    console.log("User Connected ", socket.id);

    //for Joining the Room
    socket.on("join-room", async (payload: any) => {
        if (!payload || !payload.roomId || !payload.username) {
            console.error("Invalid join-room payload:", payload);
            return;
        }
        const { roomId, username } = payload;

        socket.join(roomId);
        //new Joinee Added there 
        userSocketMap.set(socket.id, { roomId, username });
        console.log(`User ${username} joined room ${roomId}`);

        // --- LOAD ROOM STATE ---
        // Priority: Redis (newest real-time state) > Postgres (persistent source of truth)
        try {
            const redisCode = await redisClient.get(roomId);
            const redisLanguage = await redisClient.get(`${roomId}-language`);

            if (redisCode !== null) {
                // Redis has the latest state — use it
                socket.emit("load-document", redisCode);
                socket.emit("language-update", redisLanguage || "javascript");
            } else {
                // Fall back to Postgres
                const document = await findOrCreateDocument(roomId);
                if (document) {
                    socket.emit("load-document", document.content);
                    socket.emit("language-update", document.language);
                }
            }
        } catch (error) {
            console.error("Error loading room state:", error);
            // Last resort: try Postgres directly
            try {
                const document = await findOrCreateDocument(roomId);
                if (document) {
                    socket.emit("load-document", document.content);
                    socket.emit("language-update", document.language);
                }
            } catch (pgError) {
                console.error("Postgres fallback also failed:", pgError);
            }
        }

        //Updates the User Counts on join
        const clients = io.sockets.adapter.rooms.get(roomId);
        io.to(roomId).emit("user-count-update", clients ? clients.size : 0);
        broadcastUserList(roomId);

        // Tell others in the room who joined
        socket.to(roomId).emit("user-joined", username);
    });

    //Handle Cursor Movements
    socket.on("cursor-change", ({ roomId, cursorData }) => {
        // Relay the cursor position to everyone else in the room
        socket.to(roomId).emit("cursor-update", {
            socketId: socket.id,
            ...cursorData
        });
    });

    // When a user types, they send "code-change". We broadcast it to the room.
    socket.on("code-change", async ({ roomId, code }) => {
        if (!roomId || code === undefined) return;

        // 1. Broadcast immediately to other users
        socket.to(roomId).emit("code-update", code);

        // 2. Cache in Redis for fast access
        try {
            await redisClient.set(roomId, code, { EX: 86400 });
        } catch (error) {
            console.error("Redis Set Error:", error);
        }

        // 3. Debounced write to Postgres (waits 2s after last keystroke)
        debouncedSaveToPostgres(roomId, code);
    });

    //Handle Language Changes
    socket.on("language-change", async ({ roomId, language }) => {
        if (!roomId || !language) return;

        // 1. Broadcast to everyone else in the room
        socket.to(roomId).emit("language-update", language);

        // 2. Cache in Redis
        try {
            await redisClient.set(`${roomId}-language`, language, { EX: 86400 });
        } catch (error) {
            console.error("Redis Language Set Error:", error);
        }

        // 3. Immediate Postgres write (language changes are infrequent)
        try {
            await prisma.document.upsert({
                where: { id: roomId },
                update: { language, lastActiveAt: new Date().toISOString() },
                create: { id: roomId, content: defaultValue, language },
            });
        } catch (error) {
            console.error("Postgres Language Save Error:", error);
        }
    });

    socket.on("disconnecting", async () => {
        console.log("User disConnecting ", socket.id);

        // Find who left
        const userData = userSocketMap.get(socket.id);

        if (userData) {
            const { roomId, username } = userData;

            // Tell the room this specific person left
            io.to(roomId).emit("user-left", username);
            // Tell the room to remove their cursor
            io.to(roomId).emit("cursor-remove", socket.id);

            // Check how many users remain (subtract 1 for the leaving user)
            const clients = io.sockets.adapter.rooms.get(roomId);
            const remainingCount = clients ? clients.size - 1 : 0;
            io.to(roomId).emit("user-count-update", remainingCount);
            broadcastUserList(roomId, socket.id);

            // If this is the last user leaving, flush to Postgres
            if (remainingCount === 0) {
                await flushRoomToPostgres(roomId);
            }

            // Clean up memory
            userSocketMap.delete(socket.id);
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected ", socket.id);
    });
});

// --- SERVER START ---
const startServer = async () => {
    try {
        await redisClient.connect();

        httpServer.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

    } catch (error) {
        console.error("Failed to start server: ", error);
    }
};

startServer();
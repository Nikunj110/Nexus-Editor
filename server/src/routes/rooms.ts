import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";

const router = Router();
const prisma = new PrismaClient();

// GET /api/rooms/:roomId — Check if a room exists, return its data
router.get("/:roomId", async (req: Request, res: Response) => {
    const { roomId } = req.params;

    if (!roomId || typeof roomId !== "string" || roomId.trim().length === 0) {
        res.status(400).json({ error: "Invalid room ID." });
        return;
    }

    try {
        const document = await prisma.document.findUnique({
            where: { id: roomId },
        });

        if (!document) {
            // Room doesn't exist yet — that's fine, the socket join-room will create it
            res.json({ exists: false, roomId });
            return;
        }

        res.json({
            exists: true,
            roomId: document.id,
            language: document.language,
            createdAt: document.createdAt,
            lastActiveAt: document.lastActiveAt,
        });
    } catch (error) {
        console.error("Error fetching room:", error);
        res.status(500).json({ error: "Failed to fetch room data." });
    }
});

export default router;

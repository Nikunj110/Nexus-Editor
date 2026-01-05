import express, { type Request,type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();

const httpServer = createServer(app);

const io = new Server(httpServer,{
    cors:{
        origin:"*",
        methods:["GET","POST"]
    }
});

const PORT = process.env.PORT || 3001;
app.use(express.json());

app.use(cors());

app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
        message: "Welcome to the Nexus Editor API"
    });
})

httpServer.listen(PORT, () => {
   console.log(`Server is running on port ${PORT}`);
})

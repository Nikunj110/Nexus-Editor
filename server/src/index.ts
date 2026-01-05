import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv"

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3001;
app.use(express.json());

app.use(cors());

app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
        message: "Welcome to the Nexus Editor API"
    });
})

app.listen(PORT, () => {
   console.log(`Server is running on port ${PORT}`);
})

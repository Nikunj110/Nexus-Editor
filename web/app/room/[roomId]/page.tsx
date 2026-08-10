"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CollaborativeEditor from "@/components/CollaborativeEditor";

const RoomPage = () => {
    const { roomId } = useParams();
    const router = useRouter();
    const [username, setUsername] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Read the username stored by the landing page
        const storedUsername = sessionStorage.getItem("nexus-username");

        if (!storedUsername) {
            // No username — redirect to landing page to enter one
            router.push("/");
            return;
        }

        setUsername(storedUsername);
        setLoading(false);
    }, [router]);

    if (!roomId || loading) {
        return (
            <div style={{
                height: "100vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                background: "#121212",
                color: "#888",
                fontFamily: "sans-serif"
            }}>
                Loading room...
            </div>
        );
    }

    return (
        <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
            <CollaborativeEditor roomId={roomId as string} username={username!} />
        </div>
    );
};

export default RoomPage;
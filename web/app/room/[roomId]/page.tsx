"use client";

import CollaborativeEditor from "@/components/CollaborativeEditor";

import { useParams } from "next/navigation";

const RoomPage = () => {
    //Take roomid from the parameters
    const { roomId } = useParams();

    if (!roomId) {
        return <div>Loading...</div>;
    }


    return (<div>
        <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
            {/* Pass the dynamic ID to your component */}
            <CollaborativeEditor documentId={roomId as string} />
        </div>
    </div>)
}


export default RoomPage;
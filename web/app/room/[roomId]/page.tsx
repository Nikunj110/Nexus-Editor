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
            <CollaborativeEditor roomId={roomId as string} username="Guest Developer" />
        </div>
    </div>)
}


export default RoomPage;
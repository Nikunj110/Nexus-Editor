"use client"

import React, { useState } from "react";
import { v4 as uuidV4 } from "uuid";
import { useRouter } from "next/navigation";

export default function Home(){
  const router = useRouter();

  const [roomId, setRoomId] = useState("");

  const createNewRoom = (e:React.MouseEvent<HTMLAnchorElement>)=>{
    e.preventDefault();
    // Generate unique ID
    const id = uuidV4();

    // Redirect to new room
    router.push(`/room/${id}`);
  }

  const joinRoom = () => {
    if (!roomId) return;
    router.push(`/room/${roomId}`);
  };

  const handleEnterKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
        joinRoom();
    }
  }

  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      height: "100vh", 
      backgroundColor: "#1e1e1e", 
      color: "#fff" 
    }}>
      <div style={{ 
        background: "#252526", 
        padding: "2rem", 
        borderRadius: "10px", 
        width: "400px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
      }}>
        <h2 style={{ marginBottom: "20px", textAlign: "center" }}>Nexus Editor</h2>
        
        <div style={{ marginBottom: "15px" }}>
           <label style={{ display: "block", marginBottom: "5px" }}>Paste Room ID</label>
           <input 
              type="text" 
              placeholder="e.g. 8493-abc-..." 
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyUp={handleEnterKey}
              style={{ 
                 width: "100%", 
                 padding: "10px", 
                 borderRadius: "5px", 
                 border: "1px solid #444",
                 background: "#1e1e1e",
                 color: "#fff"
              }}
           />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
           <button 
             onClick={joinRoom}
             style={{ 
                padding: "10px 20px", 
                background: "#007acc", 
                color: "white", 
                border: "none", 
                borderRadius: "5px",
                cursor: "pointer",
                fontWeight: "bold"
             }}
           >
             Join
           </button>

           <span style={{ fontSize: "14px", color: "#888" }}>
              or &nbsp;
              <a href="#" onClick={createNewRoom} style={{ color: "#007acc" }}>
                 create new room
              </a>
           </span>
        </div>
      </div>
    </div>
  )
}
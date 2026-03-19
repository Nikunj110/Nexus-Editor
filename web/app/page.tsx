"use client";
import React, { useState } from "react";
import CollaborativeEditor from "../components/CollaborativeEditor";
import { v4 as uuidV4 } from "uuid";

export default function Home() {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !username) {
      alert("Please enter both Room ID and Username");
      return;
    }
    setJoined(true);
  };

  const createNewRoom = (e: React.MouseEvent) => {
    e.preventDefault();
    // Generate a random room ID (simple random string or UUID)
    const newId = Math.random().toString(36).substring(2, 9);
    setRoomId(newId);
  };

  if (joined) {
    return <CollaborativeEditor roomId={roomId} username={username} />;
  }

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#121212",
      color: "#fff",
      fontFamily: "sans-serif"
    }}>
      <div style={{
        background: "#1e1e1e",
        padding: "40px",
        borderRadius: "10px",
        width: "400px",
        border: "1px solid #333",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h1 style={{ margin: 0, color: "#007acc" }}>Nexus Editor</h1>
          <p style={{ color: "#888", marginTop: "10px" }}>Real-time Code Collaboration</p>
        </div>

        <form onSubmit={joinRoom} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>

          {/* USERNAME INPUT */}
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", color: "#ccc" }}>Display Name</label>
            <input
              type="text"
              placeholder="e.g. CodeMaster99"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: "100%", padding: "12px", borderRadius: "5px",
                border: "1px solid #444", background: "#252526", color: "#fff", outline: "none"
              }}
            />
          </div>

          {/* ROOM ID INPUT */}
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", color: "#ccc" }}>Room ID</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                placeholder="Paste Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                style={{
                  flex: 1, padding: "12px", borderRadius: "5px",
                  border: "1px solid #444", background: "#252526", color: "#fff", outline: "none"
                }}
              />
              <button
                onClick={createNewRoom}
                title="Generate Random Room"
                style={{
                  padding: "0 15px", background: "#333", border: "1px solid #444",
                  borderRadius: "5px", color: "#fff", cursor: "pointer"
                }}
              >
                🎲
              </button>
            </div>
          </div>

          <button
            type="submit"
            style={{
              marginTop: "10px", padding: "12px", borderRadius: "5px", border: "none",
              background: "#007acc", color: "#fff", fontWeight: "bold", cursor: "pointer",
              fontSize: "16px", transition: "background 0.2s"
            }}
          >
            Join Room
          </button>
        </form>

        <div style={{ marginTop: "20px", textAlign: "center", fontSize: "12px", color: "#555" }}>
          Invite others by sharing the Room ID.
        </div>
      </div>
    </div>
  );
}
"use client"
import React, { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
// import MonacoEditor from "@monaco-editor/react"; // If you use Monaco
// import ReactQuill from "react-quill"; // If you use Quill

const useSocket = (documentId: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // 1. Connect to Server
    // Make sure this matches your backend URL
    const s = io("http://localhost:3000"); 
    setSocket(s);

    // 2. Join the Room
    s.emit("join-room", documentId);

    // Cleanup on unmount
    return () => {
      s.disconnect();
    };
  }, [documentId]);

  return socket;
};

interface CollaborativeEditorProps {
  documentId: string;
}

const CollaborativeEditor = ({ documentId }: CollaborativeEditorProps) => {
  const socket = useSocket(documentId);
  const [content, setContent] = useState("");

  // 3. Listen for incoming code updates from others
  useEffect(() => {
    if (!socket) return;

    const handleCodeUpdate = (newCode: string) => {
      console.log("Remote change received:", newCode);
      // Update state without triggering a loop 
      setContent(newCode); 
    };

    const handleLoadDocument = (storedCode: string) => {
      console.log("Initial code loaded:", storedCode);
      setContent(storedCode);
    };

    socket.on("code-update", handleCodeUpdate);
    socket.on("load-document", handleLoadDocument);

    return () => {
      socket.off("code-update", handleCodeUpdate);
      socket.off("load-document", handleLoadDocument);
    };
  }, [socket]);

  // 4. Handle changes when YOU type
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
     const newCode = e.target.value;
     setContent(newCode);
     
     // Emit to server
     if (socket) {
        socket.emit("code-change", { documentId, code: newCode });
     }
  }

  // Replace <textarea> with your actual Editor (Monaco, CodeMirror, etc.)
  return (
    <div style={{ padding: '20px' }}>
        <h3>Room: {documentId}</h3>
        <textarea 
            value={content}
            onChange={handleChange}
            rows={20}
            cols={80}
            style={{ width: '100%', fontFamily: 'monospace' }}
        />
    </div>
  );
}

export default CollaborativeEditor;
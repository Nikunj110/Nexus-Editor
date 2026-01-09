"use client"
import React, { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import Editor from "@monaco-editor/react"
// import ReactQuill from "react-quill"; // If you use Quill

const useSocket = (documentId: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // 1. Connect to Server
    // Make sure this matches your backend URL (Fixed to 3001)
    const s = io("http://localhost:3001");
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

const LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "cpp",
  "html",
  "css",
  "json"
];

const CollaborativeEditor = ({ documentId }: CollaborativeEditorProps) => {
  const socket = useSocket(documentId);
  const [content, setContent] = useState("// Start coding...");
  const [language, setLanguage] = useState("javascript");
const [userCount, setUserCount] = useState(0);


  // 3. Listen for incoming code updates from others
  useEffect(() => {
    if (!socket) return;

    const handleCodeUpdate = (newCode: string) => {
      // console.log("Remote change received:", newCode);
      // // Update state without triggering a loop 
      // setContent(newCode); 
      // Only update if the content is actually different
      // This helps prevent some cursor jumping issues
      setContent((prev) => (prev !== newCode ? newCode : prev));
    };

    const handleUserCount = (count: number) => {
        console.log("Users online:", count);
        setUserCount(count);
        //cnt How manyuser Online
    };

    const handleLoadDocument = (storedCode: string) => {
      // console.log("Initial code loaded:", storedCode);
      setContent(storedCode);
    };

    const handleLanguageUpdate = (newLanguage: string) => {
      console.log("Language Updated to : ", newLanguage);
      setLanguage(newLanguage);
    };

    socket.on("code-update", handleCodeUpdate);
    socket.on("load-document", handleLoadDocument);
 
    socket.on("language-update", handleLanguageUpdate);
    socket.on("user-count-update", handleUserCount);  

    return () => {
      socket.off("code-update", handleCodeUpdate);
      socket.off("load-document", handleLoadDocument);
      socket.off("language-update", handleLanguageUpdate);
      socket.off("user-count-update", handleUserCount);
    };
  }, [socket]);

  // 4. Handle changes when YOU type
  // const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  //    const newCode = e.target.value;
  //    setContent(newCode);

  //    // Emit to server
  //    if (socket) {
  //       socket.emit("code-change", { documentId, code: newCode });
  //    }
  // }

  // 2. Handle Monaco Changes
  // Monaco gives us the value directly, we don't need "e.target.value"
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setContent(value);
      if (socket) {
        socket.emit("code-change", { documentId, code: value });
      }
    }
  }

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);

    // Telling the server we changed the language
    if (socket) {
      // Backend listens for "language-change"
      socket.emit("language-change", { documentId, language: newLanguage });
    }
  }

  // Replace <textarea> with your actual Editor (Monaco, CodeMirror, etc.)
  return (
    <div style={{ height: "90vh", display: "flex", flexDirection: "column", border: "1px solid #333" }}>
        
        {/* Toolbar Section */}
        <div style={{ padding: "10px", background: "#1e1e1e", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            
            {/* Left side: Language Selector */}
            <div>
                <span style={{ color: "#fff", marginRight: "10px" }}>Language:</span>
                <select 
                    value={language} 
                    onChange={handleLanguageChange}
                    style={{ padding: "5px", borderRadius: "4px" }}
                >
                    {LANGUAGES.map((lang) => (
                        <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                    ))}
                </select>
            </div>

            {/* Right side: User Count */}
            <div style={{ color: "#4caf50", fontWeight: "bold" }}>
                🟢 {userCount} User{userCount !== 1 ? 's' : ''} Online
            </div>

        </div>

        {/* Editor Section */}
        <Editor
            // ... (Keep existing Editor props) ...
             height="100%"
             language={language}
             theme="vs-dark"
             value={content}
             onChange={handleEditorChange} 
             options={{ minimap: { enabled: false }, fontSize: 14 }}
        />
    </div>
  );
}

export default CollaborativeEditor;
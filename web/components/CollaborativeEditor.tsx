"use client"
import React, { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Editor from "@monaco-editor/react";
import axios from "axios";


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

const LANGUAGES_VERSIONS: Record<string, string> = {
  javascript: "18.15.0",
  typescript: "5.0.3",
  python: "3.10.0",
  java: "15.0.2",
  csharp: "6.12.0",
  php: "8.2.3",
};

const LANGUAGES = Object.keys(LANGUAGES_VERSIONS);

const CollaborativeEditor = ({ documentId }: CollaborativeEditorProps) => {
  const socket = useSocket(documentId);
  const [content, setContent] = useState("// Start coding...");
  const [language, setLanguage] = useState("javascript");
  const [userCount, setUserCount] = useState(0);

  //State For Execution Output
  const [output, setOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  //resizable Terminal State
  const [terminalHeight, setTerminalHeight] = useState(250) // Default height in pixels
  const [isDragging, setIsDragging] = useState(false);

  // Helper to sync editor content without cursor jumping
  const editorRef = useRef<any>(null);



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
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);

    // Telling the server we changed the language
    if (socket) {
      // Backend listens for "language-change"
      socket.emit("language-change", { documentId, language: newLanguage });
    }
  }

  const runCode = async () => {
    setIsRunning(true);
    setOutput(["Running..."]);

    try {
      // Piston API Endpoint
      const response = await axios.post("https://emkc.org/api/v2/piston/execute", {
        language: language,
        version: LANGUAGES_VERSIONS[language],
        files: [
          {
            content: content
          }
        ]
      });

      const { run } = response.data;
      // Combine stdout (success) and stderr (errors)
      const result = (run.stdout || "") + (run.stderr || "");
      setOutput(result.split("\n"));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setOutput([`Error: ${errorMessage}`]);
    } finally {
      setIsRunning(false);
    }

  };

  //Dragging Logic
  const startDragging = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }

  const stopDragging = useCallback(() => {
    setIsDragging(false);
  }, []);

  const onDrag = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    // Calculate new height based on mouse position from bottom of window
    const newHeight = window.innerHeight - e.clientY;
    // Limit min/max height
    if (newHeight > 100 && newHeight < window.innerHeight - 100) {
      setTerminalHeight(newHeight);
    }

  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", onDrag);
      window.addEventListener("mouseup", stopDragging);
    } else {
      window.removeEventListener("mousemove", onDrag);
      window.removeEventListener("mouseup", stopDragging);
    }
    return () => {
      window.removeEventListener("mousemove", onDrag);
      window.removeEventListener("mouseup", stopDragging);
    };
  }, [isDragging, onDrag, stopDragging]);

  // Replace <textarea> with your actual Editor (Monaco, CodeMirror, etc.)
return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#1e1e1e", overflow: "hidden" }}>
      
      {/* --- FIX 1: Invisible Overlay --- 
          This covers the WHOLE screen only when dragging. 
          It catches all mouse events so the Editor doesn't steal them. 
      */}
      {isDragging && (
        <div 
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            cursor: "row-resize"
          }} 
        />
      )}

      {/* Toolbar */}
      <div style={{ 
          padding: "10px 20px", 
          background: "#252526", 
          borderBottom: "1px solid #333", 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          flexShrink: 0 
      }}>
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <span style={{ color: "#fff", fontWeight: "bold" }}>Nexus Editor</span>
          <select
            value={language}
            onChange={handleLanguageChange}
            style={{ padding: "5px", borderRadius: "4px", background: "#333", color: "#fff", border: "none" }}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
           <span style={{ color: "#4caf50", fontSize: "14px" }}>
             🟢 {userCount} Online
           </span>
           <button
             onClick={runCode}
             disabled={isRunning}
             style={{
               padding: "8px 16px",
               background: isRunning ? "#555" : "#007acc",
               color: "white",
               border: "none",
               borderRadius: "4px",
               cursor: isRunning ? "not-allowed" : "pointer",
               fontWeight: "bold"
             }}
           >
             {isRunning ? "Running..." : "▶ Run Code"}
           </button>
        </div>
      </div>

      {/* Main Content */}
      <div 
        style={{ 
           flex: 1, 
           display: "flex", 
           flexDirection: "column", 
           position: "relative",
           // --- FIX 2: Disable text selection while dragging ---
           userSelect: isDragging ? "none" : "auto" 
        }}
      >
        
        {/* Editor Area */}
        <div style={{ flex: 1, minHeight: 0 }}> 
           <Editor
             height="100%"
             language={language}
             theme="vs-dark"
             value={content}
             onChange={handleEditorChange}
             options={{ minimap: { enabled: false }, fontSize: 14 }}
           />
        </div>

        {/* Draggable Handle */}
        <div 
           onMouseDown={startDragging}
           style={{
              height: "8px", // Made slightly thicker for easier grabbing
              background: isDragging ? "#007acc" : "#333",
              cursor: "row-resize",
              zIndex: 50, // Higher than editor
              transition: "background 0.2s"
           }}
        />

        {/* Terminal Area */}
        <div style={{ 
            height: `${terminalHeight}px`, 
            background: "#1e1e1e", 
            padding: "10px",
            color: "#ddd",
            fontFamily: "monospace",
            overflowY: "auto",
            borderTop: "1px solid #333"
        }}>
            <div style={{ color: "#888", marginBottom: "5px", fontSize: "12px", display:"flex", justifyContent:"space-between" }}>
                <span>TERMINAL OUTPUT</span>
                <span 
                    onClick={() => setOutput([])} 
                    style={{cursor: "pointer", textDecoration:"underline"}}
                >
                    Clear
                </span>
            </div>
            {output.length > 0 ? (
                output.map((line, i) => (
                    <div key={i} style={{ minHeight: "1.2em", whiteSpace: "pre-wrap" }}>{line}</div>
                ))
            ) : (
                <div style={{ color: "#555", fontStyle: "italic" }}>Ready to execute...</div>
            )}
        </div>

      </div>
    </div>
  );
};

export default CollaborativeEditor;
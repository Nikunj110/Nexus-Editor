"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Editor from "@monaco-editor/react";
import axios from "axios";

// --- 1. SOCKET CONNECTION HOOK ---
const useSocket = (documentId: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Connect to backend
    const s = io("http://localhost:3001");
    setSocket(s);
    s.emit("join-room", documentId);

    return () => {
      s.disconnect();
    };
  }, [documentId]);

  return socket;
};

// --- CONSTANTS ---
const LANGUAGES_VERSIONS: Record<string, string> = {
  javascript: "18.15.0",
  typescript: "5.0.3",
  python: "3.10.0",
  java: "15.0.2",
  csharp: "6.12.0",
  php: "8.2.3",
};
const LANGUAGES = Object.keys(LANGUAGES_VERSIONS);

interface CollaborativeEditorProps {
  roomId: string;
  username: string;
}


const CollaborativeEditor = ({ roomId, username }: CollaborativeEditorProps) => {
  const socket = useSocket(roomId);
  const [content, setContent] = useState("// Start coding...");
  const [language, setLanguage] = useState("javascript");
  const [userCount, setUserCount] = useState(0);

  // Execution State
  const [output, setOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // --- RESIZE STATE (The logic for the Terminal) ---
  const [terminalHeight, setTerminalHeight] = useState(250); // Start at 250px
  const [isDragging, setIsDragging] = useState(false);

  // We use a Ref for dragging so the 'mousemove' event listener 
  // can see the current value without needing a React re-render loop.
  const isDraggingRef = useRef(false);

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    if (!socket) return;

    const handleCodeUpdate = (newCode: string) => {
      // Only update if different to prevent cursor jumps
      setContent((prev) => (prev !== newCode ? newCode : prev));
    };
    const handleUserCount = (count: number) => setUserCount(count);
    const handleLoadDocument = (storedCode: string) => setContent(storedCode);
    const handleLanguageUpdate = (newLanguage: string) => setLanguage(newLanguage);

    socket.on("code-update", handleCodeUpdate);
    socket.on("load-document", handleLoadDocument);
    socket.on("language-update", handleLanguageUpdate);
    socket.on("user-count-update", handleUserCount);
    // We emit a new event so the server knows WHO joined
    socket.emit("join-room", { roomId, username });

    return () => {
      socket.off("code-update", handleCodeUpdate);
      socket.off("load-document", handleLoadDocument);
      socket.off("language-update", handleLanguageUpdate);
      socket.off("user-count-update", handleUserCount);
    };
  }, [socket, roomId, username]);

  // --- EVENT HANDLERS ---
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setContent(value);
      if (socket) socket.emit("code-change", { roomId, code: value });
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    if (socket) socket.emit("language-change", { roomId, language: newLanguage });
  };

  const runCode = async () => {
    setIsRunning(true);
    setOutput(["Running..."]);
    try {
      const response = await axios.post("https://emkc.org/api/v2/piston/execute", {
        language: language,
        version: LANGUAGES_VERSIONS[language],
        files: [{ content: content }],
      });
      const { run } = response.data;
      setOutput((run.stdout || "" + run.stderr || "").split("\n"));
    } catch (error: any) {
      setOutput([`Error: ${error.message}`]);
    } finally {
      setIsRunning(false);
    }
  };

  // --- DRAGGING LOGIC (EXPLAINED) ---

  // 1. Start Dragging
  const startDragging = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    isDraggingRef.current = true;
    // Important: Force cursor to resize everywhere, even if mouse leaves the handle
    document.body.style.cursor = "row-resize";
  };

  // 2. Stop Dragging
  const stopDragging = useCallback(() => {
    setIsDragging(false);
    isDraggingRef.current = false;
    document.body.style.cursor = "auto"; // Restore cursor
  }, []);

  // 3. The Math for Dragging
  const onDrag = useCallback((e: MouseEvent) => {
    // If we aren't dragging, stop immediately
    if (!isDraggingRef.current) return;

    e.preventDefault(); // Stop text selection while dragging

    // CALCULATION EXPLANATION:
    // e.clientY = The mouse's vertical position from the TOP of the screen.
    // window.innerHeight = The total height of the browser window.
    //
    // If window is 1000px and mouse is at 800px (near bottom):
    // 1000 - 800 = 200px (Height of terminal)
    //
    // If mouse moves UP to 600px:
    // 1000 - 600 = 400px (Terminal gets taller)
    const newHeight = window.innerHeight - e.clientY;

    // SAFETY LIMITS:
    const minHeight = 50; // Don't let it disappear
    const maxHeight = window.innerHeight - 100; // Don't let it cover the toolbar

    // Clamp the value between min and max
    const clampedHeight = Math.min(Math.max(newHeight, minHeight), maxHeight);

    setTerminalHeight(clampedHeight);
  }, []);

  // 4. Global Event Listeners
  // We attach to 'window' so if you drag fast and mouse leaves the handle, it still works.
  useEffect(() => {
    window.addEventListener("mousemove", onDrag);
    window.addEventListener("mouseup", stopDragging);
    return () => {
      window.removeEventListener("mousemove", onDrag);
      window.removeEventListener("mouseup", stopDragging);
    };
  }, [onDrag, stopDragging]);

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      background: "#1e1e1e",
      overflow: "hidden",
      position: "relative",
      // UX FIX: Prevent highlighting text while dragging
      userSelect: isDragging ? "none" : "auto"
    }}>

      {/* --- TOOLBAR (Fixed Height) --- */}
      <div style={{ padding: "10px 20px", background: "#252526", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <span style={{ color: "#fff", fontWeight: "bold" }}>Nexus Editor</span>
          <select value={language} onChange={handleLanguageChange} style={{ padding: "5px", borderRadius: "4px", background: "#333", color: "#fff", border: "none" }}>
            {LANGUAGES.map((lang) => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <span style={{ color: "#4caf50", fontSize: "14px" }}>🟢 {userCount} Online</span>
          <button onClick={runCode} disabled={isRunning} style={{ padding: "8px 16px", background: isRunning ? "#555" : "#007acc", color: "white", border: "none", borderRadius: "4px", cursor: isRunning ? "not-allowed" : "pointer", fontWeight: "bold" }}>
            {isRunning ? "Running..." : "▶ Run Code"}
          </button>
        </div>
      </div>

      {/* --- MAIN LAYOUT --- */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden"
      }}>

        {/* EDITOR AREA (The part that shrinks) 
           LOGIC: flex: 1 means "fill remaining space".
           CRITICAL FIX: overflow: "hidden" is required. 
           Without it, the editor refuses to shrink below its content size, 
           which stops the terminal from being dragged up.
        */}
        <div style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          pointerEvents: isDragging ? "none" : "auto" // Disable editor mouse events while dragging
        }}>
          <Editor
            height="100%"
            language={language}
            theme="vs-dark"
            value={content}
            onChange={handleEditorChange}
            options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true }}
          />
        </div>

        {/* --- DRAG HANDLE --- */}
        <div
          onMouseDown={startDragging}
          style={{
            height: "10px",
            marginTop: "-5px", // Overlap the border slightly
            marginBottom: "-5px",
            zIndex: 10,
            cursor: "row-resize",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative"
          }}
        >
          {/* Visual Line */}
          <div style={{ width: "100%", height: "2px", background: isDragging ? "#007acc" : "#333" }}></div>
        </div>

        {/* TERMINAL AREA (The part that grows)
           LOGIC: flexShrink: 0 is CRITICAL.
           It tells Flexbox: "Respect my pixel height strictly. 
           Do not automatically shrink me just because the Editor wants more space."
        */}
        <div style={{
          height: `${terminalHeight}px`,
          background: "#1e1e1e",
          borderTop: "1px solid #333",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0 // <--- THIS MAKES DRAGGING UP WORK
        }}>
          <div style={{ padding: "10px", flex: 1, overflowY: "auto", fontFamily: "monospace", color: "#ddd" }}>
            <div style={{ color: "#888", marginBottom: "5px", fontSize: "12px", display: "flex", justifyContent: "space-between" }}>
              <span>TERMINAL OUTPUT</span>
              <span onClick={() => setOutput([])} style={{ cursor: "pointer", textDecoration: "underline" }}>Clear</span>
            </div>
            {output.length > 0 ? output.map((line, i) => (
              <div key={i} style={{ minHeight: "1.2em", whiteSpace: "pre-wrap" }}>{line}</div>
            )) : <div style={{ color: "#555", fontStyle: "italic" }}>Ready to execute...</div>}
          </div>
        </div>

      </div>

      {/* --- INVISIBLE SAFETY LAYER --- */}
      {/* When dragging, this covers the whole screen to catch mouse movements 
          even if you drag outside the browser window momentarily */}
      {isDragging && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 9999, cursor: "row-resize"
        }} />
      )}

    </div>
  );
};

export default CollaborativeEditor;
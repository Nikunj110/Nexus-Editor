import CollaborativeEditor from "../components/CollaborativeEditor";

export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Nexus Editor - Live Demo</h1>
      <p>Open this URL in two different tabs to test sync.</p>
      
      <div style={{ marginTop: "20px", border: "1px solid #ccc" }}>
        {/* We are hardcoding "room-1" for now to test connection */}
        <CollaborativeEditor documentId="room-1" />
      </div>
    </main>
  );
}
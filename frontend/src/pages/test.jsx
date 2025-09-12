import React from 'react';

export default function TestEditor() {
  return (
    <div style={{ height: "100vh", display: "flex" }}>
      <div style={{ width: 280, padding: 16, background: "#f6f6f6" }}>
        <h2>3D Floor Plan Editor</h2>
        <p>Test - Frontend is working!</p>
        <button style={{ padding: "8px 16px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: 4 }}>
          Test Button
        </button>
      </div>
      <div style={{ flex: 1, background: "#e0e0e0", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <h3>3D Canvas Area</h3>
      </div>
    </div>
  );
}


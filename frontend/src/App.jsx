import React, { useState } from 'react'
import Uploader from './components/Uploader'
import Viewer from './components/Viewer'

export default function App() {
  const [glbUrl, setGlbUrl] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fileInfo, setFileInfo] = useState(null)

  const handleModelReady = (url, info = null) => {
    setGlbUrl(url)
    setError(null)
    setFileInfo(info)
  }

  const handleLoadingChange = (loading) => {
    setIsLoading(loading)
  }

  const handleError = (errorMsg) => {
    setError(errorMsg)
  }

  const handleDownload = () => {
    if (glbUrl) {
      const link = document.createElement('a')
      link.href = glbUrl
      const format = fileInfo?.format?.toLowerCase() || 'glb'
      const extension = format === 'gltf' ? 'gltf' : format
      link.download = `floorplan-3d-model.${extension}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleReset = () => {
    setGlbUrl(null)
    setError(null)
    setIsLoading(false)
    setFileInfo(null)
  }

  return (
    <div className="app">
      <div className="sidebar">
        <h2>2D → 3D Floorplan</h2>
        <p>Upload a floor plan to generate a 3D model.</p>
        <Uploader 
          onModelReady={handleModelReady}
          onLoadingChange={handleLoadingChange}
          onError={handleError}
        />
        {glbUrl && !isLoading && !error && (
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#0369a1' }}>✅ Model Ready!</h3>
            <p style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#0c4a6e' }}>
              Your 3D model has been generated successfully. You can download it as a {fileInfo?.format?.toUpperCase() || 'GLB'} file.
            </p>
            {fileInfo && (
              <div style={{ marginBottom: '15px', fontSize: '12px', color: '#374151' }}>
                <div><strong>File:</strong> {fileInfo.filename || 'Unknown'}</div>
                <div><strong>Size:</strong> {fileInfo.size ? `${(fileInfo.size / 1024).toFixed(1)} KB` : 'Unknown'}</div>
                <div><strong>Format:</strong> {fileInfo.format || 'GLB'}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleDownload}
                style={{
                  backgroundColor: '#0ea5e9',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s ease',
                  flex: 1
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#0284c7'
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#0ea5e9'
                }}
              >
                <span>📥</span>
                Download {fileInfo?.format?.toUpperCase() || 'GLB'}
              </button>
              <button
                onClick={handleReset}
                style={{
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#4b5563'
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#6b7280'
                }}
              >
                <span>🔄</span>
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="viewer">
        <Viewer 
          glbUrl={glbUrl} 
          isLoading={isLoading}
          error={error}
          fileInfo={fileInfo}
        />
      </div>
    </div>
  )
}

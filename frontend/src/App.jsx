import React, { useState } from 'react'
import Uploader from './components/Uploader'
import Viewer from './components/Viewer'

export default function App() {
  const [glbUrl, setGlbUrl] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleModelReady = (url) => {
    setGlbUrl(url)
    setError(null)
  }

  const handleLoadingChange = (loading) => {
    setIsLoading(loading)
  }

  const handleError = (errorMsg) => {
    setError(errorMsg)
  }

  return (
    <div className="app">
      <div className="sidebar">
        <h2>2D → 3D Floorplan</h2>
        <p>Upload an SVG plan to generate a GLB model.</p>
        <Uploader 
          onModelReady={handleModelReady}
          onLoadingChange={handleLoadingChange}
          onError={handleError}
        />
      </div>
      <div className="viewer">
        <Viewer 
          glbUrl={glbUrl} 
          isLoading={isLoading}
          error={error}
        />
      </div>
    </div>
  )
}

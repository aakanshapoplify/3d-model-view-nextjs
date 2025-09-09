import React, { useState } from 'react'

export default function Uploader({ onModelReady, onLoadingChange, onError }) {
  const [file, setFile] = useState(null)
  const [fileType, setFileType] = useState('svg') // 'svg' or 'jpg'
  const [pxToM, setPxToM] = useState(0.01)
  const [thickness, setThickness] = useState(0.15)
  const [height, setHeight] = useState(3.0)
  const [minWallLength, setMinWallLength] = useState(0.01)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleUpload = async () => {
    if (!file) return
    
    setIsLoading(true)
    setError(null)
    onLoadingChange?.(true)
    onError?.(null)
    
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('px_to_m', String(pxToM))
      fd.append('wall_thickness', String(thickness))
      fd.append('wall_height', String(height))
      fd.append('min_wall_length', String(minWallLength))
      
      // Choose endpoint based on file type
      const endpoint = fileType === 'jpg' 
        ? 'http://localhost:8083/convert/jpg-to-glb'
        : 'http://localhost:8083/convert/svg-to-glb'
      
      // Add merge_walls only for SVG
      if (fileType === 'svg') {
        fd.append('merge_walls', 'true')
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        body: fd
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        const errorMsg = errorData.error || 'Unknown error'
        setError(errorMsg)
        onError?.(errorMsg)
        return
      }
      
      const blob = await res.blob()
      
      // Check if the blob has content
      if (blob.size === 0) {
        const errorMsg = fileType === 'jpg' 
          ? 'Generated 3D model is empty. Please check your JPG image contains clear wall boundaries.'
          : 'Generated 3D model is empty. Please check your SVG file contains valid wall elements.'
        setError(errorMsg)
        onError?.(errorMsg)
        return
      }
      
      const url = URL.createObjectURL(blob)
      onModelReady(url)
    } catch (error) {
      const errorMsg = `Network error: ${error.message}`
      setError(errorMsg)
      onError?.(errorMsg)
    } finally {
      setIsLoading(false)
      onLoadingChange?.(false)
    }
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      // Auto-detect file type based on file extension
      const fileName = selectedFile.name.toLowerCase()
      if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
        setFileType('jpg')
      } else if (fileName.endsWith('.svg')) {
        setFileType('svg')
      }
    } else {
      setFile(null)
    }
  }

  return (
    <div>
      <label>File Type</label>
      <div style={{ marginBottom: '10px' }}>
        <label style={{ marginRight: '15px' }}>
          <input 
            type="radio" 
            value="svg" 
            checked={fileType === 'svg'} 
            onChange={e => setFileType(e.target.value)}
          />
          SVG Floor Plan
        </label>
        <label>
          <input 
            type="radio" 
            value="jpg" 
            checked={fileType === 'jpg'} 
            onChange={e => setFileType(e.target.value)}
          />
          JPG Image
        </label>
      </div>

      <label>{fileType === 'jpg' ? 'JPG Floor Plan Image' : 'SVG Floor Plan'}</label>
      <input 
        type="file" 
        accept={fileType === 'jpg' ? '.jpg,.jpeg' : '.svg'} 
        onChange={handleFileChange} 
      />

      <label>Pixels → meters</label>
      <input type="number" step="0.001" value={pxToM} onChange={e => setPxToM(parseFloat(e.target.value))} />
      <small style={{ display: 'block', color: '#666', marginTop: 2 }}>
        {fileType === 'jpg' 
          ? 'How many meters each pixel represents (adjust based on image scale)'
          : 'How many meters each pixel represents'
        }
      </small>

      <label>Wall thickness (m)</label>
      <input type="number" step="0.01" value={thickness} onChange={e => setThickness(parseFloat(e.target.value))} />

      <label>Wall height (m)</label>
      <input type="number" step="0.1" value={height} onChange={e => setHeight(parseFloat(e.target.value))} />

      <label>Min wall length (m)</label>
      <input type="number" step="0.001" value={minWallLength} onChange={e => setMinWallLength(parseFloat(e.target.value))} />
      <small style={{ display: 'block', color: '#666', marginTop: 2 }}>
        Filter out walls shorter than this length
      </small>

      {fileType === 'jpg' && (
        <div style={{ 
          marginTop: '10px', 
          padding: '10px', 
          backgroundColor: '#f0f8ff', 
          border: '1px solid #b0d4f1', 
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          <strong>JPG Processing Tips:</strong>
          <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
            <li>Use clear, high-contrast floor plan images</li>
            <li>Ensure walls are clearly defined and visible</li>
            <li>Adjust "Pixels → meters" based on your image scale</li>
            <li>Try different "Min wall length" values if detection fails</li>
          </ul>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button onClick={handleUpload} disabled={isLoading}>
          {isLoading ? 'Processing...' : `Convert ${fileType.toUpperCase()} to 3D`}
        </button>
      </div>
    </div>
  )
}

import React, { useState } from 'react'

export default function Uploader({ onModelReady, onLoadingChange, onError }) {
  const [file, setFile] = useState(null)
  const [fileType, setFileType] = useState('svg') // 'svg', 'jpg', or 'cad'
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
      let endpoint
      switch(fileType) {
        case 'jpg':
          endpoint = 'http://localhost:8083/convert/jpg-to-glb'
          break
        case 'cad':
          endpoint = 'http://localhost:8083/convert/cad-to-glb'
          break
        default:
          endpoint = 'http://localhost:8083/convert/svg-to-glb'
      }
      
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
        let errorMsg
        switch(fileType) {
          case 'jpg':
            errorMsg = 'Generated 3D model is empty. Please check your JPG image contains clear wall boundaries.'
            break
          case 'cad':
            errorMsg = 'Generated 3D model is empty. Please check your CAD file contains valid wall entities.'
            break
          default:
            errorMsg = 'Generated 3D model is empty. Please check your SVG file contains valid wall elements.'
        }
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
      } else if (fileName.endsWith('.dxf')) {
        setFileType('cad')
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
          SVG
        </label>
        <label style={{ marginRight: '15px' }}>
          <input 
            type="radio" 
            value="jpg" 
            checked={fileType === 'jpg'} 
            onChange={e => setFileType(e.target.value)}
          />
          JPG
        </label>
        <label>
          <input 
            type="radio" 
            value="cad" 
            checked={fileType === 'cad'} 
            onChange={e => setFileType(e.target.value)}
          />
          CAD (DXF only)
        </label>
      </div>

      <label>
        {fileType === 'jpg' ? 'JPG Floor Plan Image' : 
         fileType === 'cad' ? 'CAD Floor Plan File' : 
         'SVG Floor Plan'}
      </label>
      <input 
        type="file" 
        accept={
          fileType === 'jpg' ? '.jpg,.jpeg' : 
          fileType === 'cad' ? '.dxf' : 
          '.svg'
        } 
        onChange={handleFileChange} 
      />

      <label>Pixels → meters</label>
      <input type="number" step="0.001" value={pxToM} onChange={e => setPxToM(parseFloat(e.target.value))} />
      <small style={{ display: 'block', color: '#666', marginTop: 2 }}>
        {fileType === 'jpg' 
          ? 'How many meters each pixel represents (adjust based on image scale)'
          : fileType === 'cad'
          ? 'How many meters each CAD unit represents (check CAD file units)'
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

      {(fileType === 'jpg' || fileType === 'cad') && (
        <div style={{ 
          marginTop: '10px', 
          padding: '10px', 
          backgroundColor: '#f0f8ff', 
          border: '1px solid #b0d4f1', 
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          <strong>{fileType === 'jpg' ? 'JPG' : 'CAD'} Processing Tips:</strong>
          <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
            {fileType === 'jpg' ? (
              <>
                <li>Use clear, high-contrast floor plan images</li>
                <li>Ensure walls are clearly defined and visible</li>
                <li>Adjust "Pixels → meters" based on your image scale</li>
                <li>Try different "Min wall length" values if detection fails</li>
              </>
            ) : (
              <>
                <li><strong>DXF files only:</strong> DWG files are not supported</li>
                <li>Convert DWG to DXF using AutoCAD: File → Save As → DXF</li>
                <li>Use CAD files with LINE, LWPOLYLINE, or POLYLINE entities</li>
                <li>Check CAD file units and adjust "Pixels → meters" accordingly</li>
                <li>Ensure architectural elements are clearly defined</li>
                <li>Try different "Min wall length" values if detection fails</li>
              </>
            )}
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

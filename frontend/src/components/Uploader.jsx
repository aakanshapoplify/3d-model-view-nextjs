import React, { useState, useEffect } from 'react'
import CloudinaryIntegration from './CloudinaryIntegration'

export default function Uploader({ onModelReady, onLoadingChange, onError }) {
  const [file, setFile] = useState(null)
  const [fileType, setFileType] = useState('svg') // 'svg', 'jpg', or 'cad'
  const [outputFormat, setOutputFormat] = useState('glb') // 'glb', 'obj', 'gltf'
  const [pxToM, setPxToM] = useState(0.01)
  const [thickness, setThickness] = useState(0.15)
  const [height, setHeight] = useState(1.0)
  const [minWallLength, setMinWallLength] = useState(0.01)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [cloudinaryEnabled, setCloudinaryEnabled] = useState(false)
  const [cloudinaryFiles, setCloudinaryFiles] = useState([])
  
  // Initialize Cloudinary integration
  const cloudinary = CloudinaryIntegration({
    onImageProcessed: (result) => {
      console.log('Image processed:', result);
    },
    onModelUploaded: (result) => {
      console.log('3D model uploaded:', result);
      setCloudinaryFiles(prev => [...prev, result]);
    }
  });

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
      
      // Choose endpoint based on file type and output format
      let endpoint
      if (fileType === 'cad') {
        switch(outputFormat) {
          case 'obj':
            endpoint = 'http://localhost:8000/convert/cad-to-obj'
            break
          case 'gltf':
            endpoint = 'http://localhost:8000/convert/cad-to-gltf'
            break
          default:
            endpoint = 'http://localhost:8000/convert/cad-to-glb'
        }
      } else if (fileType === 'jpg') {
        switch(outputFormat) {
          case 'obj':
            endpoint = 'http://localhost:8000/convert/jpg-to-obj'
            break
          case 'gltf':
            endpoint = 'http://localhost:8000/convert/jpg-to-gltf'
            break
          default:
            endpoint = 'http://localhost:8000/convert/jpg-to-glb'
        }
      } else {
        endpoint = 'http://localhost:8000/convert/svg-to-glb' // SVG only supports GLB for now
      }
      
      // Add merge_walls only for SVG
      if (fileType === 'svg') {
      fd.append('merge_walls', 'true')
      }

      console.log('Making request to:', endpoint)
      console.log('File type:', fileType)
      console.log('Output format:', outputFormat)
      
      const res = await fetch(endpoint, {
        method: 'POST',
        body: fd
      })
      
      console.log('Response status:', res.status)
      console.log('Response headers:', res.headers)
      
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
      
      // Determine actual format based on response headers or content
      let actualFormat = outputFormat.toUpperCase()
      const contentType = res.headers.get('content-type')
      if (contentType && contentType.includes('gltf-binary')) {
        actualFormat = 'GLB'
      } else if (contentType && contentType.includes('gltf+json')) {
        actualFormat = 'GLTF'
      } else if (contentType && contentType.includes('obj')) {
        actualFormat = 'OBJ'
      }
      
      // Upload to Cloudinary if enabled
      if (cloudinaryEnabled) {
        try {
          const modelFile = new File([blob], `${file.name.split('.')[0]}.${actualFormat.toLowerCase()}`, {
            type: blob.type || 'application/octet-stream'
          });
          await cloudinary.upload3DModel(modelFile, actualFormat.toLowerCase());
        } catch (cloudinaryError) {
          console.warn('Cloudinary upload failed:', cloudinaryError);
        }
      }
      
      const fileInfo = {
        filename: file.name,
        size: blob.size,
        format: actualFormat,
        type: fileType
      }
      onModelReady(url, fileInfo)
    } catch (error) {
      console.error('Upload error:', error)
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
          CAD (DXF)
        </label>
      </div>

      {/* Output Format Selection - show for CAD and JPG files */}
      {(fileType === 'cad' || fileType === 'jpg') && (
        <>
          <label>Output Format</label>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ marginRight: '15px' }}>
              <input 
                type="radio" 
                value="glb" 
                checked={outputFormat === 'glb'} 
                onChange={e => setOutputFormat(e.target.value)}
              />
              GLB (Binary)
            </label>
            <label style={{ marginRight: '15px' }}>
              <input 
                type="radio" 
                value="obj" 
                checked={outputFormat === 'obj'} 
                onChange={e => setOutputFormat(e.target.value)}
              />
              OBJ
            </label>
            <label>
              <input 
                type="radio" 
                value="gltf" 
                checked={outputFormat === 'gltf'} 
                onChange={e => setOutputFormat(e.target.value)}
              />
              GLTF (JSON)
            </label>
          </div>
        </>
      )}

      {/* Cloudinary Integration */}
      <div style={{ marginBottom: '15px', padding: '10px', border: '1px solid #ddd', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          <input 
            type="checkbox" 
            checked={cloudinaryEnabled} 
            onChange={e => setCloudinaryEnabled(e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          <strong>Enable Cloudinary Cloud Storage</strong>
        </label>
        {cloudinaryEnabled && (
          <div style={{ fontSize: '12px', color: '#666' }}>
            <p>✅ 3D models will be automatically uploaded to Cloudinary</p>
            <p>✅ Professional image processing available</p>
            <p>✅ Cloud storage for generated models</p>
          </div>
        )}
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
                <li>Use DXF files with LINE, LWPOLYLINE, or POLYLINE entities</li>
                <li>Check CAD file units and adjust "Pixels → meters" accordingly</li>
                <li>Ensure architectural elements are clearly defined</li>
                <li>Try different "Min wall length" values if detection fails</li>
              </>
            )}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: '10px' }}>
        <button onClick={handleUpload} disabled={isLoading}>
          {isLoading ? 'Processing...' : `Convert ${fileType.toUpperCase()} to 3D`}
        </button>
      </div>
    </div>
  )
}

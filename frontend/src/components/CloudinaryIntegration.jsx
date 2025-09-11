
import React, { useState, useEffect } from 'react';
import { Cloudinary } from 'cloudinary-core';

const CloudinaryIntegration = ({ onImageProcessed, onModelUploaded }) => {
  const [cloudinary, setCloudinary] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImages, setProcessedImages] = useState([]);

  useEffect(() => {
    // Initialize Cloudinary
    const cl = new Cloudinary({
      cloud_name: 'dgxmv4pa8',
      secure: true
    });
    setCloudinary(cl);
  }, []);

  const uploadFile = async (file, folder = '3d-models') => {
    try {
      setIsProcessing(true);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const response = await fetch('http://localhost:8000/cloudinary/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (result.message) {
        setUploadedFiles(prev => [...prev, result]);
        return result;
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const processImageFor3D = async (imageUrl, transformations = {}) => {
    try {
      setIsProcessing(true);
      
      const response = await fetch('http://localhost:8000/cloudinary/process-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: imageUrl,
          transformations: transformations
        })
      });

      const result = await response.json();
      
      if (result.message) {
        setProcessedImages(prev => [...prev, result]);
        if (onImageProcessed) {
          onImageProcessed(result);
        }
        return result;
      } else {
        throw new Error(result.error || 'Processing failed');
      }
    } catch (error) {
      console.error('Processing error:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const upload3DModel = async (file, format = 'glb') => {
    try {
      setIsProcessing(true);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('format', format);

      const response = await fetch('http://localhost:8000/cloudinary/upload-3d-model', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (result.message) {
        if (onModelUploaded) {
          onModelUploaded(result);
        }
        return result;
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const listFiles = async (folder = '3d-models', maxResults = 50) => {
    try {
      const response = await fetch(`http://localhost:8000/cloudinary/files?folder=${folder}&max_results=${maxResults}`);
      const result = await response.json();
      
      if (result.message) {
        return result.resources;
      } else {
        throw new Error(result.error || 'Failed to list files');
      }
    } catch (error) {
      console.error('List files error:', error);
      throw error;
    }
  };

  const deleteFile = async (publicId) => {
    try {
      const response = await fetch(`http://localhost:8000/cloudinary/delete/${publicId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.message) {
        setUploadedFiles(prev => prev.filter(file => file.public_id !== publicId));
        return result;
      } else {
        throw new Error(result.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      throw error;
    }
  };

  const getCloudinaryUrl = (publicId, transformations = {}) => {
    if (!cloudinary) return null;
    
    try {
      return cloudinary.url(publicId, transformations);
    } catch (error) {
      console.error('URL generation error:', error);
      return null;
    }
  };

  return {
    cloudinary,
    uploadedFiles,
    processedImages,
    isProcessing,
    uploadFile,
    processImageFor3D,
    upload3DModel,
    listFiles,
    deleteFile,
    getCloudinaryUrl
  };
};

export default CloudinaryIntegration;


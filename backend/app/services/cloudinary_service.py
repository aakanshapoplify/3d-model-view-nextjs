"""
Cloudinary service for cloud storage and image processing
Provides professional image processing and cloud storage for 3D model generation
"""

import cloudinary
import cloudinary.uploader
import cloudinary.api
from cloudinary.utils import cloudinary_url
import tempfile
import os
from typing import Optional, Dict, Any, Tuple
import io


class CloudinaryService:
    def __init__(self):
        # Configure Cloudinary
        cloudinary.config(
            cloud_name="dgxmv4pa8",
            api_key="431271117293746",
            api_secret="NHSaX4TxkSqaHj7jeTW9VOpFORo"
        )
        self.cloud_name = "dgxmv4pa8"
    
    def upload_file(self, file_data: bytes, file_name: str, folder: str = "3d-models") -> Dict[str, Any]:
        """
        Upload file to Cloudinary
        """
        try:
            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file_name}") as tmp_file:
                tmp_file.write(file_data)
                tmp_file_path = tmp_file.name
            
            # Upload to Cloudinary
            result = cloudinary.uploader.upload(
                tmp_file_path,
                folder=folder,
                public_id=file_name.split('.')[0],
                resource_type="auto",
                overwrite=True
            )
            
            # Clean up temporary file
            os.unlink(tmp_file_path)
            
            return {
                "success": True,
                "public_id": result["public_id"],
                "secure_url": result["secure_url"],
                "format": result["format"],
                "bytes": result["bytes"],
                "width": result.get("width"),
                "height": result.get("height")
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def process_image_for_3d(self, image_url: str, transformations: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Process image for 3D model generation using Cloudinary transformations
        """
        try:
            # Default transformations for architectural floor plan processing
            default_transformations = {
                "effect": "art:zorro",  # Edge detection effect
                "quality": "auto",
                "format": "jpg",
                "flags": "progressive"
            }
            
            if transformations:
                default_transformations.update(transformations)
            
            # Generate processed image URL
            processed_url, options = cloudinary_url(
                image_url,
                **default_transformations
            )
            
            return {
                "success": True,
                "processed_url": processed_url,
                "transformations": default_transformations
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def generate_3d_preview(self, image_url: str) -> Dict[str, Any]:
        """
        Generate 3D preview using Cloudinary's AI features
        """
        try:
            # Use Cloudinary's AI for 3D-like effects
            transformations = {
                "effect": "art:zorro",  # Edge detection
                "quality": "auto",
                "format": "jpg",
                "flags": "progressive",
                "width": 800,
                "height": 600,
                "crop": "scale"
            }
            
            processed_url, options = cloudinary_url(
                image_url,
                **transformations
            )
            
            return {
                "success": True,
                "preview_url": processed_url,
                "transformations": transformations
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def upload_3d_model(self, model_data: bytes, model_name: str, format: str = "glb") -> Dict[str, Any]:
        """
        Upload 3D model to Cloudinary
        """
        try:
            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{format}") as tmp_file:
                tmp_file.write(model_data)
                tmp_file_path = tmp_file.name
            
            # Upload 3D model
            result = cloudinary.uploader.upload(
                tmp_file_path,
                folder="3d-models/generated",
                public_id=model_name,
                resource_type="raw",
                overwrite=True
            )
            
            # Clean up temporary file
            os.unlink(tmp_file_path)
            
            return {
                "success": True,
                "public_id": result["public_id"],
                "secure_url": result["secure_url"],
                "format": format,
                "bytes": result["bytes"]
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_cloudinary_url(self, public_id: str, transformations: Dict[str, Any] = None) -> str:
        """
        Get Cloudinary URL with transformations
        """
        try:
            if transformations:
                url, options = cloudinary_url(public_id, **transformations)
            else:
                url, options = cloudinary_url(public_id)
            
            return url
            
        except Exception as e:
            return f"Error generating URL: {str(e)}"
    
    def delete_file(self, public_id: str) -> Dict[str, Any]:
        """
        Delete file from Cloudinary
        """
        try:
            result = cloudinary.uploader.destroy(public_id)
            return {
                "success": result.get("result") == "ok",
                "result": result
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def list_files(self, folder: str = "3d-models", max_results: int = 50) -> Dict[str, Any]:
        """
        List files in Cloudinary folder
        """
        try:
            result = cloudinary.api.resources(
                type="upload",
                prefix=folder,
                max_results=max_results
            )
            
            return {
                "success": True,
                "resources": result.get("resources", []),
                "total_count": result.get("total_count", 0)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


# Global Cloudinary service instance
cloudinary_service = CloudinaryService()


// Client-side Cloudinary upload utility
// This bypasses Vercel's 4.5MB limit by uploading directly to Cloudinary

export async function uploadToCloudinary(
  file: File,
  onProgress?: (progress: number) => void
): Promise<{
  url: string;
  public_id: string;
  width?: number;
  height?: number;
  format?: string;
  size?: number;
}> {
  try {
    // Get upload config from our API (just auth check + config)
    const token = localStorage.getItem('token') || document.cookie
      .split('; ')
      .find(row => row.startsWith('client-token='))
      ?.split('=')[1];

    if (!token) {
      throw new Error('Not authenticated');
    }

    const configResponse = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!configResponse.ok) {
      throw new Error('Failed to get upload configuration');
    }

    const config = await configResponse.json();

    // Upload directly to Cloudinary
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', config.uploadPreset);
    formData.append('folder', config.folder);
    formData.append('public_id', config.publicId);

    // Use XMLHttpRequest for progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          resolve({
            url: response.secure_url,
            public_id: response.public_id,
            width: response.width,
            height: response.height,
            format: response.format,
            size: response.bytes,
          });
        } else {
          reject(new Error('Upload failed'));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('POST', `https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`);
      xhr.send(formData);
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}

// Validate file before upload
export function validateFile(file: File): { valid: boolean; error?: string } {
  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');

  if (!isVideo && !isImage) {
    return { valid: false, error: 'Only images and videos are allowed' };
  }

  // Vercel-friendly limits (under 4.5MB for API, but we upload direct so can be larger)
  const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024; // 100MB video, 10MB image
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${isVideo ? '100MB' : '10MB'}`,
    };
  }

  return { valid: true };
}

const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

class CloudinaryService {
  // Upload image from buffer
  async uploadImage(buffer, filename) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'dineqrve', // Folder name in Cloudinary
          public_id: `menu-${Date.now()}`,
          transformation: [
            { width: 500, height: 500, crop: 'limit' }, // Resize
            { quality: 'auto' } // Auto compress
          ]
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      
      // Convert buffer to stream and upload
      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }

  // Delete image from Cloudinary
  async deleteImage(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result;
    } catch (error) {
      console.error('Delete error:', error);
      return null;
    }
  }

  // Get image URL by public ID
  getImageUrl(publicId, options = {}) {
    return cloudinary.url(publicId, {
      secure: true,
      ...options
    });
  }
}

module.exports = new CloudinaryService();
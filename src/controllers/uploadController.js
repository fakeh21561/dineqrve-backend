const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'menu-' + uniqueSuffix + ext);
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: fileFilter
}).single('image');

// Upload image
const uploadImage = async (req, res) => {
    upload(req, res, async function(err) {
        if (err) {
            console.error('Upload error:', err);
            return res.status(400).json({ error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        try {
            const imageUrl = `https://web-production-4c9c0.up.railway.app/uploads/${req.file.filename}`;
            
            if (req.body.item_id) {
                await db.query(
                    'UPDATE menu_items SET image_url = ? WHERE id = ?',
                    [imageUrl, req.body.item_id]
                );
            }

            res.json({
                success: true,
                image_url: imageUrl,
                filename: req.file.filename
            });
        } catch (error) {
            console.error('Database error:', error);
            res.status(500).json({ error: 'Failed to save image reference' });
        }
    });
};

// Web-compatible upload (accepts base64)
const uploadImageWeb = async (req, res) => {
    try {
        const { image, filename, item_id } = req.body;
        
        if (!image) {
            return res.status(400).json({ error: 'No image data provided' });
        }

        // Decode base64 image
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(filename) || '.jpg';
        const newFilename = 'menu-' + uniqueSuffix + ext;
        const uploadDir = path.join(__dirname, '../../uploads');
        
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const filepath = path.join(uploadDir, newFilename);
        fs.writeFileSync(filepath, imageBuffer);
        
        const imageUrl = `https://web-production-4c9c0.up.railway.app/uploads/${req.file.filename}`;
        
        if (item_id) {
            await db.query(
                'UPDATE menu_items SET image_url = ? WHERE id = ?',
                [imageUrl, item_id]
            );
        }

        res.json({
            success: true,
            image_url: imageUrl,
            filename: newFilename
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Delete image
const deleteImage = async (req, res) => {
    try {
        const { image_url } = req.body;
        
        const filename = path.basename(image_url);
        const filepath = path.join(__dirname, '../../uploads', filename);
        
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
        
        res.json({ success: true, message: 'Image deleted' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
};

// Serve static files
const serveImage = (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, '../../uploads', filename);
    
    if (fs.existsSync(filepath)) {
        res.sendFile(filepath);
    } else {
        res.status(404).json({ error: 'Image not found' });
    }
};

module.exports = {
    uploadImage,
    uploadImageWeb,
    deleteImage,
    serveImage
};
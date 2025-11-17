import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../config/index.js";

const s3Client = new S3Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

const s3Storage = {
  _handleFile: async (req, file, cb) => {
    try {
      const fileName = `uploads/images-${Date.now()}-${Math.round(Math.random() * 1e9)}.${file.originalname.split('.').pop()}`;
      
      const chunks = [];
      file.stream.on('data', (chunk) => chunks.push(chunk));
      file.stream.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          
          const command = new PutObjectCommand({
            Bucket: config.AWS_S3_BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ContentType: file.mimetype,
          });
          
          await s3Client.send(command);
          
          cb(null, {
            location: fileName,
            path: fileName,
            bucket: config.AWS_S3_BUCKET_NAME,
            key: fileName,
            etag: null,
          });
        } catch (error) {
          cb(error);
        }
      });
      
      file.stream.on('error', (error) => {
        cb(error);
      });
    } catch (error) {
      cb(error);
    }
  },
  
  _removeFile: async (req, file, cb) => {
    cb(null);
  },
};

const storage = s3Storage;

const fileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export const uploadMiddleware = (fieldName) => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        return next(err);
      }
      if (req.file && req.file.location && !req.file.path) {
        req.file.path = req.file.location;
      }
      next();
    });
  };
};

export default upload;


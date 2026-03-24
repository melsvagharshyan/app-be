import { v2 as cloudinary } from 'cloudinary';
import 'dotenv/config';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export type CloudinaryUploadResult = {
  public_id: string;
  secure_url: string;
};

export const handleUpload = async (file: string) => {
  const res = await cloudinary.uploader.upload(file, {
    resource_type: 'image',
    folder: 'app_images',
  });

  return {
    public_id: res.public_id,
    secure_url: res.secure_url,
  } satisfies CloudinaryUploadResult;
};

export const handleDeleteImage = async (imageId: string) => {
  await cloudinary.uploader.destroy(imageId);
};

import fs from "fs";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { Upload } from "@aws-sdk/lib-storage";
import s3 from "./s3.js";

const bucketName = process.env.AWS_STORAGE_BUCKET_NAME;
const ASSETS_BASE = "assets";

const ALLOWED_TYPES = [
  "application/pdf",

  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "video/mp4",

  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
];

export const uploadFile = async ({ file, staffId = null }) => {
  if (!file) throw new Error("No file found");

  const filename = file.originalname || file.name || "";
  const fileExt = filename.toLowerCase().split(".").pop();
  const isZipFile = fileExt === "zip";

  if (!ALLOWED_TYPES.includes(file.mimetype) && !isZipFile) {
    throw new Error(`Unsupported file type: ${file.mimetype}`);
  }

  const original = file.originalname;
  const ext = original.split(".").pop();

  const base = original
    .replace(`.${ext}`, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toLowerCase();

  const folder = staffId ? `${ASSETS_BASE}/${staffId}` : ASSETS_BASE;

  const inputBuffer = file.buffer ? file.buffer : fs.readFileSync(file.path);

  let finalBuffer = inputBuffer;
  let fileKey = `${folder}/${Date.now()}-${base}.${ext}`;
  let contentType = file.mimetype;

  const isImage = file.mimetype.startsWith("image/");

  if (isImage) {
    finalBuffer = await sharp(inputBuffer).webp({ quality: 80 }).toBuffer();

    fileKey = `${folder}/${Date.now()}-${base}.webp`;
    contentType = "image/webp";
  }

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: bucketName,
      Key: fileKey,
      Body: finalBuffer,
      ContentType: contentType,

      ACL: "public-read",
      CacheControl: "public, max-age=31536000, immutable",
    },
  });

  await upload.done();

  // cleanup temp file
  if (file.path) {
    fs.unlinkSync(file.path);
  }

  return {
    url: `https://${bucketName}.s3.${process.env.AWS_S3_REGION_NAME}.amazonaws.com/${fileKey}`,
    key: fileKey,
  };
};

export const deleteFile = async (key) => {
  if (!key) return;

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await s3.send(command);
};

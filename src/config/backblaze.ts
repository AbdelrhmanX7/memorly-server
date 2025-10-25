import { S3Client } from "@aws-sdk/client-s3";

const b2KeyId = process.env.B2_KEY_ID || "";
const b2AppKey = process.env.B2_APP_KEY || "";
const b2BucketName = process.env.B2_BUCKET || "";
const b2Region = process.env.B2_REGION || "";
const b2Endpoint = process.env.B2_ENDPOINT || "";

if (!b2KeyId || !b2AppKey || !b2BucketName || !b2Region || !b2Endpoint) {
  console.warn(
    "Warning: Missing Backblaze B2 configuration. File uploads will not work."
  );
  console.warn(
    "Required: B2_KEY_ID, B2_APP_KEY, B2_BUCKET, B2_REGION, B2_ENDPOINT"
  );
}

// Create S3Client instance for Backblaze B2
export const s3Client = new S3Client({
  region: b2Region,
  endpoint: b2Endpoint,
  credentials: {
    accessKeyId: b2KeyId,
    secretAccessKey: b2AppKey,
  },
  forcePathStyle: true,
});

export const authorizeB2 = async (): Promise<void> => {
  try {
    if (!b2KeyId || !b2AppKey || !b2BucketName || !b2Region || !b2Endpoint) {
      throw new Error("Missing required Backblaze B2 configuration");
    }
    console.log("Backblaze B2 configured successfully");
  } catch (error) {
    console.error("Failed to configure Backblaze B2:", error);
    throw new Error("Backblaze B2 configuration failed");
  }
};

export const getB2Config = () => {
  return {
    bucketName: b2BucketName,
    region: b2Region,
    endpoint: b2Endpoint,
  };
};

export default s3Client;

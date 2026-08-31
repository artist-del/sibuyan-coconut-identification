import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CloudinaryDeleteResult = {
  deleted: number;
  failed: number;
  skipped: number;
};

async function deleteCloudinaryImages(publicIds: string[]): Promise<CloudinaryDeleteResult> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return { deleted: 0, failed: 0, skipped: publicIds.length };
  }

  let deleted = 0;
  let failed = 0;

  for (const publicId of publicIds) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}`;
    const signature = crypto.createHash("sha1").update(`${paramsToSign}${apiSecret}`).digest("hex");

    const body = new FormData();
    body.append("public_id", publicId);
    body.append("api_key", apiKey);
    body.append("timestamp", timestamp);
    body.append("signature", signature);

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
        method: "POST",
        body
      });

      if (response.ok) {
        deleted += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { deleted, failed, skipped: 0 };
}

async function main() {
  const uploadedImages = await prisma.uploadedImage.findMany({
    select: { publicId: true }
  });
  const publicIds = uploadedImages
    .map((image) => image.publicId)
    .filter((publicId): publicId is string => Boolean(publicId));

  const cloudinary = await deleteCloudinaryImages(publicIds);

  const [histories, trainingExamples, uploads, logs] = await Promise.all([
    prisma.identificationHistory.deleteMany(),
    prisma.trainingExample.deleteMany(),
    prisma.uploadedImage.deleteMany(),
    prisma.activityLog.deleteMany({
      where: {
        OR: [
          { entity: "IdentificationHistory" },
          { entity: "UploadedImage" },
          { entity: "TrainingExample" },
          { action: "Corrected" },
          { action: "Marked Not Coconut" }
        ]
      }
    })
  ]);

  console.log(`Identification cleanup complete.`);
  console.log(`Deleted history records: ${histories.count}`);
  console.log(`Deleted training examples: ${trainingExamples.count}`);
  console.log(`Deleted uploaded image records: ${uploads.count}`);
  console.log(`Deleted related activity logs: ${logs.count}`);
  console.log(`Cloudinary images deleted: ${cloudinary.deleted}`);
  console.log(`Cloudinary delete failures: ${cloudinary.failed}`);
  console.log(`Cloudinary deletes skipped: ${cloudinary.skipped}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Identification cleanup failed.");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

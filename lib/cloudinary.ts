import crypto from "crypto";

function getCloudinaryConfig() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("Cloudinary environment variables are required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET");
    }

    return { cloudName, apiKey, apiSecret };
}

export type CloudinaryUploadResponse = {
    public_id: string;
    version: number;
    signature: string;
    width: number;
    height: number;
    format: string;
    resource_type: string;
    created_at: string;
    tags: string[];
    bytes: number;
    type: string;
    etag: string;
    placeholder: boolean;
    url: string;
    secure_url: string;
    original_filename: string;
};

export async function uploadImageToCloudinary(file: File, folder = "coconut_identification") {
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = crypto.randomUUID();
    const paramsToSign = `folder=${folder}&overwrite=false&public_id=${publicId}&timestamp=${timestamp}`;
    const signature = crypto
        .createHash("sha1")
        .update(`${paramsToSign}${apiSecret}`)
        .digest("hex");

    const body = new FormData();
    body.append("file", file, file.name);
    body.append("api_key", apiKey);
    body.append("timestamp", timestamp.toString());
    body.append("signature", signature);
    body.append("folder", folder);
    body.append("public_id", publicId);
    body.append("overwrite", "false");

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body
    });

    if (!response.ok) {
        throw new Error("Image storage is unavailable. Please retry.");
    }

    return (await response.json()) as CloudinaryUploadResponse;
}

export async function destroyCloudinaryImage(publicId: string) {
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto.createHash("sha1").update(`invalidate=true&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`).digest("hex");
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
        method: "POST",
        body: new URLSearchParams({ public_id: publicId, invalidate: "true", timestamp, api_key: apiKey, signature })
    });
    if (!response.ok) throw new Error("Unable to remove the stored image. Please retry.");
    const data = await response.json();
    if (data.result !== "ok" && data.result !== "not found") throw new Error("Unable to remove the stored image. Please retry.");
}

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
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}&unique_filename=false&use_filename=true`;
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
    body.append("use_filename", "true");
    body.append("unique_filename", "false");

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudinary upload failed: ${response.status} ${errorText}`);
    }

    return (await response.json()) as CloudinaryUploadResponse;
}

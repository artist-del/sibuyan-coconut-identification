import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
        return NextResponse.json({ message: "Image file is required" }, { status: 400 });
    }

    try {
        const upload = await uploadImageToCloudinary(file);
        return NextResponse.json({ url: upload.secure_url, publicId: upload.public_id, width: upload.width, height: upload.height });
    } catch {
        return NextResponse.json({ message: "Image upload failed. Please try again with a smaller or clearer image." }, { status: 500 });
    }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions, isAdmin } from "@/lib/auth";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!isAdmin(session.user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
        return NextResponse.json({ message: "Image file is required" }, { status: 400 });
    }

    try {
        const upload = await uploadImageToCloudinary(file);
        return NextResponse.json({ url: upload.secure_url, publicId: upload.public_id, width: upload.width, height: upload.height });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Cloudinary upload failed";
        return NextResponse.json({ message }, { status: 500 });
    }
}

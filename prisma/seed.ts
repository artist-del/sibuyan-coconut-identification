import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const RESET_CONFIRMATION = "admin123!";

async function main() {
  if (process.env.CONFIRM_DB_RESET !== RESET_CONFIRMATION) {
    throw new Error(`Refusing to reseed admin users. Set CONFIRM_DB_RESET=${RESET_CONFIRMATION} to continue.`);
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || "admin@cajidiocan.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123!";
  const adminName = process.env.ADMIN_NAME?.trim() || "System Administrator";

  const existingAdmins = await prisma.user.findMany({
    where: { role: Role.ADMIN },
    select: { id: true }
  });
  const adminIds = existingAdmins.map((admin) => admin.id);

  if (adminIds.length > 0) {
    await prisma.session.deleteMany({ where: { userId: { in: adminIds } } });
    await prisma.account.deleteMany({ where: { userId: { in: adminIds } } });

    await prisma.activityLog.updateMany({
      where: { userId: { in: adminIds } },
      data: { userId: null }
    });
    await prisma.identificationHistory.updateMany({
      where: { userId: { in: adminIds } },
      data: { userId: null }
    });
    await prisma.uploadedImage.updateMany({
      where: { userId: { in: adminIds } },
      data: { userId: null }
    });

    await prisma.user.deleteMany({ where: { id: { in: adminIds } } });
  }

  const admin = await prisma.user.create({
    data: {
      name: adminName,
      email: adminEmail,
      password: await bcrypt.hash(adminPassword, 12),
      role: Role.ADMIN
    }
  });

  await prisma.activityLog.create({
    data: {
      action: "Seeded",
      entity: "AdminUser",
      userId: admin.id,
      metadata: {
        removedAdmins: adminIds.length,
        preservedCoconutVarieties: true
      }
    }
  });

  console.log(`Admin seed complete: removed ${adminIds.length} existing admin user(s), created ${adminEmail}. Coconut varieties were preserved.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import bcrypt from "bcryptjs";
import { loadEnvConfig } from "@next/env";

import { PrismaClient, Role } from "@prisma/client";

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Create a .env file with your MongoDB connection string before running npm run prisma:seed."
  );
}

const prisma = new PrismaClient();

const varieties = [
  {
    name: "Sibuyan Tall",
    scientificName: "Cocos nucifera",
    localName: "Matangkad na Niyog",
    description: "A locally documented tall coconut type observed across mixed coastal and upland farms in Sibuyan.",
    characteristics: "Tall palm, broad crown, hardy growth, good copra potential.",
    treeHeight: "18-25 meters",
    fruitColor: "Green to brown",
    averageYield: "65-90 nuts per palm per year",
    locationFound: "Magdiwang",
    imageUrl: "https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=1200&q=80"
  },
  {
    name: "Laguna Tall",
    scientificName: "Cocos nucifera var. typica",
    localName: "Laguna",
    description: "A common Philippine tall variety used as a production reference for copra and seed nut comparison.",
    characteristics: "Vigorous trunk, high canopy, large nuts, late bearing.",
    treeHeight: "20-30 meters",
    fruitColor: "Green",
    averageYield: "70-100 nuts per palm per year",
    locationFound: "San Fernando",
    imageUrl: "https://images.unsplash.com/photo-1531572753322-ad063cecc140?auto=format&fit=crop&w=1200&q=80"
  },
  {
    name: "Tacunan Dwarf",
    scientificName: "Cocos nucifera var. nana",
    localName: "Tacunan",
    description: "A compact coconut type valued for earlier bearing and manageable palm height in small farms.",
    characteristics: "Shorter palm, early bearing, dense bunches, suitable for field monitoring.",
    treeHeight: "8-12 meters",
    fruitColor: "Yellow green",
    averageYield: "80-120 nuts per palm per year",
    locationFound: "Cajidiocan",
    imageUrl: "https://images.unsplash.com/photo-1553984840-b8cbc34f5215?auto=format&fit=crop&w=1200&q=80"
  },
  {
    name: "Catigan Green Dwarf",
    scientificName: "Cocos nucifera var. nana",
    localName: "Catigan",
    description: "A green dwarf type used in Philippine coconut improvement programs and suitable for cataloging in Sibuyan farms.",
    characteristics: "Green fruit, compact stature, early production, uniform bunch formation.",
    treeHeight: "7-11 meters",
    fruitColor: "Green",
    averageYield: "75-110 nuts per palm per year",
    locationFound: "Azagra",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80"
  },
  {
    name: "Aromatic Dwarf",
    scientificName: "Cocos nucifera var. nana",
    localName: "Mabango",
    description: "A specialty dwarf coconut type noted for tender coconut water quality and smaller farm plots.",
    characteristics: "Short palm, sweet aromatic water, smaller nuts, good table coconut profile.",
    treeHeight: "6-10 meters",
    fruitColor: "Light green",
    averageYield: "60-95 nuts per palm per year",
    locationFound: "Espana",
    imageUrl: "https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=1200&q=80"
  },
  {
    name: "Baybay Tall",
    scientificName: "Cocos nucifera var. typica",
    localName: "Baybay",
    description: "A tall coconut type suitable for coastal plantings and traditional copra production records.",
    characteristics: "Tall trunk, strong coastal adaptation, medium to large fruits.",
    treeHeight: "18-28 meters",
    fruitColor: "Brown",
    averageYield: "65-95 nuts per palm per year",
    locationFound: "Taclobo",
    imageUrl: "https://images.unsplash.com/photo-1490879112097-281fea0883ca?auto=format&fit=crop&w=1200&q=80"
  }
];

async function main() {
  const adminPassword = await bcrypt.hash("Admin12345", 12);
  const userPassword = await bcrypt.hash("User12345", 12);

  await prisma.user.upsert({
    where: { email: "admin@sibuyan.gov.ph" },
    update: {},
    create: {
      name: "Sibuyan Agriculture Admin",
      email: "admin@sibuyan.gov.ph",
      password: adminPassword,
      role: Role.ADMIN
    }
  });

  await prisma.user.upsert({
    where: { email: "user@sibuyan.gov.ph" },
    update: {},
    create: {
      name: "Field Officer",
      email: "user@sibuyan.gov.ph",
      password: userPassword,
      role: Role.USER
    }
  });

  for (const variety of varieties) {
    await prisma.coconutVariety.upsert({
      where: { name: variety.name },
      update: variety,
      create: variety
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

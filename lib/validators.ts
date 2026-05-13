import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

export const varietySchema = z.object({
  name: z.string().min(2, "Variety name is required"),
  scientificName: z.string().optional(),
  localName: z.string().optional(),
  description: z.string().min(20, "Description needs more detail"),
  characteristics: z.string().min(10, "Characteristics are required"),
  treeHeight: z.string().min(1, "Tree height is required"),
  fruitColor: z.string().min(1, "Fruit color is required"),
  averageYield: z.string().min(1, "Average yield is required"),
  locationFound: z.string().min(2, "Location is required"),
  imageUrl: z.string().url().optional().or(z.literal(""))
});

export type VarietyInput = z.infer<typeof varietySchema>;

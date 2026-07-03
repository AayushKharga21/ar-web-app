import { collection, addDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

const PUBLIC_URL = "https://arwebsite-nine.vercel.app";

const productsToAdd = [
  {
    id: 1,
    name: "Ladder",
    category: "Living Room",
    price: 1500,
    image: "https://images.unsplash.com/photo-1581092165854-40129fb63d74?w=500&h=500&fit=crop",
    modelGlbUrl: `${PUBLIC_URL}/models/ladder.glb`,
    modelUsdzUrl: "",
    rating: 4,
    reviews: 12,
    stock: 8,
    description: "Modern wooden ladder for your living room storage needs.",
    dimensions: "180cm H x 45cm W x 30cm D",
    material: "Wood",
    colors: ["Natural", "Walnut"],
    featured: true,
  },
  {
    id: 2,
    name: "Bed",
    category: "Bedroom",
    price: 20000,
    image: "https://images.unsplash.com/photo-1505693314967-05ce51b92e1d?w=500&h=500&fit=crop",
    modelGlbUrl: `${PUBLIC_URL}/models/bed.glb`,
    modelUsdzUrl: "",
    rating: 5,
    reviews: 45,
    stock: 5,
    description: "Luxurious queen-size bed with premium upholstery.",
    dimensions: "160cm x 200cm x 80cm H",
    material: "Fabric & Wood",
    colors: ["White", "Grey", "Navy Blue"],
    featured: true,
  },
  {
    id: 3,
    name: "Stand",
    category: "Living Room",
    price: 2000,
    image: "https://images.unsplash.com/photo-1595909496f5-d6e6c3fa1e0f?w=500&h=500&fit=crop",
    modelGlbUrl: `${PUBLIC_URL}/models/Stand.glb`,
    modelUsdzUrl: "",
    rating: 4,
    reviews: 18,
    stock: 12,
    description: "Elegant wooden stand perfect for display and storage.",
    dimensions: "120cm H x 60cm W x 40cm D",
    material: "Wood",
    colors: ["Natural", "Dark Walnut", "Oak"],
    featured: false,
  },
  {
    id: 4,
    name: "Sofa",
    category: "Living Room",
    price: 12000,
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500&h=500&fit=crop",
    modelGlbUrl: `${PUBLIC_URL}/models/sofa.glb`,
    modelUsdzUrl: "",
    rating: 5,
    reviews: 67,
    stock: 10,
    description: "Contemporary 3-seater sofa with comfortable cushioning.",
    dimensions: "220cm W x 90cm D x 85cm H",
    material: "Fabric",
    colors: ["Grey", "Black", "Beige", "Navy"],
    featured: true,
  },
  {
    id: 5,
    name: "Chair",
    category: "Office",
    price: 3000,
    image: "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=500&h=500&fit=crop",
    modelGlbUrl: `${PUBLIC_URL}/models/chair.glb`,
    modelUsdzUrl: "",
    rating: 4.5,
    reviews: 28,
    stock: 15,
    description: "Ergonomic office chair with lumbar support and adjustable height.",
    dimensions: "70cm W x 70cm D x 100cm H (adjustable)",
    material: "Mesh & Plastic",
    colors: ["Blue", "Black", "Grey"],
    featured: false,
  },
];

export async function seedProducts() {
  try {
    for (const product of productsToAdd) {
      await addDoc(collection(db, "products"), {
        ...product,
        createdAt: new Date(),
      });
      console.log(`✓ Added ${product.name}`);
    }
    console.log("✓ All products added successfully!");
  } catch (error) {
    console.error("Error seeding products:", error);
  }
}

// Call this function once to populate products:
// seedProducts();

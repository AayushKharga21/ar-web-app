import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";

// Firebase config
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PUBLIC_URL = process.env.VITE_PUBLIC_URL || "https://arwebsite-nine.vercel.app";

// Mapping of product names to GLB files
const modelMapping: Record<string, string> = {
  "Ladder": `${PUBLIC_URL}/models/ladder.glb`,
  "Bed": `${PUBLIC_URL}/models/bed.glb`,
  "Stand": `${PUBLIC_URL}/models/Stand.glb`,
  "Sofa": `${PUBLIC_URL}/models/sofa.glb`,
  "Chair": `${PUBLIC_URL}/models/chair.glb`,
};

async function updateProductModels() {
  try {
    const productsRef = collection(db, "products");
    const snapshot = await getDocs(productsRef);

    console.log(`Found ${snapshot.docs.length} products`);

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const productName = data.name;
      const glbUrl = modelMapping[productName];

      if (glbUrl) {
        await updateDoc(doc(db, "products", docSnap.id), {
          modelGlbUrl: glbUrl,
        });
        console.log(`✓ Updated ${productName} with ${glbUrl}`);
      } else {
        console.log(`⚠ No GLB mapping found for ${productName}`);
      }
    }

    console.log("All products updated!");
  } catch (error) {
    console.error("Error updating products:", error);
  }
}

updateProductModels();

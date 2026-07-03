
  # Ecommerce Furniture Website

## Firebase setup

1. Copy `.env.example` to `.env`.
2. Open the Firebase console and create or select your project.
3. Add a Web app and copy the config values.
4. Paste the values into `.env`.
5. Restart the Vite dev server.

Example values are already provided in `.env.example`.

## Vercel deployment

1. Push the repository to GitHub.
2. Connect the repository in Vercel.
3. In Vercel project settings, add the same environment variables from `.env`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`
   - `VITE_CLOUDINARY_CLOUD_NAME`
   - `VITE_CLOUDINARY_UPLOAD_PRESET`
   - `VITE_PUBLIC_URL`
4. Deploy the app and confirm the site is served over HTTPS.

> `VITE_PUBLIC_URL` should be your Vercel app URL so the QR scanner sends users to the correct live `/ar/:id` route.

## Firestore rules (permissions)

If you see "Missing or insufficient permissions" when saving products, your Firestore security rules are blocking writes. For development you can allow authenticated users to write to the `products` collection with the following rules (set these in the Firebase Console → Firestore → Rules):

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // allow authenticated users to read/write products (development only)
    match /products/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

For production, restrict writes to specific admin users using their UID or a custom claim:

```firestore
match /products/{docId} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.token.admin == true;
}
```

To set an `admin` custom claim for a user, use the Firebase Admin SDK (run from a trusted environment or Cloud Function). See: https://firebase.google.com/docs/auth/admin/custom-claims

After changing rules, re-run the save operation in the app. If you still get permission errors, ensure the signed-in user is the same account you granted permissions to in the console.



  
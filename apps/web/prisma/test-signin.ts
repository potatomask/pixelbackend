import { auth } from "@/lib/auth";

async function main() {
  // Simulate what happens when a user signs in
  const result = await auth.api.signInEmail({
    body: {
      email: "nyflixboy@gmail.com",
      password: "admin123",
    },
    asResponse: false,
  });
  console.log("Sign-in result:", JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error("Error:", e.message);
  console.error("Status:", e.status);
});

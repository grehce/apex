// Every page and API route requires a Google session, except the sign-in page and Auth.js routes.
// See `authorized` in auth.ts. Pages and route handlers re-check with currentEmail() as a second layer.
export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};

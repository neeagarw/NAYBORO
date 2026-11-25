import { LoginForm } from "./LoginForm";
import { isBetaSite, publicSiteUrl } from "@/lib/store";

export const metadata = { title: "Log in" };

// Fully static, so it shows instantly. ?next=, ?error= and the site mode are read in the browser (LoginForm).
export default function LoginPage() {
  return <LoginForm joinUrl={isBetaSite() ? publicSiteUrl() : "/"} betaCode={isBetaSite() && !!process.env.BETA_LOGIN_CODE}
    google={process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "1"} />;
}

import { redirect } from "next/navigation";
import { getAuthUserId, getCurrentUserOrg } from "@/actions/authActions";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
  const userId = await getAuthUserId();
  if (!userId) redirect("/login");

  const org = await getCurrentUserOrg();
  if (org) redirect("/rooms");

  return <OnboardingForm />;
}

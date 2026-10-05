import { redirect } from "next/navigation";
import { getAuthUserId, getCurrentUserOrg } from "@/actions/authActions";
import { getWalletBalance } from "@/actions/walletActions";
import WalletView from "../WalletView";

export default async function WalletRechargePage() {
  const userId = await getAuthUserId();
  if (!userId) redirect("/login");

  const org = await getCurrentUserOrg();
  if (!org) redirect("/onboarding");

  const wallet = await getWalletBalance();
  if (!wallet) redirect("/login");

  return (
    <WalletView
      organizationName={wallet.organizationName}
      walletBalance={wallet.walletBalance}
      transactions={wallet.transactions}
      onboarding
    />
  );
}

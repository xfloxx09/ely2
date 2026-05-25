import Link from "next/link";
import { Button, Card } from "@/components/ui";

export default function BillingSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
        <p className="text-ely-muted mb-6">Your subscription is now active. Welcome to ELY.</p>
        <Link href="/chat"><Button>Start Chatting</Button></Link>
      </Card>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Legacy route — redirect to /conversations/[id] */
export default function LegacyCommunityDmRedirect() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;

  useEffect(() => {
    router.replace(`/conversations/${conversationId}`);
  }, [conversationId, router]);

  return null;
}

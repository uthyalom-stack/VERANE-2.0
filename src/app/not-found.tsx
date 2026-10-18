import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
export default function NotFound() {
  return <div className="pt-32"><EmptyState title="This page isn't here" action={<ButtonLink href="/shop">Go to the shop</ButtonLink>}>The link may be old or the piece may have left the collection.</EmptyState></div>;
}
